from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.subscriptions.models import Plan, Subscription
from .models import OrganizationProfile, Role, Workspace, WorkspaceMembership


SYSTEM_ROLES = {
    "OWNER": "Proprietaire",
    "ADMIN": "Administrateur",
    "PRESIDENT": "President",
    "TREASURER": "Tresorier",
    "SECRETARY": "Secretaire",
    "PROJECT_MANAGER": "Responsable projet",
    "MEMBER": "Membre",
}


@transaction.atomic
def create_workspace_for_owner(*, owner, name: str, organization_type: str, **attrs) -> Workspace:
    slug = slugify(name)[:80]
    workspace = Workspace.objects.create(
        owner=owner,
        name=name,
        slug=slug,
        organization_type=organization_type,
        currency=attrs.get("currency") or "XOF",
        country=attrs.get("country") or "CI",
        city=attrs.get("city", ""),
        description=attrs.get("description", ""),
    )
    OrganizationProfile.objects.create(workspace=workspace)
    roles = {code: Role.objects.create(workspace=workspace, code=code, label=label, is_system=True) for code, label in SYSTEM_ROLES.items()}
    WorkspaceMembership.objects.create(user=owner, workspace=workspace, role=roles["OWNER"], status=WorkspaceMembership.Status.ACTIVE, joined_at=timezone.now())
    plan, _ = Plan.objects.get_or_create(code=Plan.Code.FREEMIUM, defaults={"name": "Freemium"})
    now = timezone.now()
    Subscription.objects.create(workspace=workspace, plan=plan, status=Subscription.Status.TRIAL, trial_started_at=now, trial_ends_at=now + timedelta(days=14))
    from apps.documents.services import ensure_default_folders

    ensure_default_folders(workspace, actor=owner)
    return workspace
