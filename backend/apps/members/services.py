from django.db import transaction
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.workspaces.models import Workspace
from .models import Member, MemberActivity


def next_membership_number(workspace: Workspace) -> str:
    prefix = workspace.slug.upper().replace("-", "")[:8] or "NOVEX"
    count = Member.objects.filter(workspace=workspace).count() + 1
    return f"{prefix}-{count:06d}"


def member_seniority(member: Member, *, today=None) -> dict:
    current_date = today or timezone.localdate()
    days = max((current_date - member.join_date).days, 0)
    return {"days": days, "years": round(days / 365, 1)}


def log_member_action(*, member: Member, actor, action: str, metadata: dict | None = None) -> None:
    payload = metadata or {}
    MemberActivity.objects.create(workspace=member.workspace, member=member, actor=actor, action=action, metadata=payload)
    AuditLog.objects.create(
        workspace=member.workspace,
        actor=actor,
        action=action,
        resource="member",
        resource_id=str(member.id),
        metadata={"membership_number": member.membership_number, **payload},
    )


def sync_member_relations(member: Member, *, tags=None, groups=None) -> None:
    if tags is not None:
        member.tags.set(tags)
    if groups is not None:
        member.groups.set(groups)


@transaction.atomic
def create_member(*, workspace: Workspace, actor, tags=None, groups=None, **data) -> Member:
    if not data.get("membership_number"):
        data["membership_number"] = next_membership_number(workspace)

    member = Member.objects.create(workspace=workspace, **data)
    sync_member_relations(member, tags=tags, groups=groups)
    log_member_action(member=member, actor=actor, action="member.created", metadata={"status": member.status, "function": member.function})
    return member


@transaction.atomic
def update_member(*, member: Member, actor, tags=None, groups=None, **data) -> Member:
    previous_status = member.status
    previous_function = member.function
    photo_updated = "photo" in data

    for field, value in data.items():
        setattr(member, field, value)
    if member.status == Member.Status.SUSPENDED and not member.suspended_at:
        member.suspended_at = timezone.now()
    if member.status != Member.Status.ARCHIVED:
        member.archived_at = None
    member.save()
    sync_member_relations(member, tags=tags, groups=groups)

    log_member_action(member=member, actor=actor, action="member.updated")
    if previous_status != member.status:
        log_member_action(member=member, actor=actor, action="member.status_changed", metadata={"from": previous_status, "to": member.status})
    if previous_function != member.function:
        log_member_action(member=member, actor=actor, action="member.function_changed", metadata={"from": previous_function, "to": member.function})
    if photo_updated:
        log_member_action(member=member, actor=actor, action="member.photo_updated")
    return member


@transaction.atomic
def archive_member(*, member: Member, actor) -> Member:
    member.status = Member.Status.ARCHIVED
    member.archived_at = timezone.now()
    member.save(update_fields=["status", "archived_at", "updated_at"])
    log_member_action(member=member, actor=actor, action="member.archived")
    return member


@transaction.atomic
def restore_member(*, member: Member, actor) -> Member:
    member.status = Member.Status.ACTIVE
    member.archived_at = None
    member.save(update_fields=["status", "archived_at", "updated_at"])
    log_member_action(member=member, actor=actor, action="member.restored")
    return member
