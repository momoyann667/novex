from datetime import datetime, timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.db import IntegrityError, transaction
from django.db.models import Count, Max, Q, Sum
from django.utils import timezone
from django.utils.crypto import constant_time_compare, get_random_string, salted_hmac

from apps.audit_logs.models import AuditLog
from apps.contributions.models import Contribution
from apps.contributions.statuses import ContributionStatus
from apps.documents.models import Document
from apps.documents.statuses import DocumentStatus, DocumentVisibility, ShareSubjectType
from apps.events.models import EventParticipant
from apps.events.statuses import EventParticipantStatus, EventStatus
from apps.payments.models import Payment
from apps.payments.statuses import PaymentStatus
from apps.workspaces.models import Workspace, WorkspaceMembership
from apps.workspaces.services import ensure_workspace_rbac
from apps.users.models import Profile
from .models import Member, MemberActivity, MemberInvitation, MembershipApplication, MembershipSettings


ZERO = Decimal("0.00")
TEMPORARY_PASSWORD_CHARS = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%&*"


DIRECTORY_SORTS = {
    "name": ("last_name", "first_name"),
    "-name": ("-last_name", "-first_name"),
    "join_date": ("join_date",),
    "-join_date": ("-join_date",),
    "status": ("status", "last_name"),
    "-status": ("-status", "last_name"),
    "last_activity": ("last_activity_at",),
    "-last_activity": ("-last_activity_at",),
    "created_at": ("created_at",),
    "-created_at": ("-created_at",),
}


def next_membership_number(workspace: Workspace) -> str:
    prefix = workspace.slug.upper().replace("-", "")[:8] or "NOVEX"
    count = Member.objects.filter(workspace=workspace).count() + 1
    return f"{prefix}-{count:06d}"


def member_seniority(member: Member, *, today=None) -> dict:
    current_date = today or timezone.localdate()
    days = max((current_date - member.join_date).days, 0)
    return {"days": days, "years": round(days / 365, 1)}


def member_directory_base_queryset(workspace: Workspace):
    return (
        Member.objects.select_related("category", "workspace", "linked_user")
        .prefetch_related("tags", "groups")
        .filter(workspace=workspace)
        .annotate(
            last_activity_at=Max("activities__created_at"),
            contribution_total=Count("contributions", distinct=True),
            contribution_paid=Count("contributions", filter=Q(contributions__status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED]), distinct=True),
            contribution_partial=Count("contributions", filter=Q(contributions__status=ContributionStatus.PARTIALLY_PAID), distinct=True),
            contribution_overdue=Count("contributions", filter=Q(contributions__status=ContributionStatus.OVERDUE), distinct=True),
            contribution_pending=Count("contributions", filter=Q(contributions__status=ContributionStatus.PENDING), distinct=True),
        )
    )


def member_contribution_status(member: Member) -> str:
    if getattr(member, "contribution_total", 0) == 0:
        return "none"
    if getattr(member, "contribution_overdue", 0):
        return "overdue"
    if getattr(member, "contribution_partial", 0):
        return "partial"
    if getattr(member, "contribution_pending", 0):
        return "pending"
    return "up_to_date"


def filter_member_directory(queryset, filters: dict):
    search = (filters.get("search") or "").strip()
    if search:
        queryset = queryset.filter(
            Q(first_name__icontains=search)
            | Q(last_name__icontains=search)
            | Q(email__icontains=search)
            | Q(phone__icontains=search)
            | Q(membership_number__icontains=search)
            | Q(function__icontains=search)
        )

    direct_filters = {
        "status": "status",
        "role": "function__iexact",
        "function": "function__iexact",
        "category": "category_id",
        "gender": "gender",
        "city": "city__icontains",
        "joined_from": "join_date__gte",
        "joined_to": "join_date__lte",
    }
    for key, field in direct_filters.items():
        value = filters.get(key)
        if value:
            queryset = queryset.filter(**{field: value})

    date_preset = filters.get("date_preset")
    today = timezone.localdate()
    if date_preset == "today":
        queryset = queryset.filter(join_date=today)
    elif date_preset == "week":
        queryset = queryset.filter(join_date__gte=today - timedelta(days=today.weekday()))
    elif date_preset == "month":
        queryset = queryset.filter(join_date__year=today.year, join_date__month=today.month)
    elif date_preset == "year":
        queryset = queryset.filter(join_date__year=today.year)

    if filters.get("tag"):
        queryset = queryset.filter(tags__id=filters["tag"])
    if filters.get("group"):
        queryset = queryset.filter(groups__id=filters["group"])

    contribution_status = filters.get("contribution_status")
    if contribution_status == "up_to_date":
        queryset = queryset.filter(contribution_total__gt=0, contribution_overdue=0, contribution_partial=0, contribution_pending=0)
    elif contribution_status == "overdue":
        queryset = queryset.filter(contribution_overdue__gt=0)
    elif contribution_status == "partial":
        queryset = queryset.filter(contribution_partial__gt=0)
    elif contribution_status == "pending":
        queryset = queryset.filter(contribution_pending__gt=0)
    elif contribution_status == "none":
        queryset = queryset.filter(contribution_total=0)

    return queryset.distinct()


def sort_member_directory(queryset, sort: str | None):
    ordering = DIRECTORY_SORTS.get(sort or "name", DIRECTORY_SORTS["name"])
    return queryset.order_by(*ordering, "id")


def member_directory_summary(workspace: Workspace) -> dict:
    base = Member.objects.filter(workspace=workspace)
    today = timezone.localdate()
    current_start = today - timedelta(days=30)
    previous_start = today - timedelta(days=60)
    current_new = base.filter(join_date__gte=current_start).count()
    previous_new = base.filter(join_date__gte=previous_start, join_date__lt=current_start).count()
    growth_rate = round(((current_new - previous_new) / previous_new) * 100, 1) if previous_new else None
    total = base.count()
    contribution_members = Contribution.objects.filter(workspace=workspace).values("member_id").distinct().count()
    paid_members = Contribution.objects.filter(workspace=workspace, status__in=[ContributionStatus.PAID, ContributionStatus.WAIVED]).values("member_id").distinct().count()
    participant_total = EventParticipant.objects.filter(workspace=workspace).count()
    participant_attended = EventParticipant.objects.filter(workspace=workspace, attendance_status=EventParticipantStatus.ATTENDED).count()
    return {
        "total": total,
        "active": base.filter(status=Member.Status.ACTIVE).count(),
        "pending": base.filter(status=Member.Status.PENDING).count(),
        "inactive": base.filter(status=Member.Status.INACTIVE).count(),
        "suspended": base.filter(status=Member.Status.SUSPENDED).count(),
        "archived": base.filter(status=Member.Status.ARCHIVED).count(),
        "new_30_days": current_new,
        "growth_rate": growth_rate,
        "contribution_rate": round((paid_members / contribution_members) * 100, 1) if contribution_members else None,
        "participation_rate": round((participant_attended / participant_total) * 100, 1) if participant_total else None,
    }


def member_directory_facets(workspace: Workspace) -> dict:
    base = Member.objects.filter(workspace=workspace)
    return {
        "statuses": [{"value": value, "label": label, "count": base.filter(status=value).count()} for value, label in Member.Status.choices],
        "functions": list(base.exclude(function="").values("function").annotate(count=Count("id")).order_by("function")),
        "cities": list(base.exclude(city="").values("city").annotate(count=Count("id")).order_by("city")),
        "categories": list(workspace.member_categories.values("id", "name").annotate(count=Count("members")).order_by("name")),
        "genders": [{"value": value, "label": label, "count": base.filter(gender=value).count()} for value, label in Member.Gender.choices],
    }


def member_directory_segments(workspace: Workspace) -> list[dict]:
    base = member_directory_base_queryset(workspace)
    today = timezone.localdate()
    return [
        {"key": "active", "name": "Membres actifs", "description": "Tous les membres actifs", "filters": {"status": Member.Status.ACTIVE}, "count": base.filter(status=Member.Status.ACTIVE).count(), "visibility": "shared"},
        {"key": "new", "name": "Nouveaux membres", "description": "Adhesions des 30 derniers jours", "filters": {"joined_from": str(today - timedelta(days=30))}, "count": base.filter(join_date__gte=today - timedelta(days=30)).count(), "visibility": "shared"},
        {"key": "overdue", "name": "Cotisations en retard", "description": "Membres avec cotisations en retard", "filters": {"contribution_status": "overdue"}, "count": base.filter(contribution_overdue__gt=0).count(), "visibility": "shared"},
        {"key": "archived", "name": "Archives", "description": "Membres archives conserves pour historique", "filters": {"status": Member.Status.ARCHIVED}, "count": base.filter(status=Member.Status.ARCHIVED).count(), "visibility": "shared"},
    ]


def log_member_export(*, workspace: Workspace, actor, count: int, filters: dict) -> None:
    clean_filters = {key: value for key, value in filters.items() if value not in [None, ""]}
    AuditLog.objects.create(workspace=workspace, actor=actor, action="member.exported", resource="member", resource_id="", metadata={"count": count, "filters": clean_filters})


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


def log_membership_event(*, workspace: Workspace | None, actor, action: str, resource: str, resource_id: str, metadata: dict | None = None) -> None:
    AuditLog.objects.create(workspace=workspace, actor=actor, action=action, resource=resource, resource_id=resource_id, metadata=metadata or {})


def sync_member_relations(member: Member, *, tags=None, groups=None) -> None:
    if tags is not None:
        member.tags.set(tags)
    if groups is not None:
        member.groups.set(groups)


@transaction.atomic
def create_member(*, workspace: Workspace, actor, tags=None, groups=None, **data) -> Member:
    from apps.subscriptions.services import check_subscription_quota

    current_members = Member.objects.filter(workspace=workspace).exclude(status=Member.Status.ARCHIVED).count()
    check_subscription_quota(workspace, "MAX_MEMBERS", current_usage=current_members)
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


def get_membership_settings(workspace: Workspace) -> MembershipSettings:
    settings, _ = MembershipSettings.objects.get_or_create(workspace=workspace)
    return settings


def invitation_token_hash(token: str) -> str:
    return salted_hmac("member-invitation", token).hexdigest()


def generate_invitation_token() -> str:
    return get_random_string(48)


def generate_temporary_password(user=None) -> str:
    for _attempt in range(20):
        password = get_random_string(18, allowed_chars=TEMPORARY_PASSWORD_CHARS)
        try:
            validate_password(password, user=user)
        except Exception:
            continue
        return password
    return get_random_string(24, allowed_chars=TEMPORARY_PASSWORD_CHARS)


def find_existing_member(*, workspace: Workspace, email: str = "", phone: str = "") -> Member | None:
    filters = Q()
    if email:
        filters |= Q(email__iexact=email)
    if phone:
        filters |= Q(phone=phone)
    if not filters:
        return None
    return Member.objects.filter(workspace=workspace).filter(filters).first()


def duplicate_warning(*, workspace: Workspace, email: str = "", phone: str = "") -> dict:
    member = find_existing_member(workspace=workspace, email=email, phone=phone)
    active_applications = MembershipApplication.objects.filter(workspace=workspace, status__in=[MembershipApplication.Status.PENDING, MembershipApplication.Status.UNDER_REVIEW])
    if email:
        active_applications = active_applications.filter(Q(email__iexact=email) | Q(phone=phone))
    elif phone:
        active_applications = active_applications.filter(phone=phone)
    matches = {}
    if member:
        matches["member"] = {"id": member.id, "name": member.full_name, "email": member.email, "phone": member.phone}
    if active_applications.exists():
        matches["applications"] = list(active_applications.values("id", "first_name", "last_name", "email", "phone", "status")[:5])
    return matches


@transaction.atomic
def create_membership_application(*, workspace: Workspace, actor=None, source=MembershipApplication.Source.ADMIN, **data) -> MembershipApplication:
    email = (data.get("email") or "").lower()
    phone = data.get("phone") or ""
    linked_user = get_user_model().objects.filter(email__iexact=email).first() if email else None
    application = MembershipApplication.objects.create(
        workspace=workspace,
        linked_user=linked_user,
        source=source,
        duplicate_warning=duplicate_warning(workspace=workspace, email=email, phone=phone),
        **{**data, "email": email},
    )
    log_membership_event(workspace=workspace, actor=actor, action="membership_application.created", resource="membership_application", resource_id=str(application.id), metadata={"source": source})
    return application


@transaction.atomic
def review_application(*, application: MembershipApplication, actor, internal_note: str = "") -> MembershipApplication:
    application = MembershipApplication.objects.select_for_update().get(id=application.id)
    if application.status not in [MembershipApplication.Status.PENDING, MembershipApplication.Status.UNDER_REVIEW]:
        raise ValueError("Cette candidature ne peut plus etre prise en charge.")
    application.status = MembershipApplication.Status.UNDER_REVIEW
    application.reviewed_by = actor
    application.reviewed_at = timezone.now()
    if internal_note:
        application.internal_note = internal_note
    application.save(update_fields=["status", "reviewed_by", "reviewed_at", "internal_note", "updated_at"])
    log_membership_event(workspace=application.workspace, actor=actor, action="membership_application.reviewed", resource="membership_application", resource_id=str(application.id))
    return application


@transaction.atomic
def approve_application(*, application: MembershipApplication, actor, official_join_date=None) -> MembershipApplication:
    application = MembershipApplication.objects.select_for_update().select_related("workspace", "linked_user", "member").get(id=application.id)
    if application.status == MembershipApplication.Status.APPROVED and application.member_id:
        return application
    if application.status in [MembershipApplication.Status.REJECTED, MembershipApplication.Status.CANCELLED, MembershipApplication.Status.EXPIRED]:
        raise ValueError("Cette candidature ne peut pas etre approuvee.")

    existing_member = find_existing_member(workspace=application.workspace, email=application.email, phone=application.phone)
    if existing_member:
        member = existing_member
        if member.status != Member.Status.ACTIVE:
            member.status = Member.Status.ACTIVE
            member.save(update_fields=["status", "updated_at"])
    else:
        member = create_member(
            workspace=application.workspace,
            actor=actor,
            linked_user=application.linked_user,
            first_name=application.first_name,
            last_name=application.last_name,
            email=application.email,
            phone=application.phone,
            occupation=application.occupation,
            city=application.city,
            notes=application.internal_note,
            custom_fields=application.custom_fields,
            join_date=official_join_date or timezone.localdate(),
            status=Member.Status.ACTIVE,
        )
        log_membership_event(workspace=application.workspace, actor=actor, action="member.created_from_application", resource="member", resource_id=str(member.id), metadata={"application_id": application.id})

    application.status = MembershipApplication.Status.APPROVED
    application.member = member
    application.reviewed_by = actor
    application.reviewed_at = timezone.now()
    application.save(update_fields=["status", "member", "reviewed_by", "reviewed_at", "updated_at"])
    log_membership_event(workspace=application.workspace, actor=actor, action="membership_application.approved", resource="membership_application", resource_id=str(application.id), metadata={"member_id": member.id})
    return application


@transaction.atomic
def reject_application(*, application: MembershipApplication, actor, rejection_reason: str = "", internal_note: str = "") -> MembershipApplication:
    application = MembershipApplication.objects.select_for_update().get(id=application.id)
    if application.status in [MembershipApplication.Status.APPROVED, MembershipApplication.Status.REJECTED, MembershipApplication.Status.CANCELLED, MembershipApplication.Status.EXPIRED]:
        raise ValueError("Cette candidature ne peut plus etre refusee.")
    application.status = MembershipApplication.Status.REJECTED
    application.reviewed_by = actor
    application.reviewed_at = timezone.now()
    application.rejection_reason = rejection_reason
    if internal_note:
        application.internal_note = internal_note
    application.save(update_fields=["status", "reviewed_by", "reviewed_at", "rejection_reason", "internal_note", "updated_at"])
    log_membership_event(workspace=application.workspace, actor=actor, action="membership_application.rejected", resource="membership_application", resource_id=str(application.id))
    return application


@transaction.atomic
def cancel_application(*, application: MembershipApplication, actor) -> MembershipApplication:
    application = MembershipApplication.objects.select_for_update().get(id=application.id)
    if application.status not in [MembershipApplication.Status.PENDING, MembershipApplication.Status.UNDER_REVIEW]:
        raise ValueError("Cette candidature ne peut pas etre annulee.")
    application.status = MembershipApplication.Status.CANCELLED
    application.save(update_fields=["status", "updated_at"])
    log_membership_event(workspace=application.workspace, actor=actor, action="membership_application.cancelled", resource="membership_application", resource_id=str(application.id))
    return application


@transaction.atomic
def expire_application(*, application: MembershipApplication) -> MembershipApplication:
    application = MembershipApplication.objects.select_for_update().get(id=application.id)
    if application.status in [MembershipApplication.Status.PENDING, MembershipApplication.Status.UNDER_REVIEW] and application.expires_at and application.expires_at <= timezone.now():
        application.status = MembershipApplication.Status.EXPIRED
        application.save(update_fields=["status", "updated_at"])
        log_membership_event(workspace=application.workspace, actor=None, action="membership_application.expired", resource="membership_application", resource_id=str(application.id))
    return application


def active_invitation_filter(*, workspace: Workspace, email: str = "", phone: str = ""):
    filters = Q(workspace=workspace, status=MemberInvitation.Status.PENDING, expires_at__gt=timezone.now())
    identity = Q()
    if email:
        identity |= Q(email__iexact=email)
    if phone:
        identity |= Q(phone=phone)
    return MemberInvitation.objects.filter(filters).filter(identity) if identity else MemberInvitation.objects.none()


def active_member_invitation_filter(*, workspace: Workspace, member: Member | None = None, email: str = "", phone: str = ""):
    queryset = MemberInvitation.objects.filter(workspace=workspace, status=MemberInvitation.Status.PENDING, expires_at__gt=timezone.now())
    identity = Q()
    if member:
        identity |= Q(member=member)
    if email:
        identity |= Q(email__iexact=email)
    if phone:
        identity |= Q(phone=phone)
    return queryset.filter(identity) if identity else MemberInvitation.objects.none()


def ensure_invited_user_account(*, workspace: Workspace, invitation: MemberInvitation, actor=None, rotate_temporary_password: bool = False):
    email = (invitation.email or "").strip().lower()
    if not email:
        return None, ""

    roles = ensure_workspace_rbac(workspace)
    user_model = get_user_model()
    user = user_model.objects.filter(email__iexact=email).first()
    temporary_password = ""
    created = False

    if not user:
        temporary_password = generate_temporary_password()
        user = user_model.objects.create_user(
            username=email,
            email=email,
            password=temporary_password,
            phone=invitation.phone,
            email_verified_at=timezone.now(),
            must_change_password=True,
        )
        Profile.objects.get_or_create(user=user, defaults={"first_name": invitation.first_name, "last_name": invitation.last_name})
        created = True
    elif rotate_temporary_password and user.must_change_password:
        temporary_password = generate_temporary_password(user=user)
        user.set_password(temporary_password)
        user.is_active = True
        if not user.email_verified_at:
            user.email_verified_at = timezone.now()
        user.save(update_fields=["password", "is_active", "email_verified_at"])

    if invitation.member_id and not invitation.member.linked_user_id:
        invitation.member.linked_user = user
        invitation.member.save(update_fields=["linked_user", "updated_at"])

    WorkspaceMembership.objects.update_or_create(
        user=user,
        workspace=workspace,
        defaults={"role": roles["MEMBER"], "status": WorkspaceMembership.Status.INVITED, "invited_at": timezone.now()},
    )

    if created:
        log_membership_event(
            workspace=workspace,
            actor=actor,
            action="member.invited_account_created",
            resource="user",
            resource_id=str(user.id),
            metadata={"invitation_id": invitation.id, "member_id": invitation.member_id},
        )
    return user, temporary_password


@transaction.atomic
def create_member_invitation(*, workspace: Workspace, actor, **data) -> tuple[MemberInvitation, str, bool, str]:
    settings = get_membership_settings(workspace)
    if not settings.invitation_enabled:
        raise ValueError("Les invitations sont desactivees pour cette association.")
    email = (data.get("email") or "").lower()
    phone = data.get("phone") or ""
    member = data.get("member")
    existing = active_member_invitation_filter(workspace=workspace, member=member, email=email, phone=phone).first()
    if existing:
        return existing, "", False, ""
    token = generate_invitation_token()
    invitation = MemberInvitation.objects.create(
        workspace=workspace,
        invited_by=actor,
        token_hash=invitation_token_hash(token),
        expires_at=timezone.now() + timedelta(days=settings.invitation_expiration_days),
        last_sent_at=timezone.now(),
        **{**data, "email": email},
    )
    _user, temporary_password = ensure_invited_user_account(workspace=workspace, invitation=invitation, actor=actor)
    log_membership_event(workspace=workspace, actor=actor, action="invitation.created", resource="member_invitation", resource_id=str(invitation.id), metadata={"email": email, "phone": phone})
    return invitation, token, True, temporary_password


def get_invitation_by_token(token: str) -> MemberInvitation | None:
    token_hash = invitation_token_hash(token)
    for invitation in MemberInvitation.objects.select_related("workspace", "invited_by").filter(token_hash=token_hash):
        if constant_time_compare(invitation.token_hash, token_hash):
            return invitation
    return None


@transaction.atomic
def accept_invitation(*, token: str, user=None) -> MemberInvitation:
    invitation = get_invitation_by_token(token)
    if not invitation:
        raise ValueError("Invitation invalide.")
    invitation = MemberInvitation.objects.select_for_update().select_related("workspace").get(id=invitation.id)
    if invitation.status != MemberInvitation.Status.PENDING:
        raise ValueError("Cette invitation n'est plus active.")
    if invitation.expires_at <= timezone.now():
        invitation.status = MemberInvitation.Status.EXPIRED
        invitation.save(update_fields=["status", "updated_at"])
        log_membership_event(workspace=invitation.workspace, actor=None, action="invitation.expired", resource="member_invitation", resource_id=str(invitation.id))
        raise ValueError("Cette invitation a expire.")

    linked_user = user if getattr(user, "is_authenticated", False) else None
    if not linked_user and invitation.email:
        linked_user = get_user_model().objects.filter(email__iexact=invitation.email).first()
    member = invitation.member or find_existing_member(workspace=invitation.workspace, email=invitation.email, phone=invitation.phone)
    if not member:
        member = create_member(
            workspace=invitation.workspace,
            actor=invitation.invited_by,
            linked_user=linked_user,
            first_name=invitation.first_name,
            last_name=invitation.last_name,
            email=invitation.email,
            phone=invitation.phone,
            function=invitation.function,
            status=Member.Status.ACTIVE,
        )
    elif linked_user and not member.linked_user_id:
        member.linked_user = linked_user
        member.save(update_fields=["linked_user", "updated_at"])

    if linked_user:
        role = ensure_workspace_rbac(invitation.workspace)["MEMBER"]
        WorkspaceMembership.objects.update_or_create(
            user=linked_user,
            workspace=invitation.workspace,
            defaults={"role": role, "status": WorkspaceMembership.Status.ACTIVE, "joined_at": timezone.now()},
        )

    invitation.status = MemberInvitation.Status.ACCEPTED
    invitation.member = member
    invitation.accepted_by = linked_user
    invitation.accepted_at = timezone.now()
    invitation.save(update_fields=["status", "member", "accepted_by", "accepted_at", "updated_at"])
    log_membership_event(workspace=invitation.workspace, actor=linked_user, action="invitation.accepted", resource="member_invitation", resource_id=str(invitation.id), metadata={"member_id": member.id})
    return invitation


@transaction.atomic
def decline_invitation(*, token: str) -> MemberInvitation:
    invitation = get_invitation_by_token(token)
    if not invitation:
        raise ValueError("Invitation invalide.")
    invitation = MemberInvitation.objects.select_for_update().get(id=invitation.id)
    if invitation.status != MemberInvitation.Status.PENDING:
        raise ValueError("Cette invitation n'est plus active.")
    invitation.status = MemberInvitation.Status.DECLINED
    invitation.declined_at = timezone.now()
    invitation.save(update_fields=["status", "declined_at", "updated_at"])
    log_membership_event(workspace=invitation.workspace, actor=None, action="invitation.declined", resource="member_invitation", resource_id=str(invitation.id))
    return invitation


@transaction.atomic
def cancel_invitation(*, invitation: MemberInvitation, actor) -> MemberInvitation:
    invitation = MemberInvitation.objects.select_for_update().get(id=invitation.id)
    if invitation.status != MemberInvitation.Status.PENDING:
        raise ValueError("Cette invitation ne peut plus etre annulee.")
    invitation.status = MemberInvitation.Status.CANCELLED
    invitation.cancelled_at = timezone.now()
    invitation.save(update_fields=["status", "cancelled_at", "updated_at"])
    log_membership_event(workspace=invitation.workspace, actor=actor, action="invitation.cancelled", resource="member_invitation", resource_id=str(invitation.id))
    return invitation


@transaction.atomic
def resend_invitation(*, invitation: MemberInvitation, actor) -> tuple[MemberInvitation, str, str]:
    invitation = MemberInvitation.objects.select_for_update().get(id=invitation.id)
    if invitation.status not in [MemberInvitation.Status.PENDING, MemberInvitation.Status.EXPIRED]:
        raise ValueError("Cette invitation ne peut pas etre renvoyee.")
    settings = get_membership_settings(invitation.workspace)
    token = generate_invitation_token()
    invitation.token_hash = invitation_token_hash(token)
    invitation.status = MemberInvitation.Status.PENDING
    invitation.expires_at = timezone.now() + timedelta(days=settings.invitation_expiration_days)
    invitation.last_sent_at = timezone.now()
    invitation.save(update_fields=["token_hash", "status", "expires_at", "last_sent_at", "updated_at"])
    _user, temporary_password = ensure_invited_user_account(workspace=invitation.workspace, invitation=invitation, actor=actor, rotate_temporary_password=True)
    log_membership_event(workspace=invitation.workspace, actor=actor, action="invitation.resent", resource="member_invitation", resource_id=str(invitation.id))
    return invitation, token, temporary_password


def profile_completion(member: Member | MembershipApplication) -> dict:
    fields = ["first_name", "last_name", "email", "phone", "photo", "occupation"]
    completed = [field for field in fields if getattr(member, field, None)]
    return {"percentage": round((len(completed) / len(fields)) * 100), "completed": completed, "missing": [field for field in fields if field not in completed]}


def self_member_for_user(*, workspace: Workspace, user) -> Member | None:
    if not user or not getattr(user, "is_authenticated", False):
        return None
    member = Member.objects.select_related("workspace", "linked_user", "category").filter(workspace=workspace, linked_user=user).first()
    if member:
        return member
    return Member.objects.select_related("workspace", "linked_user", "category").filter(workspace=workspace, email__iexact=user.email).first()


def member_public_id(member: Member) -> str:
    return f"NOVEX-MEMBER:{member.workspace.slug}:{member.membership_number}"


@transaction.atomic
def update_self_member_profile(*, member: Member, actor, **data) -> Member:
    allowed_fields = {"first_name", "last_name", "email", "phone_country_code", "phone", "gender", "date_of_birth", "address", "city", "occupation", "photo", "custom_fields"}
    clean_data = {field: value for field, value in data.items() if field in allowed_fields}
    photo_updated = "photo" in clean_data
    for field, value in clean_data.items():
        setattr(member, field, value)
    member.save(update_fields=[*clean_data.keys(), "updated_at"] if clean_data else ["updated_at"])
    log_member_action(member=member, actor=actor, action="member.self_profile_updated", metadata={"fields": sorted(clean_data)})
    if photo_updated:
        log_member_action(member=member, actor=actor, action="member.photo_updated")
    return member


def currency_amount(value, currency: str) -> dict:
    return {"value": value or ZERO, "currency": currency}


def contribution_projection(contribution: Contribution) -> dict:
    return {
        "id": contribution.id,
        "campaign": contribution.campaign.name,
        "period_label": contribution.campaign.period_label,
        "amount_due": contribution.amount_due,
        "amount_paid": contribution.amount_paid,
        "remaining_amount": contribution.remaining_amount,
        "currency": contribution.currency,
        "due_date": contribution.due_date,
        "status": contribution.status,
        "paid_at": contribution.paid_at,
    }


def payment_projection(payment: Payment) -> dict:
    receipt = getattr(payment, "receipt", None)
    return {
        "id": payment.id,
        "reference": payment.reference,
        "amount": payment.amount,
        "currency": payment.currency,
        "method": payment.payment_method,
        "provider": payment.provider,
        "status": payment.status,
        "reason": payment.contribution.campaign.name if payment.contribution_id else "Paiement",
        "paid_at": payment.paid_at,
        "created_at": payment.created_at,
        "receipt_number": receipt.receipt_number if receipt else "",
        "receipt_url": receipt.pdf_file.url if receipt and receipt.pdf_file else receipt.pdf_url if receipt else "",
    }


def event_projection(participant: EventParticipant) -> dict:
    event = participant.event
    return {
        "id": event.id,
        "title": event.title,
        "start_at": event.start_at,
        "end_at": event.end_at,
        "location": event.location or event.city,
        "status": event.status,
        "participation_status": participant.status,
        "attendance_status": participant.attendance_status,
        "registration_required": event.registration_required,
    }


def member_visible_documents(*, workspace: Workspace, member: Member):
    return (
        Document.objects.filter(workspace=workspace, status__in=[DocumentStatus.ACTIVE, DocumentStatus.APPROVED])
        .filter(Q(member=member) | Q(visibility=DocumentVisibility.MEMBERS) | Q(shares__subject_type=ShareSubjectType.MEMBER, shares__member=member, shares__can_view=True))
        .distinct()
        .order_by("-updated_at")
    )


def document_projection(document: Document) -> dict:
    return {
        "id": document.id,
        "name": document.name,
        "file_type": document.file_type,
        "mime_type": document.mime_type,
        "size": document.size,
        "category": document.category,
        "visibility": document.visibility,
        "updated_at": document.updated_at,
        "can_preview": document.file_type.lower() in {"pdf", "jpg", "jpeg", "png", "webp"},
        "download_url": document.file.url if document.file else "",
    }


def history_date(value):
    if isinstance(value, datetime):
        return value
    return timezone.make_aware(datetime.combine(value, datetime.min.time()))


def member_history(*, workspace: Workspace, member: Member) -> list[dict]:
    rows = [
        {"date": history_date(member.join_date), "type": "membership", "title": "Vous avez rejoint l'association", "detail": workspace.name},
    ]
    rows.extend(
        {
            "date": payment.paid_at or payment.created_at,
            "type": "payment",
            "title": "Paiement enregistre",
            "detail": f"{payment.amount} {payment.currency}",
        }
        for payment in Payment.objects.filter(workspace=workspace, member=member, status=PaymentStatus.SUCCESS).order_by("-created_at")[:5]
    )
    rows.extend(
        {
            "date": participation.checked_in_at or participation.updated_at,
            "type": "event",
            "title": "Participation evenement",
            "detail": participation.event.title,
        }
        for participation in EventParticipant.objects.select_related("event").filter(workspace=workspace, member=member, attendance_status=EventParticipantStatus.ATTENDED).order_by("-updated_at")[:5]
    )
    rows.extend(
        {
            "date": activity.created_at,
            "type": "profile",
            "title": "Profil mis a jour",
            "detail": activity.action,
        }
        for activity in MemberActivity.objects.filter(workspace=workspace, member=member, action__in=["member.self_profile_updated", "member.photo_updated"]).order_by("-created_at")[:5]
    )
    return sorted(rows, key=lambda item: item["date"], reverse=True)[:12]


def member_dashboard(*, workspace: Workspace, member: Member) -> dict:
    contributions = Contribution.objects.select_related("campaign").filter(workspace=workspace, member=member).order_by("-due_date", "-created_at")
    payments = Payment.objects.select_related("contribution", "contribution__campaign", "receipt").filter(workspace=workspace, member=member).order_by("-created_at")
    participations = EventParticipant.objects.select_related("event").filter(workspace=workspace, member=member).order_by("event__start_at")
    documents = member_visible_documents(workspace=workspace, member=member)
    contribution_totals = contributions.aggregate(total_due=Sum("amount_due"), total_paid=Sum("amount_paid"))
    total_due = contribution_totals["total_due"] or ZERO
    total_paid = contribution_totals["total_paid"] or ZERO
    remaining = max(total_due - total_paid, ZERO)
    participation_total = participations.exclude(status=EventParticipantStatus.CANCELLED).count()
    attended = participations.filter(attendance_status=EventParticipantStatus.ATTENDED).count()
    absent = participations.filter(attendance_status=EventParticipantStatus.ABSENT).count()
    now = timezone.now()
    completion = profile_completion(member)
    alerts = []
    next_due = contributions.filter(status__in=[ContributionStatus.PENDING, ContributionStatus.PARTIALLY_PAID, ContributionStatus.OVERDUE]).order_by("due_date").first()
    if next_due:
        alerts.append({"type": "contribution", "message": f"Cotisation en attente: {next_due.campaign.name}", "amount": next_due.remaining_amount, "currency": next_due.currency})
    upcoming_event = participations.filter(event__start_at__gte=now).order_by("event__start_at").first()
    if upcoming_event:
        alerts.append({"type": "event", "message": f"Evenement a venir: {upcoming_event.event.title}", "date": upcoming_event.event.start_at})
    if completion["percentage"] < 100:
        alerts.append({"type": "profile", "message": f"Profil complete a {completion['percentage']} %."})
    return {
        "profile": {
            "id": member.id,
            "full_name": member.full_name,
            "first_name": member.first_name,
            "last_name": member.last_name,
            "function": member.function,
            "status": member.status,
            "membership_number": member.membership_number,
            "join_date": member.join_date,
            "photo": member.photo.url if member.photo else "",
            "public_member_id": member_public_id(member),
            "profile_completion": completion,
            "seniority": member_seniority(member),
        },
        "contribution_summary": {
            "total_due": currency_amount(total_due, workspace.currency),
            "total_paid": currency_amount(total_paid, workspace.currency),
            "remaining_to_pay": currency_amount(remaining, workspace.currency),
            "payment_rate": round((total_paid / total_due) * 100, 2) if total_due else 0,
            "overdue_count": contributions.filter(status=ContributionStatus.OVERDUE).count(),
            "next_due_date": next_due.due_date if next_due else None,
        },
        "contributions": [contribution_projection(item) for item in contributions[:8]],
        "payment_summary": {
            "total_paid": currency_amount(payments.filter(status=PaymentStatus.SUCCESS).aggregate(total=Sum("amount"))["total"] or ZERO, workspace.currency),
            "successful_count": payments.filter(status=PaymentStatus.SUCCESS).count(),
            "pending_count": payments.filter(status__in=[PaymentStatus.PENDING, PaymentStatus.PROCESSING]).count(),
            "failed_count": payments.filter(status=PaymentStatus.FAILED).count(),
        },
        "payments": [payment_projection(item) for item in payments[:8]],
        "attendance_summary": {
            "participated": attended,
            "missed": absent,
            "participation_rate": round((attended / participation_total) * 100, 2) if participation_total else 0,
        },
        "events": {
            "upcoming": [event_projection(item) for item in participations.filter(event__start_at__gte=now).exclude(event__status=EventStatus.CANCELLED)[:6]],
            "past": [event_projection(item) for item in participations.filter(event__start_at__lt=now).order_by("-event__start_at")[:6]],
        },
        "documents": [document_projection(item) for item in documents[:8]],
        "history": member_history(workspace=workspace, member=member),
        "alerts": alerts,
    }
