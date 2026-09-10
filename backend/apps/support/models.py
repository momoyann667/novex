from django.conf import settings
from django.db import models

from apps.documents.models import Document
from apps.workspaces.models import Workspace


class SupportTicketCategory(models.TextChoices):
    TECHNICAL = "TECHNICAL", "Probleme technique"
    ACCOUNT = "ACCOUNT", "Compte"
    SUBSCRIPTION = "SUBSCRIPTION", "Abonnement"
    PAYMENT = "PAYMENT", "Paiement"
    FEATURE = "FEATURE", "Fonctionnalite"
    QUESTION = "QUESTION", "Question"
    OTHER = "OTHER", "Autre"


class SupportTicketStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    IN_PROGRESS = "IN_PROGRESS", "Pris en charge"
    RESOLVED = "RESOLVED", "Regle"


class SupportTicket(models.Model):
    ticket_number = models.CharField(max_length=32, unique=True)
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="support_tickets")
    creator = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="support_tickets")
    subject = models.CharField(max_length=180)
    description = models.TextField()
    category = models.CharField(max_length=24, choices=SupportTicketCategory.choices, default=SupportTicketCategory.OTHER)
    status = models.CharField(max_length=24, choices=SupportTicketStatus.choices, default=SupportTicketStatus.PENDING)
    attachments = models.ManyToManyField(Document, blank=True, related_name="support_tickets")
    taken_at = models.DateTimeField(null=True, blank=True)
    taken_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="taken_support_tickets")
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="resolved_support_tickets")
    last_activity_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["ticket_number"], name="support_sup_ticket__4a7d4b_idx"),
            models.Index(fields=["workspace", "-created_at"], name="support_sup_workspa_293e5c_idx"),
            models.Index(fields=["creator", "-created_at"], name="support_sup_creator_1bad88_idx"),
            models.Index(fields=["status", "-created_at"], name="support_sup_status_52a4ed_idx"),
            models.Index(fields=["last_activity_at"], name="support_sup_last_ac_1e3225_idx"),
        ]

    def __str__(self) -> str:
        return self.ticket_number


class SupportTicketMessage(models.Model):
    ticket = models.ForeignKey(SupportTicket, on_delete=models.CASCADE, related_name="messages")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="support_ticket_messages")
    body = models.TextField()
    is_admin_reply = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["ticket", "created_at"], name="support_sup_ticket__86cbdc_idx")]
