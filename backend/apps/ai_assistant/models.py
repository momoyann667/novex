from django.conf import settings
from django.db import models

from apps.workspaces.models import Workspace


class AIConversation(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="ai_conversations")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_conversations")
    title = models.CharField(max_length=180)
    module = models.CharField(max_length=80, blank=True)
    summary = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "user", "-updated_at"]),
            models.Index(fields=["workspace", "-created_at"]),
        ]

    def __str__(self) -> str:
        return self.title


class AIMessage(models.Model):
    class Role(models.TextChoices):
        USER = "user", "Utilisateur"
        ASSISTANT = "assistant", "Assistant"
        SYSTEM = "system", "Systeme"
        TOOL = "tool", "Outil"

    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="ai_messages")
    conversation = models.ForeignKey(AIConversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=16, choices=Role.choices)
    content = models.TextField()
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "conversation", "created_at"]),
            models.Index(fields=["workspace", "role", "-created_at"]),
        ]


class AIUsageLog(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="ai_usage_logs")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="ai_usage_logs")
    conversation = models.ForeignKey(AIConversation, on_delete=models.SET_NULL, null=True, blank=True, related_name="usage_logs")
    provider = models.CharField(max_length=40, default="local")
    model = models.CharField(max_length=80, blank=True)
    request_count = models.PositiveIntegerField(default=1)
    prompt_tokens = models.PositiveIntegerField(default=0)
    completion_tokens = models.PositiveIntegerField(default=0)
    estimated_cost = models.DecimalField(max_digits=12, decimal_places=6, default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "user", "-created_at"]),
            models.Index(fields=["workspace", "-created_at"]),
        ]
