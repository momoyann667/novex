from django.conf import settings
from django.db import models

from apps.workspaces.models import Workspace


class Member(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="association_members")
    linked_user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    status = models.CharField(max_length=24, default="active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "status"]), models.Index(fields=["workspace", "created_at"])]

    def __str__(self) -> str:
        return f"{self.first_name} {self.last_name}".strip()
