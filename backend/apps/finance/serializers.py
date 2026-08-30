from decimal import Decimal

from rest_framework import serializers

from apps.events.models import Event
from apps.budgets.models import BudgetLine
from apps.projects.models import Project
from .models import CostCenter, FinancialCategory, FinancialSettings, FinancialTransaction, FinancialTransactionDocument, FiscalPeriod
from .statuses import FinancialCategoryKind, FinancialTransactionSource, FinancialTransactionStatus, FinancialTransactionType


class FinancialSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialSettings
        fields = ["id", "require_expense_receipt", "expense_validation_threshold", "large_expense_threshold", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]


class FinancialCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialCategory
        fields = ["id", "kind", "name", "description", "is_default", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "is_default", "created_at", "updated_at"]

    def validate_kind(self, value):
        if value not in FinancialCategoryKind.values:
            raise serializers.ValidationError("Famille de categorie invalide.")
        return value


class CostCenterSerializer(serializers.ModelSerializer):
    class Meta:
        model = CostCenter
        fields = ["id", "name", "code", "project", "event", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["project"].queryset = Project.objects.filter(workspace=workspace)
            self.fields["event"].queryset = Event.objects.filter(workspace=workspace)

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        for field in ["project", "event"]:
            item = attrs.get(field)
            if workspace and item and item.workspace_id != workspace.id:
                raise serializers.ValidationError({field: "Cette ressource appartient a un autre workspace."})
        return attrs


class FinancialTransactionSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source="category.name", read_only=True)
    budget_line = serializers.PrimaryKeyRelatedField(queryset=BudgetLine.objects.none(), required=False, allow_null=True, write_only=True)

    class Meta:
        model = FinancialTransaction
        fields = [
            "id",
            "transaction_type",
            "amount",
            "currency",
            "category",
            "category_name",
            "description",
            "reference",
            "transaction_date",
            "status",
            "source",
            "project",
            "event",
            "cost_center",
            "supplier_name",
            "supplier_phone",
            "invoice_reference",
            "payment_method",
            "requires_receipt",
            "budget_line",
            "notes",
            "cancellation_reason",
            "cancelled_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "currency", "status", "cancellation_reason", "cancelled_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["category"].queryset = FinancialCategory.objects.filter(workspace=workspace, is_active=True)
            self.fields["project"].queryset = Project.objects.filter(workspace=workspace)
            self.fields["event"].queryset = Event.objects.filter(workspace=workspace)
            self.fields["cost_center"].queryset = CostCenter.objects.filter(workspace=workspace, is_active=True)
            self.fields["budget_line"].queryset = BudgetLine.objects.filter(workspace=workspace, is_active=True)

    def validate_amount(self, value):
        if value <= Decimal("0.00"):
            raise serializers.ValidationError("Le montant doit etre positif.")
        return value

    def validate_source(self, value):
        if value not in FinancialTransactionSource.values:
            raise serializers.ValidationError("Source invalide.")
        return value

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        transaction_type = attrs.get("transaction_type") or getattr(self.instance, "transaction_type", None)
        category = attrs.get("category") or getattr(self.instance, "category", None)
        if transaction_type not in FinancialTransactionType.values:
            raise serializers.ValidationError({"transaction_type": "Type de transaction invalide."})
        if workspace:
            for field in ["category", "project", "event", "cost_center", "budget_line"]:
                item = attrs.get(field)
                if item and item.workspace_id != workspace.id:
                    raise serializers.ValidationError({field: "Cette ressource appartient a un autre workspace."})
        if category and transaction_type == FinancialTransactionType.INCOME and category.kind != FinancialCategoryKind.INCOME_CATEGORY:
            raise serializers.ValidationError({"category": "La categorie doit etre une categorie de recette."})
        if category and transaction_type == FinancialTransactionType.EXPENSE and category.kind != FinancialCategoryKind.EXPENSE_CATEGORY:
            raise serializers.ValidationError({"category": "La categorie doit etre une categorie de depense."})
        return attrs


class FinancialDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialTransactionDocument
        fields = ["id", "transaction", "title", "file", "document_type", "mime_type", "size_bytes", "created_at"]
        read_only_fields = ["id", "transaction", "mime_type", "size_bytes", "created_at"]


class FiscalPeriodSerializer(serializers.ModelSerializer):
    class Meta:
        model = FiscalPeriod
        fields = ["id", "name", "start_date", "end_date", "status", "closing_summary", "closed_at", "created_at", "updated_at"]
        read_only_fields = ["id", "status", "closing_summary", "closed_at", "created_at", "updated_at"]

    def validate(self, attrs):
        start = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if start and end and end < start:
            raise serializers.ValidationError({"end_date": "La date de fin doit etre posterieure au debut."})
        return attrs


class TransactionCancelSerializer(serializers.Serializer):
    reason = serializers.CharField(max_length=500)
