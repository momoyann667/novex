from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from rest_framework import serializers

from .models import Member, MemberActivity, MemberCategory, MemberCustomFieldDefinition, MemberGroup, MemberInvitation, MembershipApplication, MembershipSettings, MemberTag

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


class MembershipSettingsSerializer(serializers.ModelSerializer):
    public_url = serializers.SerializerMethodField()

    class Meta:
        model = MembershipSettings
        fields = [
            "id",
            "membership_enabled",
            "public_form_enabled",
            "invitation_enabled",
            "approval_required",
            "auto_activate_members",
            "public_title",
            "public_description",
            "welcome_message",
            "confirmation_message",
            "visible_fields",
            "required_fields",
            "invitation_expiration_days",
            "public_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "public_url", "created_at", "updated_at"]

    def get_public_url(self, obj):
        return f"/join/{obj.workspace.slug}"


class MembershipApplicationSerializer(serializers.ModelSerializer):
    candidate_name = serializers.CharField(source="__str__", read_only=True)
    reviewed_by_name = serializers.CharField(source="reviewed_by.__str__", read_only=True)

    class Meta:
        model = MembershipApplication
        fields = [
            "id",
            "workspace",
            "member",
            "linked_user",
            "first_name",
            "last_name",
            "candidate_name",
            "email",
            "phone",
            "photo",
            "occupation",
            "city",
            "message",
            "internal_note",
            "custom_fields",
            "duplicate_warning",
            "source",
            "status",
            "submitted_at",
            "reviewed_at",
            "reviewed_by",
            "reviewed_by_name",
            "rejection_reason",
            "expires_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "member", "linked_user", "duplicate_warning", "status", "reviewed_at", "reviewed_by", "reviewed_by_name", "created_at", "updated_at"]

    def validate_email(self, value):
        if not value:
            return ""
        try:
            validate_email(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError("Email invalide.") from exc
        return value.lower()

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
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError("Un email ou un telephone est requis.")
        return attrs


class MembershipApplicationActionSerializer(serializers.Serializer):
    official_join_date = serializers.DateField(required=False)
    rejection_reason = serializers.CharField(required=False, allow_blank=True)
    internal_note = serializers.CharField(required=False, allow_blank=True)


class MembershipApplicationSummarySerializer(serializers.Serializer):
    total = serializers.IntegerField()
    pending = serializers.IntegerField()
    under_review = serializers.IntegerField()
    approved = serializers.IntegerField()
    rejected = serializers.IntegerField()
    cancelled = serializers.IntegerField()
    expired = serializers.IntegerField()


class PublicMembershipSettingsSerializer(serializers.ModelSerializer):
    association = serializers.CharField(source="workspace.name", read_only=True)
    slug = serializers.CharField(source="workspace.slug", read_only=True)
    custom_fields = serializers.SerializerMethodField()

    class Meta:
        model = MembershipSettings
        fields = ["association", "slug", "public_title", "public_description", "welcome_message", "confirmation_message", "visible_fields", "required_fields", "custom_fields"]

    def get_custom_fields(self, obj):
        fields = obj.workspace.member_custom_field_definitions.filter(is_visible=True).order_by("name")
        return MemberCustomFieldDefinitionSerializer(fields, many=True).data


class PublicMembershipApplicationSerializer(MembershipApplicationSerializer):
    class Meta(MembershipApplicationSerializer.Meta):
        fields = ["first_name", "last_name", "email", "phone", "photo", "occupation", "city", "message", "custom_fields"]
        read_only_fields = []


class MemberInvitationSerializer(serializers.ModelSerializer):
    invitee_name = serializers.CharField(source="__str__", read_only=True)
    invited_by_name = serializers.CharField(source="invited_by.__str__", read_only=True)
    accept_url = serializers.SerializerMethodField()

    class Meta:
        model = MemberInvitation
        fields = [
            "id",
            "workspace",
            "member",
            "first_name",
            "last_name",
            "invitee_name",
            "email",
            "phone",
            "function",
            "message",
            "status",
            "expires_at",
            "accepted_at",
            "declined_at",
            "cancelled_at",
            "last_sent_at",
            "invited_by",
            "invited_by_name",
            "accept_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "member", "status", "expires_at", "accepted_at", "declined_at", "cancelled_at", "last_sent_at", "invited_by", "invited_by_name", "accept_url", "created_at", "updated_at"]

    def get_accept_url(self, obj):
        token = self.context.get("plain_token")
        return f"/accepter-invitation/{token}" if token else None

    def validate_email(self, value):
        if not value:
            return ""
        try:
            validate_email(value)
        except DjangoValidationError as exc:
            raise serializers.ValidationError("Email invalide.") from exc
        return value.lower()

    def validate_phone(self, value):
        digits = "".join(char for char in value if char.isdigit())
        if value and len(digits) < 6:
            raise serializers.ValidationError("Telephone invalide.")
        return value

    def validate(self, attrs):
        if not attrs.get("email") and not attrs.get("phone"):
            raise serializers.ValidationError("Un email ou un telephone est requis.")
        return attrs


class InvitationTokenSerializer(serializers.Serializer):
    token = serializers.CharField()


class PublicInvitationSerializer(serializers.Serializer):
    association = serializers.CharField()
    invitee_name = serializers.CharField()
    invited_by_name = serializers.CharField(allow_blank=True)
    message = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    expires_at = serializers.DateTimeField()


class SelfMemberProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    workspace_name = serializers.CharField(source="workspace.name", read_only=True)
    workspace_currency = serializers.CharField(source="workspace.currency", read_only=True)
    profile_completion = serializers.SerializerMethodField()

    class Meta:
        model = Member
        fields = [
            "id",
            "workspace_name",
            "workspace_currency",
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
            "status",
            "custom_fields",
            "profile_completion",
        ]
        read_only_fields = ["id", "workspace_name", "workspace_currency", "membership_number", "function", "join_date", "status", "profile_completion"]

    def get_profile_completion(self, obj):
        from .services import profile_completion

        return profile_completion(obj)

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
            raise serializers.ValidationError("Le code pays doit commencer par +.")
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


class SelfMemberDashboardSerializer(serializers.Serializer):
    profile = serializers.DictField()
    contribution_summary = serializers.DictField()
    contributions = serializers.ListField()
    payment_summary = serializers.DictField()
    payments = serializers.ListField()
    attendance_summary = serializers.DictField()
    events = serializers.DictField()
    documents = serializers.ListField()
    history = serializers.ListField()
    alerts = serializers.ListField()
