from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.members.models import Member
from apps.workspaces.models import WorkspaceMembership
from .models import Project, ProjectActivity, ProjectBudgetCategory, ProjectDocument, ProjectExpenseAllocation
from .services import budget_category_summary, project_budget_summary
from .statuses import ProjectPriority, ProjectStatus


class ProjectBudgetCategorySerializer(serializers.ModelSerializer):
    expenses = serializers.SerializerMethodField()
    remaining = serializers.SerializerMethodField()
    consumed_rate = serializers.SerializerMethodField()

    class Meta:
        model = ProjectBudgetCategory
        fields = ["id", "project", "name", "planned_budget", "expenses", "remaining", "consumed_rate", "created_at", "updated_at"]
        read_only_fields = ["id", "project", "created_at", "updated_at"]

    def get_expenses(self, obj):
        return budget_category_summary(obj)["expenses"]

    def get_remaining(self, obj):
        return budget_category_summary(obj)["remaining"]

    def get_consumed_rate(self, obj):
        return budget_category_summary(obj)["consumed_rate"]

    def validate_planned_budget(self, value):
        if value < 0:
            raise serializers.ValidationError("Le budget prevu ne peut pas etre negatif.")
        return value


class ProjectExpenseAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectExpenseAllocation
        fields = ["id", "project", "budget_category", "external_expense_id", "label", "amount", "spent_at", "notes", "created_at"]
        read_only_fields = ["id", "project", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        project = self.context.get("project")
        if project:
            self.fields["budget_category"].queryset = ProjectBudgetCategory.objects.filter(project=project)

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit etre positif.")
        return value


class ProjectDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectDocument
        fields = ["id", "project", "title", "file", "document_type", "notes", "created_at"]
        read_only_fields = ["id", "project", "created_at"]


class ProjectActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectActivity
        fields = ["id", "action", "metadata", "created_at"]


class ProjectSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    budget_summary = serializers.SerializerMethodField()
    is_delayed = serializers.BooleanField(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "name",
            "description",
            "objectives",
            "status",
            "status_label",
            "priority",
            "priority_label",
            "start_date",
            "end_date",
            "responsible_user",
            "responsible_member",
            "budget",
            "budget_summary",
            "progress",
            "category",
            "image",
            "partners",
            "notes",
            "is_delayed",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "budget_summary", "is_delayed", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            user_ids = WorkspaceMembership.objects.filter(workspace=workspace, status="active").values_list("user_id", flat=True)
            self.fields["responsible_user"].queryset = get_user_model().objects.filter(id__in=user_ids)
            self.fields["responsible_member"].queryset = Member.objects.filter(workspace=workspace)

    def get_budget_summary(self, obj):
        return project_budget_summary(obj)

    def validate_status(self, value):
        if value not in ProjectStatus.values:
            raise serializers.ValidationError("Statut projet invalide.")
        return value

    def validate_priority(self, value):
        if value not in ProjectPriority.values:
            raise serializers.ValidationError("Priorite projet invalide.")
        return value

    def validate_progress(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError("La progression doit etre comprise entre 0 et 100.")
        return value

    def validate_budget(self, value):
        if value < 0:
            raise serializers.ValidationError("Le budget ne peut pas etre negatif.")
        return value

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        responsible_user = attrs.get("responsible_user") or getattr(self.instance, "responsible_user", None)
        responsible_member = attrs.get("responsible_member") or getattr(self.instance, "responsible_member", None)
        if responsible_user and not WorkspaceMembership.objects.filter(workspace=workspace, user=responsible_user, status="active").exists():
            raise serializers.ValidationError({"responsible_user": "Le responsable doit appartenir au workspace."})
        if responsible_member and not Member.objects.filter(workspace=workspace, id=responsible_member.id).exists():
            raise serializers.ValidationError({"responsible_member": "Le membre responsable doit appartenir au workspace."})
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "La date de fin doit etre posterieure a la date de debut."})
        return attrs
