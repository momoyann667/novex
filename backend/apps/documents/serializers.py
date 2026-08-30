from rest_framework import serializers

from apps.events.models import Event
from apps.finance.models import FinancialTransaction
from apps.members.models import Member
from apps.payments.models import Payment
from apps.projects.models import Project
from apps.workspaces.models import Role
from .models import (
    Document,
    DocumentAccessLog,
    DocumentActivity,
    DocumentApproval,
    DocumentFavorite,
    DocumentFolder,
    DocumentShare,
    DocumentShareLink,
    DocumentTag,
    DocumentVersion,
)
from .statuses import DocumentCategory, DocumentSensitivity, DocumentStatus, DocumentVisibility, ShareSubjectType


class DocumentFolderSerializer(serializers.ModelSerializer):
    breadcrumb = serializers.SerializerMethodField()

    class Meta:
        model = DocumentFolder
        fields = ["id", "name", "description", "parent", "color", "icon", "is_archived", "breadcrumb", "created_at", "updated_at"]
        read_only_fields = ["id", "breadcrumb", "created_at", "updated_at"]

    def get_breadcrumb(self, obj):
        items = []
        current = obj
        while current:
            items.append({"id": current.id, "name": current.name})
            current = current.parent
        return list(reversed(items))

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["parent"].queryset = DocumentFolder.objects.filter(workspace=workspace)


class DocumentTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentTag
        fields = ["id", "name", "created_at"]
        read_only_fields = ["id", "created_at"]


class DocumentVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentVersion
        fields = ["id", "version_number", "file", "original_filename", "file_type", "mime_type", "size", "checksum", "change_note", "uploaded_by", "restored_from", "created_at"]
        read_only_fields = ["id", "version_number", "original_filename", "file_type", "mime_type", "size", "checksum", "uploaded_by", "restored_from", "created_at"]


class DocumentShareSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentShare
        fields = ["id", "subject_type", "member", "role", "team", "can_view", "can_download", "can_edit", "can_share", "can_delete", "expires_at", "created_at"]
        read_only_fields = ["id", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)
            self.fields["role"].queryset = Role.objects.filter(workspace=workspace)

    def validate(self, attrs):
        subject_type = attrs.get("subject_type") or getattr(self.instance, "subject_type", None)
        if subject_type == ShareSubjectType.MEMBER and not attrs.get("member"):
            raise serializers.ValidationError({"member": "Le membre est requis pour ce partage."})
        if subject_type == ShareSubjectType.ROLE and not attrs.get("role"):
            raise serializers.ValidationError({"role": "Le role est requis pour ce partage."})
        if subject_type == ShareSubjectType.TEAM and not attrs.get("team"):
            raise serializers.ValidationError({"team": "Le nom d'equipe est requis pour ce partage."})
        return attrs


class DocumentShareLinkSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentShareLink
        fields = ["id", "token", "expires_at", "max_downloads", "download_count", "is_active", "created_at"]
        read_only_fields = ["id", "token", "download_count", "created_at"]


class DocumentApprovalSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentApproval
        fields = ["id", "approver", "level", "status", "deadline", "comment", "decided_at", "created_at"]
        read_only_fields = ["id", "status", "decided_at", "created_at"]


class DocumentActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentActivity
        fields = ["id", "action", "actor", "metadata", "created_at"]
        read_only_fields = ["id", "action", "actor", "metadata", "created_at"]


class DocumentAccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = DocumentAccessLog
        fields = ["id", "actor", "action", "created_at"]
        read_only_fields = ["id", "actor", "action", "created_at"]


class DocumentSerializer(serializers.ModelSerializer):
    tags = serializers.ListField(child=serializers.CharField(max_length=80), required=False, write_only=True)
    tag_names = serializers.SerializerMethodField()
    folder_name = serializers.CharField(source="folder.name", read_only=True)
    project_name = serializers.CharField(source="project.name", read_only=True)
    event_name = serializers.CharField(source="event.title", read_only=True)
    member_name = serializers.SerializerMethodField()
    is_favorite = serializers.SerializerMethodField()

    class Meta:
        model = Document
        fields = [
            "id",
            "name",
            "description",
            "file",
            "file_type",
            "mime_type",
            "size",
            "checksum",
            "original_filename",
            "category",
            "folder",
            "folder_name",
            "status",
            "visibility",
            "sensitivity",
            "tags",
            "tag_names",
            "project",
            "project_name",
            "event",
            "event_name",
            "financial_transaction",
            "payment",
            "member",
            "member_name",
            "current_version",
            "metadata",
            "retention_until",
            "uploaded_by",
            "is_favorite",
            "archived_at",
            "deleted_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "file_type", "mime_type", "size", "checksum", "original_filename", "current_version", "uploaded_by", "archived_at", "deleted_at", "created_at", "updated_at"]

    def get_tag_names(self, obj):
        return [tag.name for tag in obj.tags.all()]

    def get_member_name(self, obj):
        return str(obj.member) if obj.member else ""

    def get_is_favorite(self, obj):
        request = self.context.get("request")
        return bool(request and request.user.is_authenticated and obj.favorites.filter(user=request.user).exists())

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["folder"].queryset = DocumentFolder.objects.filter(workspace=workspace)
            self.fields["project"].queryset = Project.objects.filter(workspace=workspace)
            self.fields["event"].queryset = Event.objects.filter(workspace=workspace)
            self.fields["financial_transaction"].queryset = FinancialTransaction.objects.filter(workspace=workspace)
            self.fields["payment"].queryset = Payment.objects.filter(workspace=workspace)
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)

    def validate_category(self, value):
        if value not in DocumentCategory.values:
            raise serializers.ValidationError("Categorie documentaire invalide.")
        return value

    def validate_status(self, value):
        if value not in DocumentStatus.values:
            raise serializers.ValidationError("Statut documentaire invalide.")
        return value

    def validate_visibility(self, value):
        if value not in DocumentVisibility.values:
            raise serializers.ValidationError("Visibilite documentaire invalide.")
        return value

    def validate_sensitivity(self, value):
        if value not in DocumentSensitivity.values:
            raise serializers.ValidationError("Niveau de sensibilite invalide.")
        return value
