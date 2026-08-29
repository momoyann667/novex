from rest_framework import serializers

from .models import Member


class MemberSerializer(serializers.ModelSerializer):
    class Meta:
        model = Member
        fields = ["id", "workspace", "linked_user", "first_name", "last_name", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "workspace", "created_at", "updated_at"]
