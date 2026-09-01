from datetime import timedelta
from decimal import Decimal
from datetime import date, datetime

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.analytics.services import overview_analytics, resolve_analytics_period
from apps.audit_logs.models import AuditLog
from apps.contributions.models import Contribution
from apps.contributions.services import contribution_stats
from apps.documents.models import Document
from apps.events.models import Event
from apps.events.services import unified_calendar_items, workspace_event_stats
from apps.finance.models import FinancialTransaction
from apps.finance.statuses import FinancialTransactionStatus, FinancialTransactionType
from apps.members.models import Member
from apps.projects.services import workspace_project_stats
from apps.workspaces.models import Workspace, WorkspaceMembership
from .models import AIConversation, AIMessage, AIUsageLog
from .providers import get_ai_provider


READ_ONLY_TOOLS = {
    "get_members": {"permissions": {"members.view"}, "label": "Membres"},
    "get_financial_summary": {"permissions": {"finance.view"}, "label": "Finances"},
    "get_contributions": {"permissions": {"contributions.view"}, "label": "Cotisations"},
    "get_projects": {"permissions": {"projects.view"}, "label": "Projets"},
    "get_events": {"permissions": {"events.view"}, "label": "Evenements"},
    "get_calendar": {"permissions": {"events.view"}, "label": "Calendrier"},
    "search_documents": {"permissions": {"documents.view"}, "label": "Documents"},
    "get_reports": {"permissions": {"reports.view"}, "label": "Rapports"},
}

AI_RATE_LIMIT_PER_HOUR = 60


def user_permissions(*, workspace: Workspace, user) -> set[str]:
    membership = (
        WorkspaceMembership.objects.filter(workspace=workspace, user=user, status="active")
        .select_related("role")
        .prefetch_related("role__role_permissions__permission")
        .first()
    )
    if not membership:
        return set()
    permissions = {role_permission.permission.code for role_permission in membership.role.role_permissions.all()}
    if settings.DEBUG:
        permissions.add("*")
    return permissions


def json_safe(value):
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, dict):
        return {key: json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [json_safe(item) for item in value]
    return value


def has_tool_permission(tool_name: str, permissions: set[str]) -> bool:
    required = READ_ONLY_TOOLS[tool_name]["permissions"]
    return "*" in permissions or bool(required & permissions)


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


def log_ai_action(*, workspace: Workspace, actor, action: str, resource: str, resource_id: str = "", metadata: dict | None = None) -> None:
    AuditLog.objects.create(workspace=workspace, actor=actor, action=action, resource=resource, resource_id=resource_id, metadata=metadata or {})


def ensure_rate_limit(*, workspace: Workspace, user) -> None:
    since = timezone.now() - timedelta(hours=1)
    count = AIUsageLog.objects.filter(workspace=workspace, user=user, created_at__gte=since).count()
    if count >= AI_RATE_LIMIT_PER_HOUR:
        raise ValueError("Limite IA atteinte. Reessaie dans quelques minutes.")


def decimal_sum(value) -> Decimal:
    return Decimal(str(value or 0))


@transaction.atomic
def create_conversation(*, workspace: Workspace, user, title: str = "", module: str = "") -> AIConversation:
    conversation = AIConversation.objects.create(workspace=workspace, user=user, title=title or "Nouvelle conversation", module=module)
    log_ai_action(workspace=workspace, actor=user, action="ai.conversation_created", resource="ai_conversation", resource_id=str(conversation.id))
    return conversation


def conversation_queryset(*, workspace: Workspace, user):
    return AIConversation.objects.filter(workspace=workspace, user=user).order_by("-updated_at")


def title_from_prompt(prompt: str) -> str:
    cleaned = " ".join(prompt.split())
    return cleaned[:80] if cleaned else "Nouvelle conversation"


def detect_tools(prompt: str, module: str = "") -> list[str]:
    text = f"{prompt} {module}".lower()
    selected = []
    keyword_map = [
        ("get_financial_summary", ["finance", "depense", "dépense", "recette", "solde", "transaction", "budget"]),
        ("get_contributions", ["cotisation", "paye", "payé", "retard", "recouvrement"]),
        ("get_members", ["membre", "actif", "adhesion", "adhésion"]),
        ("get_projects", ["projet", "tache", "tâche", "risque"]),
        ("get_events", ["evenement", "événement", "participant", "presence", "présence"]),
        ("get_calendar", ["calendrier", "planning", "semaine", "mois", "aujourd'hui", "demain"]),
        ("search_documents", ["document", "statut", "archive", "fichier"]),
        ("get_reports", ["rapport", "analyse", "analytics", "kpi"]),
    ]
    for tool_name, keywords in keyword_map:
        if any(keyword in text for keyword in keywords):
            selected.append(tool_name)
    return selected or ["get_reports"]


def tool_denied(tool_name: str) -> dict:
    return {"tool": tool_name, "label": READ_ONLY_TOOLS[tool_name]["label"], "denied": True, "summary": ""}


def get_members_tool(workspace: Workspace) -> dict:
    stats = Member.objects.filter(workspace=workspace).aggregate(
        total=Count("id"),
        active=Count("id", filter=Q(status=Member.Status.ACTIVE)),
        suspended=Count("id", filter=Q(status=Member.Status.SUSPENDED)),
    )
    return {
        "tool": "get_members",
        "label": "Membres",
        "summary": f"{stats['total'] or 0} membres, dont {stats['active'] or 0} actifs et {stats['suspended'] or 0} suspendus.",
        "data": stats,
    }


def get_financial_summary_tool(workspace: Workspace) -> dict:
    totals = FinancialTransaction.objects.filter(workspace=workspace, status=FinancialTransactionStatus.VALIDATED).aggregate(
        income=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.INCOME)),
        expense=Sum("amount", filter=Q(transaction_type=FinancialTransactionType.EXPENSE)),
    )
    income = decimal_sum(totals["income"])
    expense = decimal_sum(totals["expense"])
    balance = income - expense
    return {
        "tool": "get_financial_summary",
        "label": "Finances",
        "summary": f"recettes {income:,.0f} {workspace.currency}, depenses {expense:,.0f} {workspace.currency}, solde {balance:,.0f} {workspace.currency}.".replace(",", " "),
        "data": {"income": income, "expense": expense, "balance": balance},
    }


def get_contributions_tool(workspace: Workspace) -> dict:
    stats = contribution_stats(workspace)
    return {
        "tool": "get_contributions",
        "label": "Cotisations",
        "summary": f"{stats['collected']:,.0f} {workspace.currency} collectes sur {stats['expected']:,.0f} {workspace.currency}, taux {stats['recovery_rate']}%, {stats['late_members']} membre(s) en retard.".replace(",", " "),
        "data": stats,
    }


def get_projects_tool(workspace: Workspace) -> dict:
    stats = workspace_project_stats(workspace)
    return {
        "tool": "get_projects",
        "label": "Projets",
        "summary": f"{stats['total_projects']} projets, {stats['active_projects']} actifs, {stats['delayed_projects']} en retard.",
        "data": stats,
    }


def get_events_tool(workspace: Workspace) -> dict:
    stats = workspace_event_stats(workspace)
    upcoming = list(Event.objects.filter(workspace=workspace, end_at__gte=timezone.now()).order_by("start_at").values("id", "title", "start_at", "location")[:5])
    return {
        "tool": "get_events",
        "label": "Evenements",
        "summary": f"{stats['upcoming_events']} evenement(s) a venir, participation moyenne {stats['average_attendance_rate']}%.",
        "data": {"stats": stats, "upcoming": upcoming},
    }


def get_calendar_tool(workspace: Workspace) -> dict:
    start_at = timezone.now()
    end_at = start_at + timedelta(days=7)
    items = unified_calendar_items(workspace=workspace, start_at=start_at, end_at=end_at)[:10]
    return {
        "tool": "get_calendar",
        "label": "Calendrier",
        "summary": f"{len(items)} element(s) planifie(s) sur les 7 prochains jours.",
        "data": {"items": items},
    }


def search_documents_tool(workspace: Workspace, prompt: str) -> dict:
    terms = [word for word in prompt.split() if len(word) >= 4][:6]
    queryset = Document.objects.filter(workspace=workspace).exclude(status="trash")
    if terms:
        query = Q()
        for term in terms:
            query |= Q(name__icontains=term) | Q(description__icontains=term) | Q(extracted_text__icontains=term)
        queryset = queryset.filter(query)
    documents = list(queryset.order_by("-updated_at").values("id", "name", "category", "updated_at")[:5])
    names = ", ".join(item["name"] for item in documents) or "aucun document trouve"
    return {"tool": "search_documents", "label": "Documents", "summary": names, "data": {"documents": documents}}


def get_reports_tool(workspace: Workspace) -> dict:
    payload = overview_analytics(workspace=workspace, period=resolve_analytics_period(code="month"))
    return {
        "tool": "get_reports",
        "label": "Rapports",
        "summary": "rapport mensuel consolide disponible avec finances, cotisations, membres, projets, evenements et documents.",
        "data": payload,
    }


def run_tool(*, tool_name: str, workspace: Workspace, prompt: str) -> dict:
    if tool_name == "get_members":
        return get_members_tool(workspace)
    if tool_name == "get_financial_summary":
        return get_financial_summary_tool(workspace)
    if tool_name == "get_contributions":
        return get_contributions_tool(workspace)
    if tool_name == "get_projects":
        return get_projects_tool(workspace)
    if tool_name == "get_events":
        return get_events_tool(workspace)
    if tool_name == "get_calendar":
        return get_calendar_tool(workspace)
    if tool_name == "search_documents":
        return search_documents_tool(workspace, prompt)
    return get_reports_tool(workspace)


@transaction.atomic
def send_message(*, conversation: AIConversation, user, content: str, module: str = "") -> AIMessage:
    workspace = conversation.workspace
    ensure_rate_limit(workspace=workspace, user=user)
    permissions = user_permissions(workspace=workspace, user=user)
    user_message = AIMessage.objects.create(workspace=workspace, conversation=conversation, role=AIMessage.Role.USER, content=content)
    log_ai_action(workspace=workspace, actor=user, action="ai.message_created", resource="ai_message", resource_id=str(user_message.id), metadata={"role": "user"})

    tool_results = []
    for tool_name in detect_tools(content, module or conversation.module):
        if not has_tool_permission(tool_name, permissions):
            tool_results.append(tool_denied(tool_name))
            continue
        result = run_tool(tool_name=tool_name, workspace=workspace, prompt=content)
        tool_results.append(result)
        AIMessage.objects.create(
            workspace=workspace,
            conversation=conversation,
            role=AIMessage.Role.TOOL,
            content=result["summary"],
            metadata={"tool": tool_name, "data": json_safe(result.get("data", {}))},
        )
        log_ai_action(workspace=workspace, actor=user, action="ai.tool_called", resource="ai_conversation", resource_id=str(conversation.id), metadata={"tool": tool_name})

    provider = get_ai_provider()
    provider_result = provider.chat(
        prompt=content,
        context={"workspace": {"id": workspace.id, "name": workspace.name, "currency": workspace.currency}, "module": module or conversation.module},
        tool_results=tool_results,
    )
    assistant_message = AIMessage.objects.create(
        workspace=workspace,
        conversation=conversation,
        role=AIMessage.Role.ASSISTANT,
        content=provider_result.content,
        metadata={"provider": provider_result.provider, "model": provider_result.model, "tools": [item["tool"] for item in tool_results]},
    )
    AIUsageLog.objects.create(
        workspace=workspace,
        user=user,
        conversation=conversation,
        provider=provider_result.provider,
        model=provider_result.model,
        prompt_tokens=provider_result.prompt_tokens,
        completion_tokens=provider_result.completion_tokens,
    )
    if conversation.title == "Nouvelle conversation":
        conversation.title = title_from_prompt(content)
        conversation.save(update_fields=["title", "updated_at"])
    return assistant_message
