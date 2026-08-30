from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.members.models import Member
from apps.workspaces.models import Workspace
from .statuses import (
    ProjectAlertType,
    ProjectMilestoneStatus,
    ProjectObjectiveStatus,
    ProjectPriority,
    ProjectRiskLevel,
    ProjectRole,
    ProjectStatus,
    ProjectTaskStatus,
    ProjectVisibility,
)


class Project(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=180)
    code = models.CharField(max_length=32, blank=True)
    description = models.TextField(blank=True)
    objectives = models.TextField(blank=True)
    status = models.CharField(max_length=24, choices=ProjectStatus.choices, default=ProjectStatus.DRAFT)
    priority = models.CharField(max_length=24, choices=ProjectPriority.choices, default=ProjectPriority.MEDIUM)
    visibility = models.CharField(max_length=16, choices=ProjectVisibility.choices, default=ProjectVisibility.WORKSPACE)
    parent = models.ForeignKey("self", on_delete=models.SET_NULL, null=True, blank=True, related_name="children")
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    owner = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="owned_projects")
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsible_projects",
    )
    responsible_member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects")
    budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=3, default="XOF")
    progress = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    progress_mode = models.CharField(max_length=16, default="AUTO")
    category = models.CharField(max_length=120, blank=True)
    image = models.ImageField(upload_to="projects/", blank=True)
    partners = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "code"], name="uniq_project_workspace_code")]
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "priority"]),
            models.Index(fields=["workspace", "owner"]),
            models.Index(fields=["workspace", "end_date"]),
            models.Index(fields=["workspace", "start_date"]),
            models.Index(fields=["workspace", "created_at"]),
        ]

    @property
    def is_delayed(self) -> bool:
        if not self.end_date or self.status in {ProjectStatus.COMPLETED, ProjectStatus.CANCELLED, ProjectStatus.ARCHIVED}:
            return False
        return self.end_date < timezone.localdate() and self.progress < 100

    @property
    def planned_budget(self) -> Decimal:
        return self.budget

    def __str__(self) -> str:
        return self.name


class ProjectBudgetCategory(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_budget_categories")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="budget_categories")
    name = models.CharField(max_length=120)
    planned_budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "name"], name="uniq_project_budget_category_name")]
        indexes = [models.Index(fields=["workspace", "project"])]


class ProjectExpenseAllocation(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_expense_allocations")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="expense_allocations")
    budget_category = models.ForeignKey(
        ProjectBudgetCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="expense_allocations",
    )
    external_expense_id = models.CharField(max_length=120, blank=True)
    label = models.CharField(max_length=180)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    spent_at = models.DateField(default=timezone.localdate)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "project", "spent_at"]),
            models.Index(fields=["workspace", "external_expense_id"]),
        ]


class ProjectDocument(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_documents")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=180)
    file = models.FileField(upload_to="project-documents/", blank=True)
    document_type = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "project", "-created_at"])]


class ProjectActivity(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_activities")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "project", "-created_at"]), models.Index(fields=["action", "-created_at"])]


class ProjectMember(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_memberships")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="team_members")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="project_memberships")
    role = models.CharField(max_length=24, choices=ProjectRole.choices, default=ProjectRole.MEMBER)
    is_active = models.BooleanField(default=True)
    joined_at = models.DateTimeField(default=timezone.now)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "member"], name="uniq_project_member")]
        indexes = [models.Index(fields=["workspace", "project"]), models.Index(fields=["workspace", "member"]), models.Index(fields=["workspace", "role"])]


class ProjectObjective(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_objectives")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="objective_items")
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    target = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    unit = models.CharField(max_length=40, blank=True)
    current_value = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=24, choices=ProjectObjectiveStatus.choices, default=ProjectObjectiveStatus.NOT_STARTED)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "project"]), models.Index(fields=["workspace", "status"])]


class ProjectMilestone(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_milestones")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="milestones")
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    due_date = models.DateField()
    status = models.CharField(max_length=24, choices=ProjectMilestoneStatus.choices, default=ProjectMilestoneStatus.PENDING)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "project"]), models.Index(fields=["workspace", "due_date"]), models.Index(fields=["workspace", "status"])]


class ProjectTask(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_tasks")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="tasks")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    assignee = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="assigned_project_tasks")
    milestone = models.ForeignKey(ProjectMilestone, on_delete=models.SET_NULL, null=True, blank=True, related_name="tasks")
    priority = models.CharField(max_length=24, choices=ProjectPriority.choices, default=ProjectPriority.MEDIUM)
    status = models.CharField(max_length=24, choices=ProjectTaskStatus.choices, default=ProjectTaskStatus.TODO)
    start_date = models.DateField(null=True, blank=True)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    dependencies = models.ManyToManyField("self", symmetrical=False, blank=True, related_name="dependents")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "project"]),
            models.Index(fields=["workspace", "assignee"]),
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "due_date"]),
        ]

    @property
    def is_overdue(self) -> bool:
        return bool(self.due_date and self.due_date < timezone.localdate() and self.status not in {ProjectTaskStatus.DONE, ProjectTaskStatus.CANCELLED})


class ProjectComment(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_comments")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="comments")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    content = models.TextField()
    mentions = models.JSONField(default=list, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "project", "-created_at"])]


class ProjectAlert(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="project_alerts")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="alerts")
    alert_type = models.CharField(max_length=64, choices=ProjectAlertType.choices)
    severity = models.CharField(max_length=16, choices=ProjectRiskLevel.choices, default=ProjectRiskLevel.MEDIUM)
    message = models.CharField(max_length=255)
    is_resolved = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "project", "is_resolved"]), models.Index(fields=["workspace", "severity", "-created_at"])]
