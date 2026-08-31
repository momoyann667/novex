from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import serializers

from .models import Member, MemberActivity, MemberCategory, MemberCustomFieldDefinition, MemberGroup, MemberTag

ALLOWED_PHOTO_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_MEMBER_PHOTO_BYTES = 5 * 1024 * 1024


class MemberCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberCategory
        fields = ["id", "name", "description", "is_default", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class MemberTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberTag
        fields = ["id", "name", "color", "created_at"]
        read_only_fields = ["id", "created_at"]


class MemberGroupSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberGroup
        fields = ["id", "name", "description", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class MemberCustomFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = MemberCustomFieldDefinition
        fields = ["id", "name", "field_type", "is_required", "is_visible", "options", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class MemberActivitySerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source="actor.__str__", read_only=True)

    class Meta:
        model = MemberActivity
        fields = ["id", "action", "actor_name", "metadata", "created_at"]
        read_only_fields = fields


class MemberSerializer(serializers.ModelSerializer):
    category_detail = MemberCategorySerializer(source="category", read_only=True)
    tags_detail = MemberTagSerializer(source="tags", many=True, read_only=True)
    groups_detail = MemberGroupSerializer(source="groups", many=True, read_only=True)
    full_name = serializers.CharField(read_only=True)
    tags = serializers.PrimaryKeyRelatedField(many=True, queryset=MemberTag.objects.none(), required=False)
    groups = serializers.PrimaryKeyRelatedField(many=True, queryset=MemberGroup.objects.none(), required=False)

    class Meta:
        model = Member
        fields = [
            "id",
            "workspace",
            "linked_user",
            "membership_number",
            "first_name",
            "last_name",
            "full_name",
            "email",
            "phone_country_code",
            "phone",
            "function",
            "gender",
            "date_of_birth",
            "address",
            "city",
            "occupation",
            "photo",
            "join_date",
            "joined_at",
            "status",
            "suspension_reason",
            "suspended_at",
            "suspended_until",
            "archived_at",
            "category",
            "category_detail",
            "tags",
            "tags_detail",
            "groups",
            "groups_detail",
            "custom_fields",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "membership_number", "joined_at", "archived_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["tags"].queryset = MemberTag.objects.filter(workspace=workspace)
            self.fields["groups"].queryset = MemberGroup.objects.filter(workspace=workspace)

    def validate_email(self, value):
        if not value:
            return ""
        try:
            validate_email(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError("Email invalide.") from exc
        return value.lower()

    def validate_phone_country_code(self, value):
        if value and not value.startswith("+"):
            raise serializers.ValidationError("Le code pays doit commencer par +, par exemple +225.")
        return value

    def validate_phone(self, value):
        digits = "".join(char for char in value if char.isdigit())
        if value and len(digits) < 6:
            raise serializers.ValidationError("Telephone invalide.")
        return value

    def validate_photo(self, value):
        if not value:
            return value
        content_type = getattr(value, "content_type", "")
        if content_type not in ALLOWED_PHOTO_CONTENT_TYPES:
            raise serializers.ValidationError("Format photo non autorise. Utilisez JPG, PNG ou WEBP.")
        if value.size > MAX_MEMBER_PHOTO_BYTES:
            raise serializers.ValidationError("La photo ne doit pas depasser 5 MB.")
        return value

    def validate(self, attrs):
        status = attrs.get("status")
        if status == Member.Status.SUSPENDED and not attrs.get("suspension_reason"):
            raise serializers.ValidationError({"suspension_reason": "La raison est requise pour suspendre un membre."})
        return attrs


class MemberSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    active = serializers.IntegerField()
    inactive = serializers.IntegerField()
    suspended = serializers.IntegerField()
    archived = serializers.IntegerField()
