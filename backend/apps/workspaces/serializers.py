from rest_framework import serializers

from .models import Workspace
from .services import create_workspace_for_owner


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ["id", "name", "slug", "organization_type", "logo", "currency", "country", "city", "description", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "slug", "status", "created_at", "updated_at"]


class WorkspaceCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)
    organization_type = serializers.ChoiceField(choices=Workspace.OrganizationType.choices)
    currency = serializers.CharField(max_length=3, required=False, default="XOF")
    country = serializers.CharField(max_length=2, required=False, default="CI")
    city = serializers.CharField(max_length=120, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        return create_workspace_for_owner(owner=self.context["request"].user, **validated_data)
