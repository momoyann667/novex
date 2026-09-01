from decimal import Decimal
from datetime import timedelta

import pytest
from django.utils import timezone

pytest.importorskip("pytest_django")

from apps.ai_assistant.models import AIConversation, AIMessage, AIUsageLog
from apps.ai_assistant.services import create_conversation, send_message, user_permissions
from apps.contributions.models import Contribution, ContributionCampaign
from apps.events.services import create_event
from apps.events.statuses import EventStatus, EventType
from apps.finance.services import create_expense, create_income, default_category, financial_settings
from apps.finance.statuses import FinancialCategoryKind
from apps.members.models import Member
from apps.workspaces.models import Permission, Role, RolePermission, Workspace, WorkspaceMembership


def make_workspace(django_user_model, slug="association", permissions=None):
    owner = django_user_model.objects.create_user(username=f"{slug}@example.com", email=f"{slug}@example.com", password="pass")
    workspace = Workspace.objects.create(name=slug, slug=slug, organization_type="association", owner=owner)
    role = Role.objects.create(workspace=workspace, code="owner", label="Owner")
    for code in permissions or ["*"]:
        permission, _created = Permission.objects.get_or_create(code=code)
        RolePermission.objects.create(role=role, permission=permission)
    WorkspaceMembership.objects.create(user=owner, workspace=workspace, role=role, status="active")
    return workspace, owner


@pytest.mark.django_db
def test_ai_conversation_stores_user_tool_and_assistant_messages(django_user_model):
    workspace, owner = make_workspace(django_user_model, "ai-alpha")
    Member.objects.create(workspace=workspace, membership_number="AI-001", first_name="Awa", last_name="Kouame", status=Member.Status.ACTIVE)
    conversation = create_conversation(workspace=workspace, user=owner)

    message = send_message(conversation=conversation, user=owner, content="Combien de membres sont actifs ?")

    assert message.role == AIMessage.Role.ASSISTANT
    assert "1 actifs" in message.content
    assert AIMessage.objects.filter(conversation=conversation, role=AIMessage.Role.USER).count() == 1
    assert AIMessage.objects.filter(conversation=conversation, role=AIMessage.Role.TOOL).count() == 1
    assert AIUsageLog.objects.filter(workspace=workspace, user=owner).count() == 1


@pytest.mark.django_db
def test_ai_tools_are_scoped_to_current_workspace(django_user_model):
    workspace, owner = make_workspace(django_user_model, "ai-main")
    other_workspace, other_owner = make_workspace(django_user_model, "ai-other")
    Member.objects.create(workspace=workspace, membership_number="A-001", first_name="Awa", last_name="Kouame", status=Member.Status.ACTIVE)
    Member.objects.create(workspace=other_workspace, membership_number="B-001", first_name="Yao", last_name="Kone", status=Member.Status.ACTIVE)
    Member.objects.create(workspace=other_workspace, membership_number="B-002", first_name="Aya", last_name="Kone", status=Member.Status.ACTIVE)
    conversation = create_conversation(workspace=workspace, user=owner)
    other_conversation = create_conversation(workspace=other_workspace, user=other_owner)

    message = send_message(conversation=conversation, user=owner, content="Combien de membres actifs ?")

    assert "1 actifs" in message.content
    assert AIConversation.objects.filter(workspace=workspace, user=owner).count() == 1
    assert AIConversation.objects.filter(workspace=workspace, id=other_conversation.id).exists() is False


@pytest.mark.django_db
def test_ai_respects_tool_permissions(django_user_model, settings):
    settings.DEBUG = False
    workspace, owner = make_workspace(django_user_model, "ai-rbac", permissions=["members.view"])
    conversation = create_conversation(workspace=workspace, user=owner)

    message = send_message(conversation=conversation, user=owner, content="Resume les finances")

    assert "acces non autorise" in message.content
    assert "*" not in user_permissions(workspace=workspace, user=owner)


@pytest.mark.django_db
def test_ai_finance_answer_uses_finance_service_values(django_user_model):
    workspace, owner = make_workspace(django_user_model, "ai-finance")
    settings = financial_settings(workspace)
    settings.expense_validation_threshold = Decimal("9999999.00")
    settings.save()
    income_category = default_category(workspace, kind=FinancialCategoryKind.INCOME_CATEGORY, name="Dons", actor=owner)
    expense_category = default_category(workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Transport", actor=owner)
    create_income(workspace=workspace, actor=owner, category=income_category, amount=Decimal("250000.00"), description="Don")
    create_expense(workspace=workspace, actor=owner, category=expense_category, amount=Decimal("75000.00"), description="Taxi")
    conversation = create_conversation(workspace=workspace, user=owner)

    message = send_message(conversation=conversation, user=owner, content="Quel est notre solde finance ?")

    assert "250 000 XOF" in message.content
    assert "75 000 XOF" in message.content
    assert "175 000 XOF" in message.content


@pytest.mark.django_db
def test_ai_calendar_and_contribution_tools_use_existing_models(django_user_model):
    workspace, owner = make_workspace(django_user_model, "ai-calendar")
    member = Member.objects.create(workspace=workspace, membership_number="C-001", first_name="Fatou", last_name="Diop", status=Member.Status.ACTIVE)
    now = timezone.now()
    create_event(
        workspace=workspace,
        actor=owner,
        title="Reunion bureau",
        event_type=EventType.MEETING,
        status=EventStatus.PLANNED,
        start_at=now + timedelta(days=1),
        end_at=now + timedelta(days=1, hours=2),
    )
    campaign = ContributionCampaign.objects.create(workspace=workspace, name="Septembre", amount=Decimal("10000.00"), due_date=timezone.localdate())
    Contribution.objects.create(workspace=workspace, campaign=campaign, member=member, amount_due=Decimal("10000.00"), due_date=timezone.localdate(), status="OVERDUE")
    conversation = create_conversation(workspace=workspace, user=owner)

    message = send_message(conversation=conversation, user=owner, content="Qu'avons-nous cette semaine et quelles cotisations sont en retard ?")

    assert "Calendrier" in message.content
    assert "Cotisations" in message.content
