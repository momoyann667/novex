from rest_framework import serializers

from .models import SupportTicket, SupportTicketCategory, SupportTicketMessage, SupportTicketStatus


class SupportTicketMessageSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = SupportTicketMessage
        fields = ["id", "author_name", "body", "is_admin_reply", "created_at"]

    def get_author_name(self, obj):
        if not obj.author:
            return "NOVEX"
        return obj.author.get_full_name() or obj.author.email


class SupportTicketSerializer(serializers.ModelSerializer):
    creator_name = serializers.SerializerMethodField()
    creator_email = serializers.EmailField(source="creator.email", read_only=True)
    workspace_name = serializers.CharField(source="workspace.name", read_only=True)
    workspace_slug = serializers.CharField(source="workspace.slug", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    category_label = serializers.CharField(source="get_category_display", read_only=True)
    taken_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()
    messages = SupportTicketMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id",
            "ticket_number",
            "workspace_name",
            "workspace_slug",
            "creator_name",
            "creator_email",
            "subject",
            "description",
            "category",
            "category_label",
            "status",
            "status_label",
            "taken_at",
            "taken_by_name",
            "resolved_at",
            "resolved_by_name",
            "last_activity_at",
            "created_at",
            "updated_at",
            "messages",
        ]
        read_only_fields = fields

    def get_creator_name(self, obj):
        return obj.creator.get_full_name() or obj.creator.email

    def get_taken_by_name(self, obj):
        return obj.taken_by.get_full_name() or obj.taken_by.email if obj.taken_by else ""

    def get_resolved_by_name(self, obj):
        return obj.resolved_by.get_full_name() or obj.resolved_by.email if obj.resolved_by else ""


class SupportTicketCreateSerializer(serializers.Serializer):
    subject = serializers.CharField(max_length=180)
    description = serializers.CharField()
    category = serializers.ChoiceField(choices=SupportTicketCategory.choices, default=SupportTicketCategory.OTHER, required=False)


class SupportTicketStatusSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=SupportTicketStatus.choices)


class SupportTicketReplySerializer(serializers.Serializer):
    body = serializers.CharField()
