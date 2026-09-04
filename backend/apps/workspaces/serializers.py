import json

from rest_framework import serializers

from .models import OrganizationProfile, Workspace, WorkspaceSettings
from .services import create_workspace_for_owner, ensure_workspace_settings, unique_workspace_slug


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = ["id", "name", "slug", "organization_type", "logo", "currency", "country", "city", "description", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "slug", "status", "created_at", "updated_at"]

    def update(self, instance, validated_data):
        name = validated_data.get("name")
        if name and name != instance.name:
            instance.slug = unique_workspace_slug(name, exclude_id=instance.id)
        return super().update(instance, validated_data)


class OrganizationProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = OrganizationProfile
        fields = ["legal_name", "address", "contact_email", "contact_phone", "website_url"]


class WorkspaceSettingsSerializer(serializers.ModelSerializer):
    workspace_slug = serializers.CharField(source="workspace.slug", read_only=True)
    workspace_name = serializers.CharField(source="workspace.name", required=False)
    organization_type = serializers.ChoiceField(source="workspace.organization_type", choices=Workspace.OrganizationType.choices, required=False)
    logo = serializers.ImageField(source="workspace.logo", required=False, allow_null=True)
    currency = serializers.CharField(source="workspace.currency", required=False, max_length=3)
    country = serializers.CharField(source="workspace.country", required=False, max_length=2)
    city = serializers.CharField(source="workspace.city", required=False, allow_blank=True, max_length=120)
    description = serializers.CharField(source="workspace.description", required=False, allow_blank=True)
    profile = OrganizationProfileSerializer(source="workspace.organization_profile", required=False)
    subscription = serializers.SerializerMethodField()
    owner = serializers.SerializerMethodField()

    def to_internal_value(self, data):
        if hasattr(data, "lists"):
            data = {key: values[-1] if values else "" for key, values in data.lists()}
        elif hasattr(data, "copy"):
            data = data.copy()
        for key in [
            "profile",
            "money_format",
            "finance_preferences",
            "contribution_preferences",
            "notification_preferences",
            "member_preferences",
            "project_preferences",
            "event_preferences",
            "document_preferences",
            "security_preferences",
        ]:
            value = data.get(key) if hasattr(data, "get") else None
            if isinstance(value, str):
                try:
                    data[key] = json.loads(value)
                except json.JSONDecodeError as exc:
                    raise serializers.ValidationError({key: "JSON invalide."}) from exc
        return super().to_internal_value(data)

    class Meta:
        model = WorkspaceSettings
        fields = [
            "workspace_slug",
            "workspace_name",
            "organization_type",
            "logo",
            "currency",
            "country",
            "city",
            "description",
            "profile",
            "owner",
            "subscription",
            "acronym",
            "registration_number",
            "region",
            "founded_on",
            "primary_contact_name",
            "primary_contact_email",
            "primary_contact_phone",
            "primary_contact_function",
            "timezone",
            "language",
            "date_format",
            "money_format",
            "theme",
            "primary_color",
            "secondary_color",
            "finance_preferences",
            "contribution_preferences",
            "notification_preferences",
            "member_preferences",
            "project_preferences",
            "event_preferences",
            "document_preferences",
            "integration_states",
            "security_preferences",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["workspace_slug", "owner", "subscription", "created_at", "updated_at"]

    def get_owner(self, obj):
        owner = obj.workspace.owner
        profile = getattr(owner, "profile", None)
        full_name = str(profile) if profile and str(profile) else owner.get_full_name() or owner.username or owner.email
        return {
            "id": owner.id,
            "full_name": full_name,
            "email": owner.email,
            "phone": owner.phone,
        }

    def get_subscription(self, obj):
        subscription = getattr(obj.workspace, "subscription", None)
        if not subscription:
            return None
        return {
            "plan": subscription.plan.code,
            "plan_name": subscription.plan.name,
            "status": subscription.status,
            "trial_started_at": subscription.trial_started_at,
            "trial_ends_at": subscription.trial_ends_at,
            "current_period_started_at": subscription.current_period_started_at,
            "current_period_ends_at": subscription.current_period_ends_at,
            "limits": subscription.plan.limits,
            "entitlements": subscription.plan.entitlements,
        }

    def validate_currency(self, value):
        allowed = {"XOF", "EUR", "USD", "CAD"}
        if value not in allowed:
            raise serializers.ValidationError("Devise non supportee.")
        return value

    def validate_country(self, value):
        if len(value) != 2:
            raise serializers.ValidationError("Le pays doit etre au format ISO 3166-1 alpha-2.")
        return value.upper()

    def validate_timezone(self, value):
        allowed = {"Africa/Abidjan", "UTC", "Europe/Paris"}
        if value not in allowed:
            raise serializers.ValidationError("Timezone non supportee.")
        return value

    def validate_money_format(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Format monetaire invalide.")
        decimals = value.get("decimals", 0)
        if not isinstance(decimals, int) or decimals < 0 or decimals > 4:
            raise serializers.ValidationError("Le nombre de decimales doit etre compris entre 0 et 4.")
        symbol_position = value.get("symbol_position", "after")
        if symbol_position not in {"before", "after"}:
            raise serializers.ValidationError("La position du symbole est invalide.")
        return value

    def validate_member_preferences(self, value):
        return self._validate_preferences(value, ["categories", "statuses", "groups", "functions", "custom_fields"])

    def validate_finance_preferences(self, value):
        return self._validate_preferences(value, ["expense_categories", "revenue_categories", "payment_methods", "accounts"])

    def _validate_preferences(self, value, list_keys):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Preferences invalides.")
        for key in list_keys:
            items = value.get(key)
            if items is None:
                continue
            if not isinstance(items, list) or any(not isinstance(item, str) or len(item) > 120 for item in items):
                raise serializers.ValidationError({key: "La liste contient une valeur invalide."})
        return value

    def update(self, instance, validated_data):
        workspace_data = validated_data.pop("workspace", {})
        profile_data = workspace_data.pop("organization_profile", None)
        workspace = instance.workspace
        name = workspace_data.pop("name", None)
        if name and name != workspace.name:
            workspace.slug = unique_workspace_slug(name, exclude_id=workspace.id)
            workspace.name = name
        for field, value in workspace_data.items():
            setattr(workspace, field, value)
        workspace.save()
        if profile_data is not None:
            profile, _created = OrganizationProfile.objects.get_or_create(workspace=workspace)
            for field, value in profile_data.items():
                setattr(profile, field, value)
            profile.save()
        for field, value in validated_data.items():
            setattr(instance, field, value)
        instance.save()
        return ensure_workspace_settings(workspace)


class WorkspaceCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)
    organization_type = serializers.ChoiceField(choices=Workspace.OrganizationType.choices)
    currency = serializers.CharField(max_length=3, required=False, default="XOF")
    country = serializers.CharField(max_length=2, required=False, default="CI")
    city = serializers.CharField(max_length=120, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)

    def create(self, validated_data):
        return create_workspace_for_owner(owner=self.context["request"].user, **validated_data)
