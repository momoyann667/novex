from decimal import Decimal

import pytest
from django.utils import timezone

pytest.importorskip("pytest_django")

from apps.analytics.services import (
    contributions_analytics,
    events_analytics,
    finance_analytics,
    members_analytics,
    overview_analytics,
    performance_scores,
    resolve_analytics_period,
)
from apps.contributions.models import Contribution, ContributionCampaign
from apps.contributions.statuses import ContributionStatus
from apps.events.models import Event, EventParticipant
from apps.events.statuses import EventParticipantStatus
from apps.finance.models import FinancialCategory, FinancialTransaction
from apps.finance.statuses import FinancialCategoryKind, FinancialTransactionStatus, FinancialTransactionType
from apps.members.models import Member
from apps.projects.models import Project
from apps.users.models import User
from apps.workspaces.models import Role, Workspace, WorkspaceMembership


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="analytics@example.com", email="analytics@example.com", password="secret")


@pytest.fixture
def workspace(owner):
    role = Role.objects.create(code="OWNER", label="Owner", is_system=True)
    workspace = Workspace.objects.create(name="Analytics A", slug="analytics-a", organization_type=Workspace.OrganizationType.ASSOCIATION, owner=owner)
    WorkspaceMembership.objects.create(workspace=workspace, user=owner, role=role, status=WorkspaceMembership.Status.ACTIVE)
    return workspace


def category(workspace, kind, name):
    return FinancialCategory.objects.create(workspace=workspace, kind=kind, name=name)


@pytest.mark.django_db
def test_finance_kpis(workspace, owner):
    income_category = category(workspace, FinancialCategoryKind.INCOME_CATEGORY, "Dons")
    expense_category = category(workspace, FinancialCategoryKind.EXPENSE_CATEGORY, "Transport")
    FinancialTransaction.objects.create(workspace=workspace, transaction_type=FinancialTransactionType.INCOME, status=FinancialTransactionStatus.VALIDATED, amount=Decimal("10000000"), category=income_category, description="Recettes", reference="INC-1")
    FinancialTransaction.objects.create(workspace=workspace, transaction_type=FinancialTransactionType.EXPENSE, status=FinancialTransactionStatus.VALIDATED, amount=Decimal("6000000"), category=expense_category, description="Depenses", reference="EXP-1")

    data = finance_analytics(workspace=workspace, period=resolve_analytics_period(code="year"))

    assert data["income"]["value"] == Decimal("10000000")
    assert data["expense"]["value"] == Decimal("6000000")
    assert data["net_result"]["value"] == Decimal("4000000")


@pytest.mark.django_db
def test_contribution_recovery_rate(workspace, owner):
    member = Member.objects.create(workspace=workspace, membership_number="M-001", first_name="Awa", last_name="Kone")
    campaign = ContributionCampaign.objects.create(workspace=workspace, name="Mensuelle", amount=Decimal("5000000"))
    Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("5000000"), amount_paid=Decimal("4000000"), status=ContributionStatus.PARTIALLY_PAID)

    data = contributions_analytics(workspace=workspace, period=resolve_analytics_period(code="year"))

    assert data["expected"] == Decimal("5000000")
    assert data["collected"] == Decimal("4000000")
    assert data["unpaid"] == Decimal("1000000")
    assert data["recovery_rate"] == Decimal("80.00")


@pytest.mark.django_db
def test_members_projects_events_and_workspace_isolation(workspace, owner):
    Member.objects.create(workspace=workspace, membership_number="M-001", first_name="Awa", last_name="Kone", status=Member.Status.ACTIVE)
    Member.objects.create(workspace=workspace, membership_number="M-002", first_name="Yao", last_name="Kouame", status=Member.Status.SUSPENDED)
    Project.objects.create(workspace=workspace, name="Centre", budget=Decimal("10000000"), progress=70)
    event = Event.objects.create(workspace=workspace, title="AG", start_at=timezone.now(), end_at=timezone.now() + timezone.timedelta(hours=2), capacity=100)
    member = Member.objects.filter(workspace=workspace).first()
    EventParticipant.objects.create(workspace=workspace, event=event, member=member, status=EventParticipantStatus.REGISTERED, attendance_status=EventParticipantStatus.ATTENDED)

    other_owner = User.objects.create_user(username="other-analytics@example.com", email="other-analytics@example.com", password="secret")
    other = Workspace.objects.create(name="Analytics B", slug="analytics-b", organization_type=Workspace.OrganizationType.ASSOCIATION, owner=other_owner)
    Member.objects.create(workspace=other, membership_number="B-001", first_name="Hidden", last_name="User", status=Member.Status.ACTIVE)

    period = resolve_analytics_period(code="year")
    members = members_analytics(workspace=workspace, period=period)
    overview = overview_analytics(workspace=workspace, period=period)
    events = events_analytics(workspace=workspace, period=period)
    scores = performance_scores(workspace=workspace, period=period)

    assert members["total_members"] == 2
    assert overview["members"]["total_members"] == 2
    assert events["attendance_rate"] == 100
    assert scores["overall"] >= 0
