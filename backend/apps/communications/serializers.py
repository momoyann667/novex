from rest_framework import serializers

from apps.documents.models import Document
from .models import (
    AudienceType,
    Communication,
    CommunicationCategory,
    CommunicationChannel,
    CommunicationPriority,
    CommunicationRecipient,
    CommunicationStatus,
    CommunicationTemplate,
    CommunicationType,
)


class CommunicationRecipientSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source="member.full_name", read_only=True)
    communication_title = serializers.CharField(source="communication.title", read_only=True)

    class Meta:
        model = CommunicationRecipient
        fields = [
            "id",
            "communication",
            "communication_title",
            "member",
            "member_name",
            "user",
            "channel",
            "status",
            "sent_at",
            "delivered_at",
            "read_at",
            "failure_reason",
            "retry_count",
            "created_at",
        ]
        read_only_fields = fields


class CommunicationSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.__str__", read_only=True)
    recipients_count = serializers.IntegerField(source="recipients.count", read_only=True)
    attachments = serializers.PrimaryKeyRelatedField(many=True, queryset=Document.objects.none(), required=False)

    class Meta:
        model = Communication
        fields = [
            "id",
            "workspace",
            "created_by",
            "created_by_name",
            "communication_type",
            "title",
            "content",
            "category",
            "priority",
            "status",
            "audience_type",
            "audience_filters",
            "audience_snapshot",
            "channels",
            "deep_link",
            "scheduled_at",
            "sent_at",
            "timezone",
            "provider_metadata",
            "attachments",
            "recipients_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "created_by", "created_by_name", "status", "audience_snapshot", "sent_at", "provider_metadata", "recipients_count", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["attachments"].queryset = Document.objects.filter(workspace=workspace)

    def validate_communication_type(self, value):
        if value not in CommunicationType.values:
            raise serializers.ValidationError("Type de communication invalide.")
        return value

    def validate_audience_type(self, value):
        if value not in AudienceType.values:
            raise serializers.ValidationError("Audience invalide.")
        return value

    def validate_channels(self, value):
        if not value:
            return [CommunicationChannel.IN_APP]
        invalid = [channel for channel in value if channel not in CommunicationChannel.values]
        if invalid:
            raise serializers.ValidationError(f"Canal invalide: {', '.join(invalid)}")
        return value

    def validate(self, attrs):
        if not attrs.get("title", getattr(self.instance, "title", "")):
            raise serializers.ValidationError({"title": "Le titre est requis."})
        if not attrs.get("content", getattr(self.instance, "content", "")):
            raise serializers.ValidationError({"content": "Le contenu est requis."})
        return attrs


class CommunicationActionSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField(required=False)
    send_now = serializers.BooleanField(default=True)


class AudiencePreviewSerializer(serializers.Serializer):
    audience_type = serializers.ChoiceField(choices=AudienceType.choices)
    audience_filters = serializers.JSONField(default=dict, required=False)
    channels = serializers.ListField(child=serializers.ChoiceField(choices=CommunicationChannel.choices), default=[CommunicationChannel.IN_APP], required=False)


class CommunicationDashboardSerializer(serializers.Serializer):
    stats = serializers.DictField()
    messages_this_month = serializers.IntegerField()
    scheduled = serializers.IntegerField()
    touched_members = serializers.IntegerField()
    activity = serializers.ListField()


class CommunicationTemplateSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source="created_by.__str__", read_only=True)

    class Meta:
        model = CommunicationTemplate
        fields = ["id", "workspace", "created_by", "created_by_name", "name", "communication_type", "subject", "content", "category", "variables", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "workspace", "created_by", "created_by_name", "variables", "created_at", "updated_at"]

    def validate_communication_type(self, value):
        if value not in CommunicationType.values:
            raise serializers.ValidationError("Type de modele invalide.")
        return value

    def validate_category(self, value):
        if value not in CommunicationCategory.values:
            raise serializers.ValidationError("Categorie invalide.")
        return value

    def validate(self, attrs):
        if not attrs.get("subject", getattr(self.instance, "subject", "")):
            raise serializers.ValidationError({"subject": "Le sujet est requis."})
        if not attrs.get("content", getattr(self.instance, "content", "")):
            raise serializers.ValidationError({"content": "Le contenu est requis."})
        return attrs


class CommunicationChoicesSerializer(serializers.Serializer):
    types = serializers.ListField()
    statuses = serializers.ListField()
    channels = serializers.ListField()
    priorities = serializers.ListField()
    categories = serializers.ListField()
    audiences = serializers.ListField()
