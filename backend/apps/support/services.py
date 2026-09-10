from datetime import datetime, time, timedelta

from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.communications.models import (
    AudienceType,
    Communication,
    CommunicationCategory,
    CommunicationChannel,
    CommunicationPriority,
    CommunicationRecipient,
    CommunicationRecipientStatus,
    CommunicationStatus,
    CommunicationType,
)
from apps.members.models import Member
from apps.workspaces.models import Workspace, WorkspaceMembership
from .models import SupportTicket, SupportTicketCategory, SupportTicketMessage, SupportTicketStatus


MONTHLY_TICKET_LIMIT = 5
User = get_user_model()


def creator_membership(user, workspace: Workspace) -> WorkspaceMembership | None:
    return (
        WorkspaceMembership.objects.select_related("role")
        .filter(user=user, workspace=workspace, status=WorkspaceMembership.Status.ACTIVE, role__code__in=["CREATOR", "OWNER"])
        .first()
    )


def month_bounds(now=None):
    now = now or timezone.now()
    local = timezone.localtime(now)
    start = timezone.make_aware(datetime.combine(local.date().replace(day=1), time.min), timezone.get_current_timezone())
    if local.month == 12:
        next_month = local.date().replace(year=local.year + 1, month=1, day=1)
    else:
        next_month = local.date().replace(month=local.month + 1, day=1)
    end = timezone.make_aware(datetime.combine(next_month, time.min), timezone.get_current_timezone())
    return start, end


def ticket_quota(*, workspace: Workspace, creator, now=None) -> dict:
    start, end = month_bounds(now)
    used = SupportTicket.objects.filter(workspace=workspace, creator=creator, created_at__gte=start, created_at__lt=end).count()
    return {"monthly_limit": MONTHLY_TICKET_LIMIT, "used": used, "remaining": max(MONTHLY_TICKET_LIMIT - used, 0), "period_start": start, "period_end": end}


def next_ticket_number(now=None) -> str:
    year = timezone.localtime(now or timezone.now()).year
    prefix = f"NOVEX-{year}-"
    last = SupportTicket.objects.filter(ticket_number__startswith=prefix).order_by("-ticket_number").values_list("ticket_number", flat=True).first()
    sequence = int(last.rsplit("-", 1)[-1]) + 1 if last else 1
    return f"{prefix}{sequence:06d}"


def create_ticket_number(now=None) -> str:
    for _attempt in range(8):
        number = next_ticket_number(now)
        if not SupportTicket.objects.filter(ticket_number=number).exists():
            return number
    raise ValueError("Impossible de generer un numero de ticket unique.")


def log_ticket(ticket: SupportTicket, *, actor, action: str, metadata: dict | None = None) -> None:
    AuditLog.objects.create(workspace=ticket.workspace, actor=actor, action=action, resource="support_ticket", resource_id=str(ticket.id), metadata=metadata or {})


def notify_user(*, workspace: Workspace, user, title: str, content: str, deep_link: str, actor=None) -> None:
    communication = Communication.objects.create(
        workspace=workspace,
        created_by=actor,
        communication_type=CommunicationType.SYSTEM_NOTIFICATION,
        title=title,
        content=content,
        category=CommunicationCategory.SYSTEM,
        priority=CommunicationPriority.HIGH,
        status=CommunicationStatus.SENT,
        audience_type=AudienceType.SELECTED_MEMBERS,
        audience_filters={"user_id": user.id},
        audience_snapshot={"user_id": user.id},
        channels=[CommunicationChannel.IN_APP],
        deep_link=deep_link,
        sent_at=timezone.now(),
    )
    member = Member.objects.filter(workspace=workspace, linked_user=user).first()
    CommunicationRecipient.objects.create(
        workspace=workspace,
        communication=communication,
        user=user,
        member=member,
        channel=CommunicationChannel.IN_APP,
        status=CommunicationRecipientStatus.DELIVERED,
        idempotency_key=f"support:{communication.id}:user:{user.id}:in_app",
        sent_at=timezone.now(),
        delivered_at=timezone.now(),
    )


def notify_super_admins(ticket: SupportTicket, *, actor=None) -> None:
    admins = User.objects.filter(is_staff=True, is_superuser=True, is_active=True)
    for admin in admins:
        notify_user(
            workspace=ticket.workspace,
            user=admin,
            title="Nouveau ticket recu",
            content=f"{ticket.ticket_number} - {ticket.workspace.name}: {ticket.subject}",
            deep_link=f"/admin/tickets?ticket={ticket.id}",
            actor=actor,
        )


@transaction.atomic
def create_support_ticket(*, workspace: Workspace, creator, subject: str, description: str, category: str) -> SupportTicket:
    if not creator_membership(creator, workspace):
        raise ValueError("Seul le createur de l'association peut ouvrir un ticket.")
    quota = ticket_quota(workspace=workspace, creator=creator)
    if quota["remaining"] <= 0:
        raise ValueError("Vous avez atteint votre limite de 5 tickets pour ce mois. Votre quota sera renouvele automatiquement le mois prochain.")
    category = category if category in SupportTicketCategory.values else SupportTicketCategory.OTHER
    for _attempt in range(8):
        try:
            ticket = SupportTicket.objects.create(
                ticket_number=create_ticket_number(),
                workspace=workspace,
                creator=creator,
                subject=subject,
                description=description,
                category=category,
                status=SupportTicketStatus.PENDING,
            )
            SupportTicketMessage.objects.create(ticket=ticket, author=creator, body=description, is_admin_reply=False)
            log_ticket(ticket, actor=creator, action="TICKET_CREATED", metadata={"ticket_number": ticket.ticket_number, "category": category})
            notify_super_admins(ticket, actor=creator)
            return ticket
        except IntegrityError:
            continue
    raise ValueError("Impossible de creer le ticket pour le moment.")


def creator_ticket_queryset(*, workspace: Workspace, creator):
    return SupportTicket.objects.filter(workspace=workspace, creator=creator).select_related("workspace", "creator", "taken_by", "resolved_by").prefetch_related("messages").order_by("-last_activity_at")


def admin_ticket_queryset():
    return SupportTicket.objects.select_related("workspace", "creator", "taken_by", "resolved_by").prefetch_related("messages").order_by("-last_activity_at")


def ticket_stats(queryset) -> dict:
    counts = queryset.aggregate(
        total=Count("id"),
        pending=Count("id", filter=Q(status=SupportTicketStatus.PENDING)),
        in_progress=Count("id", filter=Q(status=SupportTicketStatus.IN_PROGRESS)),
        resolved=Count("id", filter=Q(status=SupportTicketStatus.RESOLVED)),
    )
    return {key: counts[key] or 0 for key in ["total", "pending", "in_progress", "resolved"]}


@transaction.atomic
def update_ticket_status(*, ticket: SupportTicket, admin, status: str) -> SupportTicket:
    if status not in SupportTicketStatus.values:
        raise ValueError("Statut de ticket invalide.")
    old_status = ticket.status
    ticket = SupportTicket.objects.select_for_update().select_related("workspace", "creator").get(id=ticket.id)
    ticket.status = status
    ticket.last_activity_at = timezone.now()
    updates = ["status", "last_activity_at", "updated_at"]
    if status == SupportTicketStatus.IN_PROGRESS and not ticket.taken_at:
        ticket.taken_at = timezone.now()
        ticket.taken_by = admin
        updates.extend(["taken_at", "taken_by"])
    if status == SupportTicketStatus.RESOLVED:
        ticket.resolved_at = timezone.now()
        ticket.resolved_by = admin
        updates.extend(["resolved_at", "resolved_by"])
        if not ticket.taken_at:
            ticket.taken_at = ticket.resolved_at
            ticket.taken_by = admin
            updates.extend(["taken_at", "taken_by"])
    ticket.save(update_fields=updates)
    SupportTicketMessage.objects.create(ticket=ticket, author=admin, body=f"Statut mis a jour: {ticket.get_status_display()}", is_admin_reply=True)
    log_ticket(ticket, actor=admin, action="TICKET_STATUS_CHANGED", metadata={"from": old_status, "to": status})
    if status == SupportTicketStatus.IN_PROGRESS:
        notify_user(workspace=ticket.workspace, user=ticket.creator, title="Ticket pris en charge", content=f"Votre ticket {ticket.ticket_number} est maintenant pris en charge.", deep_link=f"/app/{ticket.workspace.slug}/support", actor=admin)
    if status == SupportTicketStatus.RESOLVED:
        log_ticket(ticket, actor=admin, action="TICKET_RESOLVED", metadata={"ticket_number": ticket.ticket_number})
        notify_user(workspace=ticket.workspace, user=ticket.creator, title="Ticket regle", content=f"Votre ticket {ticket.ticket_number} a ete regle.", deep_link=f"/app/{ticket.workspace.slug}/support", actor=admin)
    return ticket


@transaction.atomic
def reply_to_ticket(*, ticket: SupportTicket, author, body: str, is_admin_reply: bool) -> SupportTicketMessage:
    message = SupportTicketMessage.objects.create(ticket=ticket, author=author, body=body, is_admin_reply=is_admin_reply)
    ticket.last_activity_at = timezone.now()
    ticket.save(update_fields=["last_activity_at", "updated_at"])
    log_ticket(ticket, actor=author, action="TICKET_REPLIED", metadata={"admin_reply": is_admin_reply})
    target = ticket.creator if is_admin_reply else None
    if target:
        notify_user(workspace=ticket.workspace, user=target, title="Reponse NOVEX", content=f"Nouvelle reponse sur le ticket {ticket.ticket_number}.", deep_link=f"/app/{ticket.workspace.slug}/support", actor=author)
    return message


def filter_admin_tickets(queryset, params):
    search = (params.get("search") or "").strip()
    if search:
        queryset = queryset.filter(Q(ticket_number__icontains=search) | Q(subject__icontains=search) | Q(creator__email__icontains=search) | Q(creator__first_name__icontains=search) | Q(creator__last_name__icontains=search) | Q(workspace__name__icontains=search))
    if params.get("status"):
        queryset = queryset.filter(status=params["status"])
    if params.get("association"):
        queryset = queryset.filter(workspace_id=params["association"])
    if params.get("creator"):
        queryset = queryset.filter(creator_id=params["creator"])
    period = params.get("period")
    now = timezone.now()
    today = timezone.localdate()
    if period == "today":
        start = timezone.make_aware(datetime.combine(today, time.min))
        queryset = queryset.filter(created_at__gte=start, created_at__lte=now)
    elif period == "week":
        queryset = queryset.filter(created_at__gte=now - timedelta(days=7), created_at__lte=now)
    elif period == "month":
        start, end = month_bounds(now)
        queryset = queryset.filter(created_at__gte=start, created_at__lt=end)
    elif period == "previous_month":
        start, _end = month_bounds(now)
        previous_end = start
        previous_start_date = (timezone.localtime(start) - timedelta(days=1)).date().replace(day=1)
        previous_start = timezone.make_aware(datetime.combine(previous_start_date, time.min), timezone.get_current_timezone())
        queryset = queryset.filter(created_at__gte=previous_start, created_at__lt=previous_end)
    if params.get("date_from"):
        queryset = queryset.filter(created_at__date__gte=params["date_from"])
    if params.get("date_to"):
        queryset = queryset.filter(created_at__date__lte=params["date_to"])
    return queryset
