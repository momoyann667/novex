from decimal import Decimal

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.members.models import Member
from apps.workspaces.models import Workspace
from .statuses import ProjectPriority, ProjectStatus


class Project(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="projects")
    name = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    objectives = models.TextField(blank=True)
    status = models.CharField(max_length=24, choices=ProjectStatus.choices, default=ProjectStatus.DRAFT)
    priority = models.CharField(max_length=24, choices=ProjectPriority.choices, default=ProjectPriority.MEDIUM)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsible_projects",
    )
    responsible_member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="projects")
    budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    progress = models.PositiveSmallIntegerField(default=0, validators=[MinValueValidator(0), MaxValueValidator(100)])
    category = models.CharField(max_length=120, blank=True)
    image = models.ImageField(upload_to="projects/", blank=True)
    partners = models.TextField(blank=True)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "priority"]),
            models.Index(fields=["workspace", "end_date"]),
            models.Index(fields=["workspace", "created_at"]),
        ]

    @property
    def is_delayed(self) -> bool:
        if not self.end_date or self.status in {ProjectStatus.COMPLETED, ProjectStatus.CANCELLED}:
            return False
        return self.end_date < timezone.localdate() and self.progress < 100

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
