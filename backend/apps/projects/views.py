from rest_framework import decorators, filters, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Project, ProjectActivity, ProjectBudgetCategory, ProjectDocument, ProjectExpenseAllocation
from .serializers import (
    ProjectActivitySerializer,
    ProjectBudgetCategorySerializer,
    ProjectDocumentSerializer,
    ProjectExpenseAllocationSerializer,
    ProjectSerializer,
)
from .services import add_expense_allocation, create_project, delete_project, update_project, workspace_project_stats


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
            "budget_categories": "projects.manage_budget",
            "expenses": "projects.manage_budget" if self.request.method == "POST" else "projects.view",
            "documents": "projects.manage_documents" if self.request.method == "POST" else "projects.view",
            "activity": "projects.view",
            "reports": "projects.view_reports",
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

    @decorators.action(detail=False, methods=["get"])
    def stats(self, request):
        return response.Response(workspace_project_stats(current_workspace(request)))

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
        project = self.get_object()
        return response.Response(
            {
                "project": project.id,
                "budget": ProjectSerializer(project, context=self.get_serializer_context()).data["budget_summary"],
                "budget_categories": ProjectBudgetCategorySerializer(project.budget_categories.all(), many=True).data,
                "expenses": ProjectExpenseAllocationSerializer(project.expense_allocations.all(), many=True).data,
            }
        )
