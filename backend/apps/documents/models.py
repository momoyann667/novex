from uuid import uuid4

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.events.models import Event
from apps.finance.models import FinancialTransaction
from apps.members.models import Member
from apps.payments.models import Payment
from apps.projects.models import Project
from apps.workspaces.models import Role, Workspace
from .statuses import (
    ApprovalStatus,
    DocumentActivityAction,
    DocumentCategory,
    DocumentSensitivity,
    DocumentStatus,
    DocumentVisibility,
    ShareSubjectType,
)


def secure_document_upload_path(instance, filename: str) -> str:
    extension = filename.rsplit(".", 1)[-1].lower() if "." in filename else "bin"
    workspace_id = getattr(instance, "workspace_id", None) or getattr(getattr(instance, "document", None), "workspace_id", "unknown")
    return f"documents/{workspace_id}/{uuid4().hex}.{extension}"


def secure_share_token() -> str:
    return uuid4().hex + uuid4().hex


class DocumentFolder(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_folders")
    name = models.CharField(max_length=140)
    description = models.TextField(blank=True)
    parent = models.ForeignKey("self", on_delete=models.CASCADE, null=True, blank=True, related_name="children")
    color = models.CharField(max_length=24, blank=True)
    icon = models.CharField(max_length=40, blank=True)
    is_archived = models.BooleanField(default=False)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "parent", "name"], name="uniq_document_folder_workspace_parent_name")]
        indexes = [models.Index(fields=["workspace", "parent"]), models.Index(fields=["workspace", "is_archived"])]

    def __str__(self) -> str:
        return self.name


class DocumentTag(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_tags")
    name = models.CharField(max_length=80)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "name"], name="uniq_document_tag_workspace_name")]
        indexes = [models.Index(fields=["workspace", "name"])]

    def __str__(self) -> str:
        return self.name


class Document(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="documents")
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to=secure_document_upload_path, blank=True)
    file_type = models.CharField(max_length=24)
    mime_type = models.CharField(max_length=120)
    size = models.PositiveBigIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True)
    original_filename = models.CharField(max_length=255, blank=True)
    category = models.CharField(max_length=32, choices=DocumentCategory.choices, default=DocumentCategory.OTHER)
    folder = models.ForeignKey(DocumentFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name="documents")
    previous_folder = models.ForeignKey(DocumentFolder, on_delete=models.SET_NULL, null=True, blank=True, related_name="trashed_documents")
    status = models.CharField(max_length=24, choices=DocumentStatus.choices, default=DocumentStatus.ACTIVE)
    visibility = models.CharField(max_length=24, choices=DocumentVisibility.choices, default=DocumentVisibility.PRIVATE)
    sensitivity = models.CharField(max_length=24, choices=DocumentSensitivity.choices, default=DocumentSensitivity.NORMAL)
    tags = models.ManyToManyField(DocumentTag, blank=True, related_name="documents")
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="ged_documents")
    event = models.ForeignKey(Event, on_delete=models.SET_NULL, null=True, blank=True, related_name="ged_documents")
    financial_transaction = models.ForeignKey(FinancialTransaction, on_delete=models.SET_NULL, null=True, blank=True, related_name="ged_documents")
    payment = models.ForeignKey(Payment, on_delete=models.SET_NULL, null=True, blank=True, related_name="ged_documents")
    member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="ged_documents")
    current_version = models.PositiveIntegerField(default=0)
    extracted_text = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    retention_until = models.DateField(null=True, blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="uploaded_documents")
    archived_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "category"]),
            models.Index(fields=["workspace", "folder"]),
            models.Index(fields=["workspace", "visibility"]),
            models.Index(fields=["workspace", "sensitivity"]),
            models.Index(fields=["workspace", "project"]),
            models.Index(fields=["workspace", "event"]),
            models.Index(fields=["workspace", "financial_transaction"]),
            models.Index(fields=["workspace", "uploaded_by"]),
            models.Index(fields=["workspace", "-updated_at"]),
            models.Index(fields=["workspace", "-created_at"]),
        ]

    @property
    def is_sensitive(self) -> bool:
        return self.sensitivity == DocumentSensitivity.SENSITIVE

    def mark_archived(self) -> None:
        self.status = DocumentStatus.ARCHIVED
        self.archived_at = timezone.now()


class DocumentVersion(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_versions")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="versions")
    version_number = models.PositiveIntegerField()
    file = models.FileField(upload_to=secure_document_upload_path)
    original_filename = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=24)
    mime_type = models.CharField(max_length=120)
    size = models.PositiveBigIntegerField(default=0)
    checksum = models.CharField(max_length=64, blank=True)
    change_note = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    restored_from = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="restore_versions")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["document", "version_number"], name="uniq_document_version_number")]
        indexes = [models.Index(fields=["workspace", "document", "-version_number"])]


class DocumentShare(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_shares")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="shares")
    subject_type = models.CharField(max_length=16, choices=ShareSubjectType.choices)
    member = models.ForeignKey(Member, on_delete=models.CASCADE, null=True, blank=True, related_name="document_shares")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, null=True, blank=True, related_name="document_shares")
    team = models.CharField(max_length=120, blank=True)
    can_view = models.BooleanField(default=True)
    can_download = models.BooleanField(default=False)
    can_edit = models.BooleanField(default=False)
    can_share = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)
    expires_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "document"]), models.Index(fields=["workspace", "subject_type"])]


class DocumentShareLink(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_share_links")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="share_links")
    token = models.CharField(max_length=96, unique=True, default=secure_share_token)
    expires_at = models.DateTimeField(null=True, blank=True)
    password_hash = models.CharField(max_length=160, blank=True)
    max_downloads = models.PositiveIntegerField(null=True, blank=True)
    download_count = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "document", "is_active"])]


class DocumentFavorite(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_favorites")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="favorites")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="document_favorites")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["document", "user"], name="uniq_document_favorite_user")]
        indexes = [models.Index(fields=["workspace", "user", "-created_at"])]


class DocumentAccessLog(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_access_logs")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="access_logs")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "document", "-created_at"]), models.Index(fields=["workspace", "actor", "-created_at"])]


class DocumentActivity(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_activities")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, null=True, blank=True, related_name="activities")
    folder = models.ForeignKey(DocumentFolder, on_delete=models.CASCADE, null=True, blank=True, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120, choices=DocumentActivityAction.choices)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "document", "-created_at"]), models.Index(fields=["action", "-created_at"])]


class DocumentApproval(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="document_approvals")
    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name="approvals")
    approver = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="document_approvals")
    level = models.PositiveSmallIntegerField(default=1)
    status = models.CharField(max_length=24, choices=ApprovalStatus.choices, default=ApprovalStatus.PENDING)
    deadline = models.DateField(null=True, blank=True)
    comment = models.TextField(blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "document", "status"]), models.Index(fields=["workspace", "approver", "status"])]
