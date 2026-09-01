from rest_framework import serializers

from .models import AIConversation, AIMessage


class AIMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = AIMessage
        fields = ["id", "role", "content", "metadata", "created_at"]
        read_only_fields = fields


class AIConversationSerializer(serializers.ModelSerializer):
    messages = AIMessageSerializer(many=True, read_only=True)

    class Meta:
        model = AIConversation
        fields = ["id", "title", "module", "summary", "created_at", "updated_at", "messages"]
        read_only_fields = ["id", "summary", "created_at", "updated_at", "messages"]


class AIConversationCreateSerializer(serializers.Serializer):
    title = serializers.CharField(required=False, allow_blank=True, max_length=180)
    module = serializers.CharField(required=False, allow_blank=True, max_length=80)


class AIMessageCreateSerializer(serializers.Serializer):
    content = serializers.CharField(min_length=1, max_length=4000)
    module = serializers.CharField(required=False, allow_blank=True, max_length=80)
