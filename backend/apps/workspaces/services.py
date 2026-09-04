from django.db import transaction
from django.utils import timezone
from django.utils.text import slugify

from apps.subscriptions.services import ensure_workspace_subscription
from .models import OrganizationProfile, Permission, Role, RolePermission, Workspace, WorkspaceMembership, WorkspaceSettings


SYSTEM_ROLES = {
    "CREATOR": "Createur",
    "OWNER": "Proprietaire",
    "ADMIN": "Administrateur",
    "PRESIDENT": "President",
    "TREASURER": "Tresorier",
    "SECRETARY": "Secretaire",
    "PROJECT_MANAGER": "Responsable projet",
    "MEMBER": "Membre",
}

WORKSPACE_PERMISSIONS = {
    "*": "Acces complet au workspace",
    "workspace.view": "Voir le workspace",
    "settings.view": "Voir les parametres",
    "settings.manage": "Gerer les parametres",
    "member.profile.view_self": "Voir son espace membre",
    "member.profile.update_self": "Modifier son profil membre",
    "security.change_password": "Modifier son mot de passe",
    "members.view": "Voir les membres",
    "members.create": "Creer des membres",
    "members.update": "Modifier les membres",
    "members.archive": "Archiver les membres",
    "members.restore": "Restaurer les membres",
    "members.delete": "Supprimer definitivement les membres",
    "members.export": "Exporter les membres",
    "members.manage_custom_fields": "Gerer les champs personnalises membres",
    "members.applications.view": "Voir les demandes d'adhesion",
    "members.applications.review": "Prendre en charge les demandes d'adhesion",
    "members.applications.approve": "Approuver les demandes d'adhesion",
    "members.applications.reject": "Refuser les demandes d'adhesion",
    "members.invitations.create": "Inviter des membres",
    "members.invitations.cancel": "Annuler les invitations membres",
    "members.invitations.resend": "Renvoyer les invitations membres",
    "members.onboarding.manage": "Gerer les parametres d'adhesion",
    "subscriptions.view": "Voir l'abonnement",
    "subscriptions.manage": "Gerer l'abonnement",
    "billing.view": "Voir la facturation",
    "billing.manage": "Gerer la facturation",
    "communication.view": "Voir les communications",
    "communication.create": "Creer une communication",
    "communication.edit": "Modifier une communication",
    "communication.delete": "Supprimer une communication",
    "communication.send": "Envoyer une communication",
    "communication.schedule": "Programmer une communication",
    "communication.cancel": "Annuler une communication",
    "communication.view_stats": "Voir les statistiques de communication",
    "communication.manage_templates": "Gerer les modeles de communication",
    "contributions.view": "Voir les cotisations",
    "contributions.create": "Creer des cotisations",
    "contributions.update": "Modifier les cotisations",
    "contributions.cancel": "Annuler les cotisations",
    "contributions.manage": "Gerer les cotisations",
    "contributions.view_reports": "Voir les rapports de cotisations",
    "contributions.record_payment": "Enregistrer un paiement de cotisation",
    "contributions.waive": "Exonerer une cotisation",
    "payments.view": "Voir les paiements du workspace",
    "payments.view_self": "Voir et payer ses propres cotisations",
    "payments.view_details": "Voir les details d'un paiement",
    "payments.manage": "Gerer les paiements",
    "payments.refund": "Rembourser un paiement",
    "payment_documents.view": "Voir les justificatifs de paiement",
    "payment_documents.upload": "Ajouter un justificatif de paiement",
    "payment_documents.delete": "Supprimer un justificatif de paiement",
    "receipts.view": "Voir les recus",
    "receipts.download": "Telecharger les recus",
    "receipts.send": "Envoyer les recus",
    "financial_history.view": "Voir l'historique financier",
    "financial_adjustments.manage": "Gerer les ajustements financiers",
    "finance.view": "Voir les finances",
    "finance.view_reports": "Voir les rapports financiers",
    "finance.create_income": "Creer une recette",
    "finance.create_expense": "Creer une depense",
    "finance.update": "Modifier les finances",
    "finance.delete": "Supprimer une transaction",
    "finance.validate": "Valider une transaction",
    "finance.manage_categories": "Gerer les categories financieres",
    "finance.close_period": "Cloturer une periode",
    "budgets.view": "Voir les budgets",
    "budgets.create": "Creer des budgets",
    "budgets.update": "Modifier les budgets",
    "budgets.activate": "Activer les budgets",
    "budgets.close": "Cloturer les budgets",
    "budgets.archive": "Archiver les budgets",
    "budgets.assign_expense": "Affecter une depense a un budget",
    "budgets.export": "Exporter les budgets",
    "budgets.manage_alerts": "Gerer les alertes budgetaires",
    "projects.view": "Voir les projets",
    "projects.create": "Creer des projets",
    "projects.update": "Modifier les projets",
    "projects.delete": "Supprimer les projets",
    "projects.manage_team": "Gerer l'equipe projet",
    "projects.manage_tasks": "Gerer les taches projet",
    "projects.manage_finance": "Gerer les finances projet",
    "projects.export": "Exporter les projets",
    "events.view": "Voir les evenements",
    "events.create": "Creer des evenements",
    "events.update": "Modifier les evenements",
    "events.delete": "Supprimer les evenements",
    "events.publish": "Publier les evenements",
    "events.cancel": "Annuler les evenements",
    "events.manage_participants": "Gerer les participants",
    "events.manage_attendance": "Gerer les presences",
    "events.manage_team": "Gerer l'equipe evenement",
    "events.manage_tickets": "Gerer les billets",
    "events.manage_finance": "Gerer les finances evenement",
    "events.manage_budget": "Gerer le budget evenement",
    "events.manage_documents": "Gerer les documents evenement",
    "events.manage_feedback": "Gerer les retours evenement",
    "events.export": "Exporter les evenements",
    "documents.view": "Voir les documents",
    "documents.download": "Telecharger les documents",
    "documents.create": "Creer les documents",
    "documents.update": "Modifier les documents",
    "documents.delete": "Supprimer les documents",
    "documents.archive": "Archiver les documents",
    "documents.restore": "Restaurer les documents",
    "documents.manage_versions": "Gerer les versions de documents",
    "documents.share": "Partager les documents",
    "documents.approve": "Approuver les documents",
    "documents.permanent_delete": "Supprimer definitivement les documents",
    "documents.export": "Exporter les documents",
    "reports.view": "Voir les rapports",
    "reports.manage": "Gerer les rapports",
    "reports.share": "Partager les rapports",
    "reports.schedule": "Programmer les rapports",
    "reports.export": "Exporter les rapports",
    "reports.finance": "Voir les rapports financiers",
    "reports.members": "Voir les rapports membres",
    "reports.contributions": "Voir les rapports cotisations",
    "reports.projects": "Voir les rapports projets",
    "reports.events": "Voir les rapports evenements",
    "reports.documents": "Voir les rapports documents",
    "assistant.view": "Utiliser l'assistant IA",
}

MEMBER_PERMISSIONS = WORKSPACE_PERMISSIONS

CREATOR_PERMISSIONS = {"*"}
ALL_CONCRETE_PERMISSIONS = set(WORKSPACE_PERMISSIONS) - {"*"}

ASSOCIATION_MEMBER_PERMISSIONS = {
    "workspace.view",
    "member.profile.view_self",
    "member.profile.update_self",
    "security.change_password",
    "communication.view",
    "events.view",
    "documents.view",
    "documents.download",
    "payments.view_self",
}

ROLE_MEMBER_PERMISSIONS = {
    "CREATOR": set(CREATOR_PERMISSIONS),
    "OWNER": set(CREATOR_PERMISSIONS),
    "ADMIN": set(ALL_CONCRETE_PERMISSIONS),
    "PRESIDENT": set(ALL_CONCRETE_PERMISSIONS) - {"members.delete"},
    "SECRETARY": {"members.view", "members.create", "members.update", "members.export", "members.applications.view", "members.applications.review", "members.invitations.create", "members.invitations.resend"},
    "TREASURER": {"members.view", "members.export"},
    "PROJECT_MANAGER": {"members.view"},
    "MEMBER": set(ASSOCIATION_MEMBER_PERMISSIONS),
}


def ensure_workspace_rbac(workspace: Workspace) -> dict[str, Role]:
    roles = {role.code: role for role in Role.objects.filter(workspace=workspace)}
    for code, label in SYSTEM_ROLES.items():
        role, _created = Role.objects.get_or_create(workspace=workspace, code=code, defaults={"label": label, "is_system": True})
        if role.label != label or not role.is_system:
            role.label = label
            role.is_system = True
            role.save(update_fields=["label", "is_system"])
        roles[code] = role
    permissions = {code: Permission.objects.get_or_create(code=code, defaults={"description": description})[0] for code, description in WORKSPACE_PERMISSIONS.items()}
    for role_code, permission_codes in ROLE_MEMBER_PERMISSIONS.items():
        role = roles[role_code]
        for permission_code in permission_codes:
            RolePermission.objects.get_or_create(role=role, permission=permissions[permission_code])
    return roles


@transaction.atomic
def create_workspace_for_owner(*, owner, name: str, organization_type: str, **attrs) -> Workspace:
    slug = unique_workspace_slug(name)
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
    ensure_workspace_settings(workspace)
    roles = ensure_workspace_rbac(workspace)
    WorkspaceMembership.objects.create(user=owner, workspace=workspace, role=roles["CREATOR"], status=WorkspaceMembership.Status.ACTIVE, joined_at=timezone.now())
    ensure_workspace_subscription(workspace)
    from apps.documents.services import ensure_default_folders

    ensure_default_folders(workspace, actor=owner)
    return workspace


def ensure_workspace_settings(workspace: Workspace) -> WorkspaceSettings:
    settings, _created = WorkspaceSettings.objects.get_or_create(
        workspace=workspace,
        defaults={
            "money_format": {"thousand_separator": " ", "decimals": 0, "symbol_position": "after"},
            "finance_preferences": {"expense_validation_enabled": True, "income_validation_enabled": False},
            "contribution_preferences": {"periodicity": "MONTHLY", "due_day": 30, "reminders": ["before_due", "due_day", "after_due"]},
            "notification_preferences": {
                "channels": {"in_app": True, "email": True, "sms": False, "whatsapp": False},
                "topics": {"contributions": True, "payments": True, "events": True, "projects": True, "documents": True, "members": True, "reports": True, "security": True},
            },
            "member_preferences": {"manual_approval": True, "required_fields": ["first_name", "last_name", "email"]},
            "project_preferences": {"budget_alert_threshold": 80},
            "event_preferences": {"default_reminders": [1440, 60], "attendance_confirmation": True},
            "document_preferences": {"retention_months": 60, "sensitive_documents_require_review": True},
            "integration_states": {"payment": "connected", "email": "connected", "sms": "not_connected", "whatsapp": "not_connected"},
            "security_preferences": {"two_factor_available": False, "session_review_available": False},
        },
    )
    return settings


def unique_workspace_slug(name: str, *, exclude_id: int | None = None) -> str:
    base_slug = slugify(name)[:80] or "workspace"
    slug = base_slug
    suffix = 2
    queryset = Workspace.objects.all()
    if exclude_id:
        queryset = queryset.exclude(id=exclude_id)
    while queryset.filter(slug=slug).exists():
        suffix_text = f"-{suffix}"
        slug = f"{base_slug[: 90 - len(suffix_text)]}{suffix_text}"
        suffix += 1
    return slug
