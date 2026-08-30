from rest_framework import decorators, filters, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Project, ProjectActivity, ProjectBudgetCategory, ProjectComment, ProjectDocument, ProjectExpenseAllocation, ProjectMember, ProjectMilestone, ProjectObjective, ProjectTask
from .serializers import (
    ProjectActivitySerializer,
    ProjectBudgetCategorySerializer,
    ProjectCommentSerializer,
    ProjectDocumentSerializer,
    ProjectExpenseAllocationSerializer,
    ProjectMemberSerializer,
    ProjectMilestoneSerializer,
    ProjectObjectiveSerializer,
    ProjectSerializer,
    ProjectTaskSerializer,
)
from .services import (
    add_expense_allocation,
    add_project_member,
    change_project_status,
    complete_project_task,
    create_project,
    create_project_comment,
    create_project_milestone,
    create_project_objective,
    create_project_task,
    delete_project,
    evaluate_project_alerts,
    project_analytics,
    project_report_payload,
    remove_project_member,
    update_project,
    update_project_member,
    update_project_milestone,
    update_project_objective,
    update_project_task,
    workspace_project_stats,
)
from .statuses import ProjectStatus


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class ProjectViewSet(viewsets.ModelViewSet):
    serializer_class = ProjectSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "category", "partners"]
    ordering_fields = ["created_at", "start_date", "end_date", "budget", "progress", "name"]

    def get_permissions(self):
        permission_map = {
            "create": "projects.create",
            "update": "projects.update",
            "partial_update": "projects.update",
            "destroy": "projects.delete",
            "activate": "projects.update",
            "pause": "projects.update",
            "complete": "projects.update",
            "archive": "projects.archive",
            "members": "projects.manage_members" if self.request.method == "POST" else "projects.view",
            "member_detail": "projects.manage_members",
            "tasks": "projects.manage_tasks" if self.request.method == "POST" else "projects.view",
            "task_detail": "projects.manage_tasks",
            "complete_task": "projects.manage_tasks",
            "objectives": "projects.manage_objectives" if self.request.method == "POST" else "projects.view",
            "objective_detail": "projects.manage_objectives",
            "milestones": "projects.manage_tasks" if self.request.method == "POST" else "projects.view",
            "milestone_detail": "projects.manage_tasks",
            "comments": "projects.update" if self.request.method == "POST" else "projects.view",
            "budget_categories": "projects.manage_budget",
            "expenses": "projects.manage_budget" if self.request.method == "POST" else "projects.view",
            "documents": "projects.manage_documents" if self.request.method == "POST" else "projects.view",
            "activity": "projects.view",
            "analytics": "projects.view",
            "reports": "projects.manage_reports",
            "export_report": "projects.export",
            "stats": "projects.view",
        }
        permission_code = permission_map.get(self.action, "projects.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        queryset = Project.objects.select_related("workspace", "responsible_user", "responsible_member").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        if self.request.query_params.get("status"):
            queryset = queryset.filter(status=self.request.query_params["status"])
        if self.request.query_params.get("priority"):
            queryset = queryset.filter(priority=self.request.query_params["priority"])
        if self.request.query_params.get("responsible_user"):
            queryset = queryset.filter(responsible_user_id=self.request.query_params["responsible_user"])
        if self.request.query_params.get("owner"):
            queryset = queryset.filter(owner_id=self.request.query_params["owner"])
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        project = create_project(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        return response.Response(ProjectSerializer(project, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        project = self.get_object()
        serializer = self.get_serializer(project, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        project = update_project(project=project, actor=request.user, **serializer.validated_data)
        return response.Response(ProjectSerializer(project, context=self.get_serializer_context()).data)

    def perform_destroy(self, instance):
        delete_project(project=instance, actor=self.request.user)

    @decorators.action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        return response.Response(ProjectSerializer(change_project_status(project=self.get_object(), actor=request.user, status=ProjectStatus.ACTIVE), context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["post"])
    def pause(self, request, pk=None):
        return response.Response(ProjectSerializer(change_project_status(project=self.get_object(), actor=request.user, status=ProjectStatus.ON_HOLD), context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return response.Response(ProjectSerializer(change_project_status(project=self.get_object(), actor=request.user, status=ProjectStatus.COMPLETED), context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        try:
            project = change_project_status(project=self.get_object(), actor=request.user, status=ProjectStatus.ARCHIVED)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(ProjectSerializer(project, context=self.get_serializer_context()).data)

    @decorators.action(detail=False, methods=["get"])
    def stats(self, request):
        return response.Response(workspace_project_stats(current_workspace(request)))

    @decorators.action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        return response.Response(project_analytics(self.get_object()))

    @decorators.action(detail=True, methods=["get", "post"])
    def members(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = ProjectMemberSerializer(data=request.data, context={**self.get_serializer_context(), "project": project})
            serializer.is_valid(raise_exception=True)
            try:
                item = add_project_member(project=project, actor=request.user, member=serializer.validated_data["member"], role=serializer.validated_data["role"])
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(ProjectMemberSerializer(item, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)
        return response.Response(ProjectMemberSerializer(project.team_members.select_related("member").filter(is_active=True), many=True, context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["patch", "delete"], url_path=r"members/(?P<member_id>[^/.]+)")
    def member_detail(self, request, pk=None, member_id=None):
        project = self.get_object()
        item = ProjectMember.objects.get(project=project, id=member_id)
        if request.method == "DELETE":
            remove_project_member(item=item, actor=request.user)
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        serializer = ProjectMemberSerializer(item, data=request.data, partial=True, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        return response.Response(ProjectMemberSerializer(update_project_member(item=item, actor=request.user, **serializer.validated_data), context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def tasks(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = ProjectTaskSerializer(data=request.data, context={**self.get_serializer_context(), "project": project})
            serializer.is_valid(raise_exception=True)
            dependencies = serializer.validated_data.pop("dependency_ids", [])
            try:
                task = create_project_task(project=project, actor=request.user, dependencies=dependencies, **serializer.validated_data)
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(ProjectTaskSerializer(task, context={**self.get_serializer_context(), "project": project}).data, status=status.HTTP_201_CREATED)
        return response.Response(ProjectTaskSerializer(project.tasks.select_related("assignee", "milestone").prefetch_related("dependencies"), many=True, context={**self.get_serializer_context(), "project": project}).data)

    @decorators.action(detail=True, methods=["patch"], url_path=r"tasks/(?P<task_id>[^/.]+)")
    def task_detail(self, request, pk=None, task_id=None):
        project = self.get_object()
        task = ProjectTask.objects.get(project=project, id=task_id)
        serializer = ProjectTaskSerializer(task, data=request.data, partial=True, context={**self.get_serializer_context(), "project": project})
        serializer.is_valid(raise_exception=True)
        dependencies = serializer.validated_data.pop("dependency_ids", None)
        try:
            task = update_project_task(task=task, actor=request.user, dependencies=dependencies, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(ProjectTaskSerializer(task, context={**self.get_serializer_context(), "project": project}).data)

    @decorators.action(detail=True, methods=["post"], url_path=r"tasks/(?P<task_id>[^/.]+)/complete")
    def complete_task(self, request, pk=None, task_id=None):
        project = self.get_object()
        task = ProjectTask.objects.get(project=project, id=task_id)
        return response.Response(ProjectTaskSerializer(complete_project_task(task=task, actor=request.user), context={**self.get_serializer_context(), "project": project}).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def objectives(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = ProjectObjectiveSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            objective = create_project_objective(project=project, actor=request.user, **serializer.validated_data)
            return response.Response(ProjectObjectiveSerializer(objective).data, status=status.HTTP_201_CREATED)
        return response.Response(ProjectObjectiveSerializer(project.objective_items.all(), many=True).data)

    @decorators.action(detail=True, methods=["patch"], url_path=r"objectives/(?P<objective_id>[^/.]+)")
    def objective_detail(self, request, pk=None, objective_id=None):
        objective = ProjectObjective.objects.get(project=self.get_object(), id=objective_id)
        serializer = ProjectObjectiveSerializer(objective, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return response.Response(ProjectObjectiveSerializer(update_project_objective(objective=objective, actor=request.user, **serializer.validated_data)).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def milestones(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = ProjectMilestoneSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            milestone = create_project_milestone(project=project, actor=request.user, **serializer.validated_data)
            return response.Response(ProjectMilestoneSerializer(milestone).data, status=status.HTTP_201_CREATED)
        return response.Response(ProjectMilestoneSerializer(project.milestones.order_by("due_date"), many=True).data)

    @decorators.action(detail=True, methods=["patch"], url_path=r"milestones/(?P<milestone_id>[^/.]+)")
    def milestone_detail(self, request, pk=None, milestone_id=None):
        milestone = ProjectMilestone.objects.get(project=self.get_object(), id=milestone_id)
        serializer = ProjectMilestoneSerializer(milestone, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        return response.Response(ProjectMilestoneSerializer(update_project_milestone(milestone=milestone, actor=request.user, **serializer.validated_data)).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def comments(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = ProjectCommentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            comment = create_project_comment(project=project, actor=request.user, content=serializer.validated_data["content"], mentions=serializer.validated_data.get("mentions"))
            return response.Response(ProjectCommentSerializer(comment).data, status=status.HTTP_201_CREATED)
        return response.Response(ProjectCommentSerializer(project.comments.order_by("-created_at"), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"], url_path="budget-categories")
    def budget_categories(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = ProjectBudgetCategorySerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            category = ProjectBudgetCategory.objects.create(workspace=project.workspace, project=project, **serializer.validated_data)
            return response.Response(ProjectBudgetCategorySerializer(category).data, status=status.HTTP_201_CREATED)
        queryset = project.budget_categories.order_by("name")
        return response.Response(ProjectBudgetCategorySerializer(queryset, many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def expenses(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = ProjectExpenseAllocationSerializer(data=request.data, context={"project": project})
            serializer.is_valid(raise_exception=True)
            try:
                allocation = add_expense_allocation(project=project, actor=request.user, **serializer.validated_data)
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(ProjectExpenseAllocationSerializer(allocation).data, status=status.HTTP_201_CREATED)
        queryset = project.expense_allocations.select_related("budget_category").order_by("-spent_at", "-created_at")
        return response.Response(ProjectExpenseAllocationSerializer(queryset, many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def documents(self, request, pk=None):
        project = self.get_object()
        if request.method == "POST":
            serializer = ProjectDocumentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            document = ProjectDocument.objects.create(workspace=project.workspace, project=project, uploaded_by=request.user, **serializer.validated_data)
            return response.Response(ProjectDocumentSerializer(document).data, status=status.HTTP_201_CREATED)
        queryset = project.documents.order_by("-created_at")
        return response.Response(ProjectDocumentSerializer(queryset, many=True).data)

    @decorators.action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        project = self.get_object()
        queryset = ProjectActivity.objects.filter(project=project).order_by("-created_at")[:50]
        return response.Response(ProjectActivitySerializer(queryset, many=True).data)

    @decorators.action(detail=True, methods=["get"])
    def reports(self, request, pk=None):
        evaluate_project_alerts(self.get_object())
        return response.Response(project_report_payload(self.get_object()))

    @decorators.action(detail=True, methods=["get"], url_path="report")
    def report(self, request, pk=None):
        evaluate_project_alerts(self.get_object())
        return response.Response(project_report_payload(self.get_object()))

    @decorators.action(detail=True, methods=["post"], url_path="report/export")
    def export_report(self, request, pk=None):
        return response.Response({"project": self.get_object().id, "status": "queued", "formats": ["pdf", "xlsx"], "celery_ready": True})
