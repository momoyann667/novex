from django.conf import settings
from django.db import models


class Workspace(models.Model):
    class OrganizationType(models.TextChoices):
        ASSOCIATION = "association", "Association"
        SYNDICAT = "syndicat", "Syndicat"
        ONG = "ong", "ONG"
        MUTUELLE = "mutuelle", "Mutuelle"
        COOPERATIVE = "cooperative", "Cooperative"
        AMICALE = "amicale", "Amicale"
        CLUB = "club", "Club"
        FOUNDATION = "foundation", "Fondation"
        COMMUNITY = "community", "Organisation communautaire"
        OTHER = "other", "Autre"

    class Status(models.TextChoices):
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        ARCHIVED = "archived", "Archived"

    name = models.CharField(max_length=180)
    slug = models.SlugField(unique=True, max_length=90)
    organization_type = models.CharField(max_length=32, choices=OrganizationType.choices)
    logo = models.ImageField(upload_to="workspace-logos/", blank=True)
    currency = models.CharField(max_length=3, default="XOF")
    country = models.CharField(max_length=2, default="CI")
    city = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="owned_workspaces")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self) -> str:
        return self.name


class Role(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="roles", null=True, blank=True)
    code = models.CharField(max_length=64)
    label = models.CharField(max_length=120)
    is_system = models.BooleanField(default=False)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "code"], name="uniq_role_workspace_code")]


class Permission(models.Model):
    code = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)

    def __str__(self) -> str:
        return self.code


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["role", "permission"], name="uniq_role_permission")]


class WorkspaceMembership(models.Model):
    class Status(models.TextChoices):
        INVITED = "invited", "Invited"
        ACTIVE = "active", "Active"
        SUSPENDED = "suspended", "Suspended"
        REMOVED = "removed", "Removed"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="workspace_memberships")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="memberships")
    role = models.ForeignKey(Role, on_delete=models.PROTECT)
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.ACTIVE)
    joined_at = models.DateTimeField(null=True, blank=True)
    invited_at = models.DateTimeField(null=True, blank=True)
    last_active_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "workspace"], name="uniq_user_workspace_membership")]
        indexes = [models.Index(fields=["workspace", "user", "status"])]


class OrganizationProfile(models.Model):
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="organization_profile")
    legal_name = models.CharField(max_length=180, blank=True)
    address = models.TextField(blank=True)
    contact_email = models.EmailField(blank=True)
    contact_phone = models.CharField(max_length=32, blank=True)
    website_url = models.URLField(blank=True)


class WorkspaceSettings(models.Model):
    workspace = models.OneToOneField(Workspace, on_delete=models.CASCADE, related_name="settings")
    acronym = models.CharField(max_length=32, blank=True)
    registration_number = models.CharField(max_length=80, blank=True)
    region = models.CharField(max_length=120, blank=True)
    founded_on = models.DateField(null=True, blank=True)
    primary_contact_name = models.CharField(max_length=160, blank=True)
    primary_contact_email = models.EmailField(blank=True)
    primary_contact_phone = models.CharField(max_length=32, blank=True)
    primary_contact_function = models.CharField(max_length=120, blank=True)
    timezone = models.CharField(max_length=64, default="Africa/Abidjan")
    language = models.CharField(max_length=8, default="fr")
    date_format = models.CharField(max_length=24, default="DD/MM/YYYY")
    money_format = models.JSONField(default=dict, blank=True)
    theme = models.CharField(max_length=16, default="light")
    primary_color = models.CharField(max_length=16, default="#0F7FF2")
    secondary_color = models.CharField(max_length=16, default="#3B82F6")
    finance_preferences = models.JSONField(default=dict, blank=True)
    contribution_preferences = models.JSONField(default=dict, blank=True)
    notification_preferences = models.JSONField(default=dict, blank=True)
    member_preferences = models.JSONField(default=dict, blank=True)
    project_preferences = models.JSONField(default=dict, blank=True)
    event_preferences = models.JSONField(default=dict, blank=True)
    document_preferences = models.JSONField(default=dict, blank=True)
    integration_states = models.JSONField(default=dict, blank=True)
    security_preferences = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace"])]
