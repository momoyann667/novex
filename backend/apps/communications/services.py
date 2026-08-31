import re
from collections import Counter

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.members.models import Member
from apps.members.services import filter_member_directory, member_directory_base_queryset
from apps.workspaces.models import Workspace
from .models import (
    AudienceType,
    Communication,
    CommunicationChannel,
    CommunicationRecipient,
    CommunicationRecipientStatus,
    CommunicationStatus,
    CommunicationTemplate,
)
from .providers import channel_for


SUPPORTED_TEMPLATE_VARIABLES = {"first_name", "last_name", "association_name", "event_name", "event_date", "amount"}


def log_communication(*, workspace: Workspace, actor, action: str, communication: Communication | None = None, metadata: dict | None = None) -> None:
    AuditLog.objects.create(
        workspace=workspace,
        actor=actor,
        action=action,
        resource="communication",
        resource_id=str(communication.id) if communication else "",
        metadata=metadata or {},
    )


def validate_template_variables(content: str) -> None:
    variables = set(re.findall(r"{{\s*([a-zA-Z0-9_]+)\s*}}", content))
    unknown = sorted(variables - SUPPORTED_TEMPLATE_VARIABLES)
    if unknown:
        raise ValueError(f"Variable inconnue: {', '.join(unknown)}")


def render_template_content(content: str, context: dict) -> str:
    validate_template_variables(content)
    rendered = content
    for variable in SUPPORTED_TEMPLATE_VARIABLES:
        rendered = re.sub(r"{{\s*" + re.escape(variable) + r"\s*}}", str(context.get(variable, "")), rendered)
    return rendered


def communication_queryset_for_workspace(workspace: Workspace):
    return Communication.objects.select_related("workspace", "created_by").prefetch_related("attachments").filter(workspace=workspace)


def notification_queryset_for_user(workspace: Workspace, user):
    member = Member.objects.filter(workspace=workspace, linked_user=user).first()
    filters = Q(user=user)
    if member:
        filters |= Q(member=member)
    return (
        CommunicationRecipient.objects.select_related("communication", "member", "user")
        .filter(workspace=workspace, channel=CommunicationChannel.IN_APP)
        .filter(filters)
        .order_by("-created_at")
    )


def resolve_audience(workspace: Workspace, audience_type: str, filters: dict | None = None):
    filters = filters or {}
    queryset = member_directory_base_queryset(workspace)
    if audience_type == AudienceType.ALL_MEMBERS:
        return queryset.exclude(status=Member.Status.ARCHIVED)
    if audience_type == AudienceType.ACTIVE_MEMBERS:
        return queryset.filter(status=Member.Status.ACTIVE)
    if audience_type == AudienceType.CATEGORY and filters.get("category"):
        return queryset.filter(category_id=filters["category"])
    if audience_type == AudienceType.FUNCTION and filters.get("function"):
        return queryset.filter(function__iexact=filters["function"])
    if audience_type == AudienceType.SEGMENT:
        return filter_member_directory(queryset, filters.get("filters") or filters)
    if audience_type == AudienceType.SELECTED_MEMBERS:
        return queryset.filter(id__in=filters.get("member_ids") or [])
    return queryset.none()


def audience_preview(workspace: Workspace, audience_type: str, filters: dict | None, channels: list[str]) -> dict:
    members = resolve_audience(workspace, audience_type, filters)
    total = members.count()
    return {
        "audience_type": audience_type,
        "total": total,
        "channels": channels,
        "email_reachable": members.exclude(email="").count() if CommunicationChannel.EMAIL in channels else None,
        "sms_reachable": members.exclude(phone="").count() if CommunicationChannel.SMS in channels else None,
        "whatsapp_reachable": members.exclude(phone="").count() if CommunicationChannel.WHATSAPP in channels else None,
        "push_reachable": members.filter(linked_user__isnull=False).count() if CommunicationChannel.PUSH in channels else None,
        "in_app_reachable": members.count() if CommunicationChannel.IN_APP in channels else None,
    }


@transaction.atomic
def create_communication(*, workspace: Workspace, actor, attachments=None, **data) -> Communication:
    validate_template_variables(data.get("content", ""))
    communication = Communication.objects.create(workspace=workspace, created_by=actor, **data)
    if attachments is not None:
        communication.attachments.set(attachments)
    log_communication(workspace=workspace, actor=actor, action="communication.created", communication=communication)
    return communication


@transaction.atomic
def update_communication(*, communication: Communication, actor, attachments=None, **data) -> Communication:
    if communication.status in {CommunicationStatus.PROCESSING, CommunicationStatus.SENT, CommunicationStatus.PARTIALLY_SENT}:
        raise ValueError("Cette communication ne peut plus etre modifiee.")
    validate_template_variables(data.get("content", communication.content))
    for field, value in data.items():
        setattr(communication, field, value)
    communication.save()
    if attachments is not None:
        communication.attachments.set(attachments)
    log_communication(workspace=communication.workspace, actor=actor, action="communication.updated", communication=communication)
    return communication


@transaction.atomic
def schedule_communication(*, communication: Communication, actor, scheduled_at) -> Communication:
    if communication.status not in {CommunicationStatus.DRAFT, CommunicationStatus.SCHEDULED}:
        raise ValueError("Cette communication ne peut pas etre programmee.")
    communication.status = CommunicationStatus.SCHEDULED
    communication.scheduled_at = scheduled_at
    communication.save(update_fields=["status", "scheduled_at", "updated_at"])
    log_communication(workspace=communication.workspace, actor=actor, action="communication.scheduled", communication=communication)
    return communication


@transaction.atomic
def cancel_communication(*, communication: Communication, actor) -> Communication:
    if communication.status == CommunicationStatus.PROCESSING:
        raise ValueError("Une communication en cours d'envoi ne peut pas etre annulee.")
    if communication.status in {CommunicationStatus.SENT, CommunicationStatus.PARTIALLY_SENT}:
        raise ValueError("Une communication deja envoyee ne peut pas etre annulee.")
    communication.status = CommunicationStatus.CANCELLED
    communication.save(update_fields=["status", "updated_at"])
    log_communication(workspace=communication.workspace, actor=actor, action="communication.cancelled", communication=communication)
    return communication


@transaction.atomic
def send_communication(*, communication: Communication, actor, send_now: bool = True) -> Communication:
    if communication.status in {CommunicationStatus.PROCESSING, CommunicationStatus.SENT, CommunicationStatus.PARTIALLY_SENT, CommunicationStatus.CANCELLED}:
        return communication
    if communication.scheduled_at and not send_now:
        return schedule_communication(communication=communication, actor=actor, scheduled_at=communication.scheduled_at)

    communication.status = CommunicationStatus.PROCESSING
    communication.save(update_fields=["status", "updated_at"])
    members = list(resolve_audience(communication.workspace, communication.audience_type, communication.audience_filters))
    channels = communication.channels or [CommunicationChannel.IN_APP]
    communication.audience_snapshot = {"total": len(members), "member_ids": [member.id for member in members[:1000]], "truncated": len(members) > 1000}
    communication.save(update_fields=["audience_snapshot", "updated_at"])

    statuses = []
    for member in members:
        for channel in channels:
            recipient, _ = CommunicationRecipient.objects.get_or_create(
                workspace=communication.workspace,
                communication=communication,
                member=member,
                channel=channel,
                idempotency_key=f"communication:{communication.id}:member:{member.id}:channel:{channel}",
                defaults={"user": member.linked_user},
            )
            recipient.last_attempt_at = timezone.now()
            result = channel_for(channel).send(communication, recipient)
            recipient.status = result.status
            recipient.provider_message_id = result.provider_message_id
            recipient.failure_reason = result.failure_reason
            if result.status in {CommunicationRecipientStatus.SENT, CommunicationRecipientStatus.DELIVERED, CommunicationRecipientStatus.READ}:
                recipient.sent_at = timezone.now()
            if result.status in {CommunicationRecipientStatus.DELIVERED, CommunicationRecipientStatus.READ}:
                recipient.delivered_at = timezone.now()
            recipient.save(update_fields=["status", "provider_message_id", "failure_reason", "sent_at", "delivered_at", "last_attempt_at", "updated_at"])
            statuses.append(result.status)

    if statuses and all(item == CommunicationRecipientStatus.FAILED for item in statuses):
        communication.status = CommunicationStatus.FAILED
    elif CommunicationRecipientStatus.FAILED in statuses:
        communication.status = CommunicationStatus.PARTIALLY_SENT
    else:
        communication.status = CommunicationStatus.SENT
    communication.sent_at = timezone.now()
    communication.save(update_fields=["status", "sent_at", "updated_at"])
    log_communication(workspace=communication.workspace, actor=actor, action="communication.sent", communication=communication, metadata={"recipients": len(members), "channels": channels})
    return communication


def communication_stats(queryset) -> dict:
    recipients = CommunicationRecipient.objects.filter(communication__in=queryset)
    counts = recipients.aggregate(
        total=Count("id"),
        sent=Count("id", filter=Q(status__in=[CommunicationRecipientStatus.SENT, CommunicationRecipientStatus.DELIVERED, CommunicationRecipientStatus.READ])),
        delivered=Count("id", filter=Q(status__in=[CommunicationRecipientStatus.DELIVERED, CommunicationRecipientStatus.READ])),
        read=Count("id", filter=Q(status=CommunicationRecipientStatus.READ)),
        failed=Count("id", filter=Q(status=CommunicationRecipientStatus.FAILED)),
        pending=Count("id", filter=Q(status=CommunicationRecipientStatus.PENDING)),
    )
    delivered = counts["delivered"] or 0
    total = counts["total"] or 0
    sent = counts["sent"] or 0
    by_channel = list(recipients.values("channel").annotate(total=Count("id"), read=Count("id", filter=Q(status=CommunicationRecipientStatus.READ)), failed=Count("id", filter=Q(status=CommunicationRecipientStatus.FAILED))).order_by("channel"))
    return {
        **counts,
        "read_rate": round(((counts["read"] or 0) / delivered) * 100, 1) if delivered else None,
        "failure_rate": round(((counts["failed"] or 0) / total) * 100, 1) if total else None,
        "delivery_rate": round((sent / total) * 100, 1) if total else None,
        "by_channel": by_channel,
    }


def workspace_communication_dashboard(workspace: Workspace) -> dict:
    queryset = communication_queryset_for_workspace(workspace)
    month_start = timezone.now().replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    touched_members = CommunicationRecipient.objects.filter(workspace=workspace, member__isnull=False).values("member_id").distinct().count()
    return {
        "stats": communication_stats(queryset),
        "messages_this_month": queryset.filter(created_at__gte=month_start).count(),
        "scheduled": queryset.filter(status=CommunicationStatus.SCHEDULED).count(),
        "touched_members": touched_members,
        "activity": list(queryset.extra(select={"day": "date(created_at)"}).values("day").annotate(total=Count("id")).order_by("day")[:90]),
    }


@transaction.atomic
def create_template(*, workspace: Workspace, actor, **data) -> CommunicationTemplate:
    validate_template_variables(data.get("content", ""))
    template = CommunicationTemplate.objects.create(workspace=workspace, created_by=actor, variables=sorted(re.findall(r"{{\s*([a-zA-Z0-9_]+)\s*}}", data.get("content", ""))), **data)
    log_communication(workspace=workspace, actor=actor, action="communication.template_created", metadata={"template_id": template.id})
    return template


@transaction.atomic
def mark_all_notifications_read(*, workspace: Workspace, user) -> int:
    queryset = notification_queryset_for_user(workspace, user).exclude(status=CommunicationRecipientStatus.READ)
    now = timezone.now()
    return queryset.update(status=CommunicationRecipientStatus.READ, read_at=now, updated_at=now)
