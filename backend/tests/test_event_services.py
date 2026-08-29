from decimal import Decimal
from datetime import timedelta

import pytest
from django.utils import timezone

pytest.importorskip("pytest_django")

from apps.events.models import Event
from apps.events.serializers import EventSerializer
from apps.events.services import (
    add_expense_allocation,
    add_participant,
    add_revenue_allocation,
    create_event,
    event_stats,
    update_attendance,
    update_event,
    update_rsvp,
    workspace_event_stats,
)
from apps.events.statuses import EventParticipantStatus, EventStatus, EventType
from apps.members.models import Member
from apps.projects.services import create_project
from apps.workspaces.models import Role, Workspace, WorkspaceMembership


def make_workspace(django_user_model, slug="association"):
    owner = django_user_model.objects.create_user(username=f"{slug}@example.com", email=f"{slug}@example.com", password="pass")
    workspace = Workspace.objects.create(name=slug, slug=slug, organization_type="association", owner=owner)
    role = Role.objects.create(workspace=workspace, code="owner", label="Owner")
    WorkspaceMembership.objects.create(user=owner, workspace=workspace, role=role, status="active")
    return workspace, owner


def make_event(workspace, owner, **overrides):
    now = timezone.now()
    data = {
        "title": "Assemblee generale",
        "event_type": EventType.GENERAL_ASSEMBLY,
        "status": EventStatus.PLANNED,
        "start_at": now,
        "end_at": now + timedelta(hours=2),
        "budget": Decimal("500000.00"),
    }
    data.update(overrides)
    return create_event(workspace=workspace, actor=owner, **data)


@pytest.mark.django_db
def test_event_creation_update_and_cancel_audit(django_user_model):
    workspace, owner = make_workspace(django_user_model)
    event = make_event(workspace, owner)

    updated = update_event(event=event, actor=owner, status=EventStatus.CANCELLED, title="AG reportee")

    assert updated.status == EventStatus.CANCELLED
    assert updated.activities.filter(action="event.created").exists()
    assert updated.activities.filter(action="event.cancelled").exists()


@pytest.mark.django_db
def test_participants_rsvp_attendance_and_stats(django_user_model):
    workspace, owner = make_workspace(django_user_model)
    member = Member.objects.create(workspace=workspace, membership_number="A-001", first_name="Awa", last_name="Kouame")
    event = make_event(workspace, owner)

    participant = add_participant(event=event, member=member, actor=owner)
    update_rsvp(participant=participant, status=EventParticipantStatus.CONFIRMED, actor=owner)
    update_attendance(participant=participant, attended=True, actor=owner)
    stats = event_stats(event)

    assert stats["participants"] == 1
    assert stats["confirmed"] == 0
    assert stats["attended"] == 1
    assert stats["attendance_rate"] == 100


@pytest.mark.django_db
def test_event_budget_expenses_revenues_and_balance(django_user_model):
    workspace, owner = make_workspace(django_user_model)
    event = make_event(workspace, owner)

    add_expense_allocation(event=event, actor=owner, label="Salle", amount=Decimal("325000.00"))
    add_revenue_allocation(event=event, actor=owner, label="Sponsoring", amount=Decimal("1200000.00"))
    stats = event_stats(event)

    assert stats["expenses"] == Decimal("325000.00")
    assert stats["revenues"] == Decimal("1200000.00")
    assert stats["balance"] == Decimal("875000.00")


@pytest.mark.django_db
def test_event_project_association_and_workspace_isolation(django_user_model):
    workspace, owner = make_workspace(django_user_model, "alpha")
    other_workspace, other_owner = make_workspace(django_user_model, "beta")
    project = create_project(workspace=workspace, actor=owner, name="Projet alpha")
    make_event(workspace, owner, project=project)
    make_event(other_workspace, other_owner, title="Event beta")

    assert Event.objects.filter(workspace=workspace).count() == 1
    assert workspace_event_stats(workspace)["upcoming_events"] == 1


@pytest.mark.django_db
def test_event_rejects_cross_workspace_member_and_project(django_user_model):
    workspace, owner = make_workspace(django_user_model, "alpha")
    other_workspace, other_owner = make_workspace(django_user_model, "beta")
    member = Member.objects.create(workspace=other_workspace, membership_number="B-001", first_name="Aya", last_name="Kone")
    project = create_project(workspace=other_workspace, actor=other_owner, name="Projet beta")
    now = timezone.now()
    serializer = EventSerializer(
        data={
            "title": "Formation",
            "event_type": EventType.TRAINING,
            "status": EventStatus.PLANNED,
            "start_at": now.isoformat(),
            "end_at": (now + timedelta(hours=1)).isoformat(),
            "responsible_member": member.id,
            "project": project.id,
        },
        context={"workspace": workspace},
    )

    assert serializer.is_valid() is False
    assert "responsible_member" in serializer.errors
    assert "project" in serializer.errors


@pytest.mark.django_db
def test_event_dates_are_validated(django_user_model):
    workspace, _owner = make_workspace(django_user_model)
    now = timezone.now()
    serializer = EventSerializer(
        data={"title": "Reunion", "start_at": now.isoformat(), "end_at": now.isoformat()},
        context={"workspace": workspace},
    )

    assert serializer.is_valid() is False
    assert "end_at" in serializer.errors
