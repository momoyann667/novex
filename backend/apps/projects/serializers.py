from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.members.models import Member
from apps.workspaces.models import WorkspaceMembership
from .models import Project, ProjectActivity, ProjectBudgetCategory, ProjectComment, ProjectDocument, ProjectExpenseAllocation, ProjectMember, ProjectMilestone, ProjectObjective, ProjectTask
from .services import budget_category_summary, objective_progress, project_analytics, project_budget_summary, project_risk_score
from .statuses import ProjectMilestoneStatus, ProjectObjectiveStatus, ProjectPriority, ProjectRole, ProjectStatus, ProjectTaskStatus, ProjectVisibility


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


class ProjectMemberSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMember
        fields = ["id", "project", "member", "member_name", "role", "is_active", "joined_at", "created_at", "updated_at"]
        read_only_fields = ["id", "project", "member_name", "joined_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)

    def get_member_name(self, obj):
        return str(obj.member)

    def validate_role(self, value):
        if value not in ProjectRole.values:
            raise serializers.ValidationError("Role projet invalide.")
        return value


class ProjectObjectiveSerializer(serializers.ModelSerializer):
    progress = serializers.SerializerMethodField()

    class Meta:
        model = ProjectObjective
        fields = ["id", "project", "name", "description", "target", "unit", "current_value", "status", "progress", "created_at", "updated_at"]
        read_only_fields = ["id", "project", "progress", "created_at", "updated_at"]

    def get_progress(self, obj):
        return objective_progress(obj)

    def validate_status(self, value):
        if value not in ProjectObjectiveStatus.values:
            raise serializers.ValidationError("Statut objectif invalide.")
        return value


class ProjectMilestoneSerializer(serializers.ModelSerializer):
    is_delayed = serializers.SerializerMethodField()

    class Meta:
        model = ProjectMilestone
        fields = ["id", "project", "name", "description", "due_date", "status", "is_delayed", "completed_at", "created_at", "updated_at"]
        read_only_fields = ["id", "project", "is_delayed", "completed_at", "created_at", "updated_at"]

    def get_is_delayed(self, obj):
        from django.utils import timezone

        return obj.due_date < timezone.localdate() and obj.status != ProjectMilestoneStatus.COMPLETED

    def validate_status(self, value):
        if value not in ProjectMilestoneStatus.values:
            raise serializers.ValidationError("Statut jalon invalide.")
        return value


class ProjectTaskSerializer(serializers.ModelSerializer):
    assignee_name = serializers.SerializerMethodField()
    dependency_ids = serializers.PrimaryKeyRelatedField(queryset=ProjectTask.objects.all(), many=True, required=False, write_only=True)
    dependencies = serializers.PrimaryKeyRelatedField(many=True, read_only=True)
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = ProjectTask
        fields = [
            "id",
            "project",
            "title",
            "description",
            "assignee",
            "assignee_name",
            "milestone",
            "priority",
            "status",
            "start_date",
            "due_date",
            "completed_at",
            "dependency_ids",
            "dependencies",
            "is_overdue",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "project", "assignee_name", "completed_at", "dependencies", "is_overdue", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        project = self.context.get("project")
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["assignee"].queryset = Member.objects.filter(workspace=workspace)
        if project:
            self.fields["milestone"].queryset = ProjectMilestone.objects.filter(project=project)
            self.fields["dependency_ids"].queryset = ProjectTask.objects.filter(project=project)

    def get_assignee_name(self, obj):
        return str(obj.assignee) if obj.assignee_id else ""

    def validate_status(self, value):
        if value not in ProjectTaskStatus.values:
            raise serializers.ValidationError("Statut tache invalide.")
        return value


class ProjectCommentSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source="author.__str__", read_only=True)

    class Meta:
        model = ProjectComment
        fields = ["id", "project", "author_name", "content", "mentions", "created_at", "updated_at"]
        read_only_fields = ["id", "project", "author_name", "created_at", "updated_at"]


class ProjectSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    priority_label = serializers.CharField(source="get_priority_display", read_only=True)
    owner_name = serializers.SerializerMethodField()
    responsible_user_name = serializers.SerializerMethodField()
    responsible_member_name = serializers.SerializerMethodField()
    team_preview = serializers.SerializerMethodField()
    budget_summary = serializers.SerializerMethodField()
    analytics = serializers.SerializerMethodField()
    risk = serializers.SerializerMethodField()
    is_delayed = serializers.BooleanField(read_only=True)
    planned_budget = serializers.DecimalField(source="budget", max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "code",
            "name",
            "description",
            "objectives",
            "status",
            "status_label",
            "priority",
            "priority_label",
            "visibility",
            "parent",
            "start_date",
            "end_date",
            "owner",
            "owner_name",
            "responsible_user",
            "responsible_user_name",
            "responsible_member",
            "responsible_member_name",
            "team_preview",
            "planned_budget",
            "budget",
            "currency",
            "budget_summary",
            "analytics",
            "risk",
            "progress",
            "progress_mode",
            "category",
            "image",
            "partners",
            "notes",
            "is_delayed",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "code", "currency", "planned_budget", "budget_summary", "analytics", "risk", "is_delayed", "completed_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            user_ids = WorkspaceMembership.objects.filter(workspace=workspace, status="active").values_list("user_id", flat=True)
            self.fields["responsible_user"].queryset = get_user_model().objects.filter(id__in=user_ids)
            self.fields["responsible_member"].queryset = Member.objects.filter(workspace=workspace)
            self.fields["owner"].queryset = Member.objects.filter(workspace=workspace)
            self.fields["parent"].queryset = Project.objects.filter(workspace=workspace)

    def get_budget_summary(self, obj):
        return project_budget_summary(obj)

    def get_owner_name(self, obj):
        return str(obj.owner) if obj.owner_id else ""

    def get_responsible_user_name(self, obj):
        if not obj.responsible_user_id:
            return ""
        full_name = obj.responsible_user.get_full_name()
        return full_name or obj.responsible_user.email or obj.responsible_user.username

    def get_responsible_member_name(self, obj):
        return str(obj.responsible_member) if obj.responsible_member_id else ""

    def get_team_preview(self, obj):
        members = obj.team_members.select_related("member").filter(is_active=True).order_by("id")[:5]
        return [{"id": item.member_id, "name": str(item.member), "role": item.role} for item in members]

    def get_analytics(self, obj):
        return project_analytics(obj)

    def get_risk(self, obj):
        return project_risk_score(obj)

    def validate_status(self, value):
        if value not in ProjectStatus.values:
            raise serializers.ValidationError("Statut projet invalide.")
        return value

    def validate_visibility(self, value):
        if value not in ProjectVisibility.values:
            raise serializers.ValidationError("Visibilite projet invalide.")
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
        owner = attrs.get("owner") or getattr(self.instance, "owner", None)
        if owner and not Member.objects.filter(workspace=workspace, id=owner.id).exists():
            raise serializers.ValidationError({"owner": "Le proprietaire projet doit appartenir au workspace."})
        parent = attrs.get("parent") or getattr(self.instance, "parent", None)
        if parent and parent.workspace_id != workspace.id:
            raise serializers.ValidationError({"parent": "Le projet parent doit appartenir au workspace."})
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "La date de fin doit etre posterieure a la date de debut."})
        return attrs
