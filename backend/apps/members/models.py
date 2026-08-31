from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.workspaces.models import Workspace


class MemberCategory(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="member_categories")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "name"], name="uniq_member_category_workspace_name")]
        indexes = [models.Index(fields=["workspace", "name"])]

    def __str__(self) -> str:
        return self.name


class Member(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "active", "Actif"
        INACTIVE = "inactive", "Inactif"
        PENDING = "pending", "En attente"
        SUSPENDED = "suspended", "Suspendu"
        RESIGNED = "resigned", "Demissionnaire"
        EXCLUDED = "excluded", "Exclu"
        DECEASED = "deceased", "Decede"
        FORMER = "former", "Ancien"
        ARCHIVED = "archived", "Archive"

    class Gender(models.TextChoices):
        FEMALE = "female", "Femme"
        MALE = "male", "Homme"
        OTHER = "other", "Autre"
        UNSPECIFIED = "unspecified", "Non precise"

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="association_members")
    linked_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    membership_number = models.CharField(max_length=40)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    email = models.EmailField(blank=True)
    phone_country_code = models.CharField(max_length=8, blank=True)
    phone = models.CharField(max_length=32, blank=True)
    function = models.CharField(max_length=120, default="Membre")
    gender = models.CharField(max_length=20, choices=Gender.choices, default=Gender.UNSPECIFIED)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    occupation = models.CharField(max_length=160, blank=True)
    photo = models.ImageField(upload_to="members/", blank=True)
    join_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.ACTIVE)
    suspension_reason = models.TextField(blank=True)
    suspended_at = models.DateTimeField(null=True, blank=True)
    suspended_until = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    category = models.ForeignKey(MemberCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="members")
    custom_fields = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["workspace", "membership_number"], name="uniq_member_number_per_workspace"),
        ]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "created_at"]),
            models.Index(fields=["workspace", "phone"]),
            models.Index(fields=["workspace", "email"]),
            models.Index(fields=["workspace", "membership_number"]),
            models.Index(fields=["workspace", "last_name"]),
            models.Index(fields=["workspace", "join_date"]),
            models.Index(fields=["workspace", "function"]),
        ]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()

    @property
    def full_name(self) -> str:
        return str(self)

    @property
    def joined_at(self):
        return self.join_date


class MemberTag(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="member_tags")
    name = models.CharField(max_length=80)
    color = models.CharField(max_length=24, default="#0f7ff2")
    members = models.ManyToManyField(Member, blank=True, related_name="tags")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "name"], name="uniq_member_tag_workspace_name")]
        indexes = [models.Index(fields=["workspace", "name"])]

    def __str__(self) -> str:
        return self.name


class MemberGroup(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="member_groups")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    members = models.ManyToManyField(Member, blank=True, related_name="groups")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "name"], name="uniq_member_group_workspace_name")]
        indexes = [models.Index(fields=["workspace", "name"])]

    def __str__(self) -> str:
        return self.name


class MemberCustomFieldDefinition(models.Model):
    class FieldType(models.TextChoices):
        TEXT = "text", "Texte"
        NUMBER = "number", "Nombre"
        DATE = "date", "Date"
        BOOLEAN = "boolean", "Booleen"
        SELECT = "select", "Selection"
        MULTI_SELECT = "multi_select", "Selection multiple"

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="member_custom_field_definitions")
    name = models.CharField(max_length=120)
    field_type = models.CharField(max_length=24, choices=FieldType.choices, default=FieldType.TEXT)
    is_required = models.BooleanField(default=False)
    is_visible = models.BooleanField(default=True)
    options = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "name"], name="uniq_member_custom_field_workspace_name")]
        indexes = [models.Index(fields=["workspace", "name"]), models.Index(fields=["workspace", "field_type"])]

    def __str__(self) -> str:
        return self.name


class MemberActivity(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="member_activities")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "-created_at"]), models.Index(fields=["member", "-created_at"]), models.Index(fields=["action", "-created_at"])]
