from rest_framework import serializers

from apps.members.models import Member
from .models import Contribution, ContributionCampaign, ContributionCategoryAmount, ReminderRule
from .statuses import CampaignTargetMode


class ContributionCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributionCampaign
        fields = [
            "id",
            "workspace",
            "name",
            "description",
            "contribution_type",
            "amount",
            "currency",
            "periodicity",
            "period_label",
            "period_start",
            "period_end",
            "due_date",
            "target_mode",
            "target_category",
            "target_members",
            "target_segment",
            "is_required",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["target_category"].queryset = workspace.member_categories.all()
            self.fields["target_members"].queryset = Member.objects.filter(workspace=workspace)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit etre positif.")
        return value

    def validate(self, attrs):
        if attrs.get("target_mode") == CampaignTargetMode.CATEGORY and not attrs.get("target_category"):
            raise serializers.ValidationError({"target_category": "Une categorie est requise pour ce ciblage."})
        return attrs


class ContributionCategoryAmountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributionCategoryAmount
        fields = ["id", "campaign", "category", "amount"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit etre positif.")
        return value


class ContributionSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    remaining_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Contribution
        fields = [
            "id",
            "workspace",
            "campaign",
            "member",
            "member_name",
            "amount_due",
            "amount_paid",
            "waived_amount",
            "remaining_amount",
            "currency",
            "due_date",
            "status",
            "paid_at",
            "waived_at",
            "waiver_reason",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "amount_paid", "waived_amount", "remaining_amount", "paid_at", "waived_at", "waiver_reason", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["campaign"].queryset = ContributionCampaign.objects.filter(workspace=workspace)
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)

    def get_member_name(self, obj):
        return str(obj.member)

    def validate_amount_due(self, value):
        if value < 0:
            raise serializers.ValidationError("Le montant du ne peut pas etre negatif.")
        return value

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        campaign = attrs.get("campaign") or getattr(self.instance, "campaign", None)
        member = attrs.get("member") or getattr(self.instance, "member", None)
        if campaign and campaign.workspace_id != workspace.id:
            raise serializers.ValidationError({"campaign": "La campagne appartient a un autre workspace."})
        if member and member.workspace_id != workspace.id:
            raise serializers.ValidationError({"member": "Le membre appartient a un autre workspace."})
        return attrs


class ContributionManualPaymentSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2)
    idempotency_key = serializers.CharField(max_length=160)
    paid_at = serializers.DateTimeField(required=False)
    payment_method = serializers.ChoiceField(choices=["cash", "external_mobile_money", "bank_transfer", "check", "other"], required=False)
    document_reference = serializers.CharField(max_length=180, required=False, allow_blank=True)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit etre positif.")
        return value


class ContributionWaiverSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, required=False)
    reason = serializers.CharField(required=False, allow_blank=True)

    def validate_amount(self, value):
        if value < 0:
            raise serializers.ValidationError("Le montant exonere ne peut pas etre negatif.")
        return value


class ReminderRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReminderRule
        fields = ["id", "workspace", "name", "days_from_due_date", "is_active", "channel", "created_at", "updated_at"]
        read_only_fields = ["id", "workspace", "created_at", "updated_at"]
