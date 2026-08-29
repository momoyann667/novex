from rest_framework import serializers

from .models import Contribution, ContributionCampaign, ContributionCategoryAmount, ReminderRule


class ContributionCampaignSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributionCampaign
        fields = [
            "id",
            "workspace",
            "name",
            "amount",
            "currency",
            "frequency",
            "period_label",
            "period_start",
            "period_end",
            "due_date",
            "target_category",
            "is_required",
            "status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "workspace", "created_at", "updated_at"]


class ContributionCategoryAmountSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContributionCategoryAmount
        fields = ["id", "campaign", "category", "amount"]


class ContributionSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    remaining_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Contribution
        fields = ["id", "workspace", "campaign", "member", "member_name", "amount_due", "amount_paid", "remaining_amount", "currency", "due_date", "status", "created_at", "updated_at"]
        read_only_fields = ["id", "workspace", "amount_paid", "remaining_amount", "created_at", "updated_at"]

    def get_member_name(self, obj):
        return str(obj.member)


class ReminderRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ReminderRule
        fields = ["id", "workspace", "name", "days_from_due_date", "is_active", "channel", "created_at", "updated_at"]
        read_only_fields = ["id", "workspace", "created_at", "updated_at"]
