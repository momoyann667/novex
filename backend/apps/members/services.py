from django.db import transaction

from apps.audit_logs.models import AuditLog
from apps.workspaces.models import Workspace
from .models import Member


def next_membership_number(workspace: Workspace) -> str:
    prefix = workspace.slug.upper().replace("-", "")[:8] or "NOVEX"
    count = Member.objects.filter(workspace=workspace).count() + 1
    return f"{prefix}-{count:06d}"


@transaction.atomic
def create_member(*, workspace: Workspace, actor, **data) -> Member:
    if not data.get("membership_number"):
        data["membership_number"] = next_membership_number(workspace)

    member = Member.objects.create(workspace=workspace, **data)
    AuditLog.objects.create(
        workspace=workspace,
        actor=actor,
        action="member.created",
        resource="member",
        resource_id=str(member.id),
        metadata={"membership_number": member.membership_number},
    )
    return member


@transaction.atomic
def archive_member(*, member: Member, actor) -> Member:
    member.status = Member.Status.ARCHIVED
    member.save(update_fields=["status", "updated_at"])
    AuditLog.objects.create(
        workspace=member.workspace,
        actor=actor,
        action="member.archived",
        resource="member",
        resource_id=str(member.id),
        metadata={"membership_number": member.membership_number},
    )
    return member
