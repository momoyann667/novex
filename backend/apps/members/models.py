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
    phone = models.CharField(max_length=32, blank=True)
    gender = models.CharField(max_length=20, choices=Gender.choices, default=Gender.UNSPECIFIED)
    date_of_birth = models.DateField(null=True, blank=True)
    address = models.TextField(blank=True)
    city = models.CharField(max_length=120, blank=True)
    occupation = models.CharField(max_length=160, blank=True)
    photo = models.ImageField(upload_to="members/", blank=True)
    join_date = models.DateField(default=timezone.localdate)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.ACTIVE)
    category = models.ForeignKey(MemberCategory, on_delete=models.SET_NULL, null=True, blank=True, related_name="members")
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
        ]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
