from rest_framework import serializers

from apps.events.models import Event
from apps.finance.models import FinancialCategory, FinancialTransaction
from apps.finance.statuses import FinancialCategoryKind, FinancialTransactionType
from apps.projects.models import Project
from .models import Budget, BudgetAlert, BudgetLine, BudgetSettings
from .services import budget_summary, line_summary
from .statuses import BudgetPeriodType, BudgetScopeType, BudgetStatus


class BudgetSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetSettings
        fields = ["id", "allow_over_budget_expense", "thresholds", "notify_in_app", "notify_email", "notify_whatsapp", "notify_sms", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class BudgetLineSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    metrics = serializers.SerializerMethodField()

    class Meta:
        model = BudgetLine
        fields = ["id", "budget", "category", "category_name", "planned_amount", "committed_amount", "is_active", "metrics", "created_at", "updated_at"]
        read_only_fields = ["id", "budget", "category_name", "metrics", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["category"].queryset = FinancialCategory.objects.filter(workspace=workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, is_active=True)

    def get_metrics(self, obj):
        return line_summary(obj)


class BudgetSerializer(serializers.ModelSerializer):
    lines = BudgetLineSerializer(many=True, read_only=True)
    metrics = serializers.SerializerMethodField()
    project_name = serializers.CharField(source="project.name", read_only=True)
    event_name = serializers.CharField(source="event.title", read_only=True)

    class Meta:
        model = Budget
        fields = [
            "id",
            "name",
            "description",
            "period_type",
            "scope_type",
            "start_date",
            "end_date",
            "total_amount",
            "currency",
            "status",
            "project",
            "project_name",
            "event",
            "event_name",
            "lines",
            "metrics",
            "closed_at",
            "archived_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "currency", "status", "lines", "metrics", "closed_at", "archived_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["project"].queryset = Project.objects.filter(workspace=workspace)
            self.fields["event"].queryset = Event.objects.filter(workspace=workspace)

    def validate_period_type(self, value):
        if value not in BudgetPeriodType.values:
            raise serializers.ValidationError("Periode budgetaire invalide.")
        return value

    def validate_scope_type(self, value):
        if value not in BudgetScopeType.values:
            raise serializers.ValidationError("Portee budgetaire invalide.")
        return value

    def validate_status(self, value):
        if value not in BudgetStatus.values:
            raise serializers.ValidationError("Statut budgetaire invalide.")
        return value

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        start = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "La date de fin doit etre posterieure au debut."})
        if workspace:
            for field in ["project", "event"]:
                item = attrs.get(field)
                if item and item.workspace_id != workspace.id:
                    raise serializers.ValidationError({field: "Cette ressource appartient a un autre workspace."})
        return attrs

    def get_metrics(self, obj):
        return budget_summary(obj)


class BudgetAlertSerializer(serializers.ModelSerializer):
    budget_name = serializers.CharField(source="budget.name", read_only=True)

    class Meta:
        model = BudgetAlert
        fields = ["id", "budget", "budget_name", "budget_line", "alert_type", "severity", "threshold_percent", "current_percent", "message", "channels", "is_resolved", "created_at"]
        read_only_fields = fields


class BudgetExpenseAssignmentSerializer(serializers.Serializer):
    transaction = serializers.PrimaryKeyRelatedField(queryset=FinancialTransaction.objects.all())
    budget_line = serializers.PrimaryKeyRelatedField(queryset=BudgetLine.objects.all())

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        transaction_obj = attrs["transaction"]
        budget_line = attrs["budget_line"]
        if transaction_obj.workspace_id != workspace.id:
            raise serializers.ValidationError({"transaction": "Cette transaction appartient a un autre workspace."})
        if budget_line.workspace_id != workspace.id:
            raise serializers.ValidationError({"budget_line": "Cette ligne budgetaire appartient a un autre workspace."})
        if transaction_obj.transaction_type != FinancialTransactionType.EXPENSE:
            raise serializers.ValidationError({"transaction": "Seules les depenses peuvent etre affectees."})
        return attrs

