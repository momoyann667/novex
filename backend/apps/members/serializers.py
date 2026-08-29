from rest_framework import serializers

from .models import Member, MemberCategory


class MemberCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberCategory
        fields = ["id", "name", "description", "is_default", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class MemberSerializer(serializers.ModelSerializer):
    category_detail = MemberCategorySerializer(source="category", read_only=True)

    class Meta:
        model = Member
        fields = [
            "id",
            "workspace",
            "linked_user",
            "membership_number",
            "first_name",
            "last_name",
            "email",
            "phone",
            "gender",
            "date_of_birth",
            "address",
            "city",
            "occupation",
            "photo",
            "join_date",
            "status",
            "category",
            "category_detail",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "membership_number", "created_at", "updated_at"]
