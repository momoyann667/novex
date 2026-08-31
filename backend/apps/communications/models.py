from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.documents.models import Document
from apps.members.models import Member
from apps.workspaces.models import Workspace


class CommunicationType(models.TextChoices):
    ANNOUNCEMENT = "ANNOUNCEMENT", "Annonce"
    BROADCAST = "BROADCAST", "Message collectif"
    DIRECT_NOTIFICATION = "DIRECT_NOTIFICATION", "Notification directe"
    SYSTEM_NOTIFICATION = "SYSTEM_NOTIFICATION", "Notification systeme"


class CommunicationStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    SCHEDULED = "SCHEDULED", "Programmee"
    PROCESSING = "PROCESSING", "En cours"
    SENT = "SENT", "Envoyee"
    PARTIALLY_SENT = "PARTIALLY_SENT", "Partiellement envoyee"
    FAILED = "FAILED", "Echec"
    CANCELLED = "CANCELLED", "Annulee"


class CommunicationRecipientStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    SENT = "SENT", "Envoyee"
    DELIVERED = "DELIVERED", "Delivree"
    READ = "READ", "Lue"
    FAILED = "FAILED", "Echec"


class CommunicationChannel(models.TextChoices):
    IN_APP = "IN_APP", "In-app"
    PUSH = "PUSH", "Push"
    EMAIL = "EMAIL", "Email"
    SMS = "SMS", "SMS"
    WHATSAPP = "WHATSAPP", "WhatsApp"


class CommunicationPriority(models.TextChoices):
    LOW = "LOW", "Faible"
    NORMAL = "NORMAL", "Normale"
    HIGH = "HIGH", "Haute"
    URGENT = "URGENT", "Urgente"


class CommunicationCategory(models.TextChoices):
    GENERAL = "GENERAL", "General"
    EVENT = "EVENT", "Evenement"
    FINANCE = "FINANCE", "Finance"
    ADMINISTRATION = "ADMINISTRATION", "Administration"
    DOCUMENT = "DOCUMENT", "Document"
    SECURITY = "SECURITY", "Securite"
    SYSTEM = "SYSTEM", "Systeme"


class AudienceType(models.TextChoices):
    ALL_MEMBERS = "ALL_MEMBERS", "Tous les membres"
    ACTIVE_MEMBERS = "ACTIVE_MEMBERS", "Membres actifs"
    CATEGORY = "CATEGORY", "Categorie"
    FUNCTION = "FUNCTION", "Fonction"
    SEGMENT = "SEGMENT", "Segment"
    SELECTED_MEMBERS = "SELECTED_MEMBERS", "Membres selectionnes"


class Communication(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="communications")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="created_communications")
    communication_type = models.CharField(max_length=32, choices=CommunicationType.choices, default=CommunicationType.BROADCAST)
    title = models.CharField(max_length=180)
    content = models.TextField()
    category = models.CharField(max_length=32, choices=CommunicationCategory.choices, default=CommunicationCategory.GENERAL)
    priority = models.CharField(max_length=16, choices=CommunicationPriority.choices, default=CommunicationPriority.NORMAL)
    status = models.CharField(max_length=24, choices=CommunicationStatus.choices, default=CommunicationStatus.DRAFT)
    audience_type = models.CharField(max_length=32, choices=AudienceType.choices, default=AudienceType.ACTIVE_MEMBERS)
    audience_filters = models.JSONField(default=dict, blank=True)
    audience_snapshot = models.JSONField(default=dict, blank=True)
    channels = models.JSONField(default=list, blank=True)
    deep_link = models.CharField(max_length=255, blank=True)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    timezone = models.CharField(max_length=64, default="UTC")
    provider_metadata = models.JSONField(default=dict, blank=True)
    attachments = models.ManyToManyField(Document, blank=True, related_name="communications")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "communication_type"]),
            models.Index(fields=["workspace", "scheduled_at"]),
            models.Index(fields=["workspace", "-created_at"]),
        ]

    def __str__(self) -> str:
        return self.title


class CommunicationRecipient(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="communication_recipients")
    communication = models.ForeignKey(Communication, on_delete=models.CASCADE, related_name="recipients")
    member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="communication_recipients")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="communication_recipients")
    channel = models.CharField(max_length=16, choices=CommunicationChannel.choices)
    status = models.CharField(max_length=16, choices=CommunicationRecipientStatus.choices, default=CommunicationRecipientStatus.PENDING)
    idempotency_key = models.CharField(max_length=180)
    sent_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)
    read_at = models.DateTimeField(null=True, blank=True)
    failure_reason = models.TextField(blank=True)
    retry_count = models.PositiveSmallIntegerField(default=0)
    last_attempt_at = models.DateTimeField(null=True, blank=True)
    provider_message_id = models.CharField(max_length=180, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "idempotency_key"], name="uniq_communication_recipient_idempotency")]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "channel", "status"]),
            models.Index(fields=["workspace", "member", "-created_at"]),
            models.Index(fields=["workspace", "user", "-created_at"]),
            models.Index(fields=["communication", "status"]),
        ]

    def mark_read(self):
        self.status = CommunicationRecipientStatus.READ
        self.read_at = timezone.now()
        self.save(update_fields=["status", "read_at", "updated_at"])


class NotificationPreference(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="notification_preferences")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, null=True, blank=True, related_name="notification_preferences")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, null=True, blank=True, related_name="notification_preferences")
    category = models.CharField(max_length=32, choices=CommunicationCategory.choices, default=CommunicationCategory.GENERAL)
    email_enabled = models.BooleanField(default=True)
    push_enabled = models.BooleanField(default=True)
    sms_enabled = models.BooleanField(default=False)
    whatsapp_enabled = models.BooleanField(default=False)
    administrative_enabled = models.BooleanField(default=True)
    marketing_enabled = models.BooleanField(default=False)
    system_enabled = models.BooleanField(default=True)
    security_enabled = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "member"]), models.Index(fields=["workspace", "user"])]


class CommunicationTemplate(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="communication_templates")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    name = models.CharField(max_length=140)
    communication_type = models.CharField(max_length=32, choices=CommunicationType.choices, default=CommunicationType.BROADCAST)
    subject = models.CharField(max_length=180)
    content = models.TextField()
    category = models.CharField(max_length=32, choices=CommunicationCategory.choices, default=CommunicationCategory.GENERAL)
    variables = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "name"], name="uniq_communication_template_workspace_name")]
        indexes = [models.Index(fields=["workspace", "is_active"]), models.Index(fields=["workspace", "communication_type"])]

    def __str__(self) -> str:
        return self.name
