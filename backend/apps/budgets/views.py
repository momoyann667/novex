from rest_framework import decorators, filters, response, status, viewsets
from rest_framework.views import APIView

from common.permissions.workspace import RequireWorkspacePermission
from .models import Budget, BudgetLine
from .serializers import BudgetExpenseAssignmentSerializer, BudgetLineSerializer, BudgetSerializer, BudgetSettingsSerializer
from .services import (
    activate_budget,
    archive_budget,
    archive_budget_line,
    assign_expense_to_budget,
    budget_alerts,
    budget_analytics,
    budget_dashboard,
    budget_export_payload,
    budget_settings,
    close_budget,
    create_budget,
    create_budget_line,
    update_budget,
    update_budget_line,
)


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class BudgetDashboardView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("budgets.view")]

    def get(self, request):
        year = request.query_params.get("year")
        return response.Response(budget_dashboard(workspace=current_workspace(request), year=int(year) if year else None))


class BudgetSettingsView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("budgets.manage_alerts")]

    def get(self, request):
        return response.Response(BudgetSettingsSerializer(budget_settings(current_workspace(request))).data)

    def patch(self, request):
        settings = budget_settings(current_workspace(request))
        serializer = BudgetSettingsSerializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(serializer.data)


class BudgetViewSet(viewsets.ModelViewSet):
    serializer_class = BudgetSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "project__name", "event__title"]
    ordering_fields = ["start_date", "end_date", "total_amount", "status", "created_at"]

    def get_permissions(self):
        permission_map = {
            "create": "budgets.create",
            "update": "budgets.update",
            "partial_update": "budgets.update",
            "activate": "budgets.activate",
            "close": "budgets.close",
            "archive": "budgets.archive",
            "lines": "budgets.update" if self.request.method == "POST" else "budgets.view",
            "line_detail": "budgets.update",
            "assign_expense": "budgets.assign_expense",
            "export": "budgets.export",
            "alerts": "budgets.view",
            "analytics": "budgets.view",
        }
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "budgets.view"))()]

    def get_queryset(self):
        queryset = Budget.objects.filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        ).select_related("workspace", "project", "event").prefetch_related("lines__category")
        for key, field in {"status": "status", "scope": "scope_type", "project": "project_id", "event": "event_id"}.items():
            if self.request.query_params.get(key):
                queryset = queryset.filter(**{field: self.request.query_params[key]})
        if self.request.query_params.get("year"):
            year = int(self.request.query_params["year"])
            queryset = queryset.filter(start_date__year__lte=year, end_date__year__gte=year)
        return queryset.order_by("-start_date", "-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            budget = create_budget(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(budget).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        serializer = self.get_serializer(self.get_object(), data=request.data, partial=kwargs.pop("partial", False))
        serializer.is_valid(raise_exception=True)
        try:
            budget = update_budget(budget=self.get_object(), actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(budget).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @decorators.action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        try:
            budget = activate_budget(budget=self.get_object(), actor=request.user)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(budget).data)

    @decorators.action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        try:
            budget = close_budget(budget=self.get_object(), actor=request.user)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(budget).data)

    @decorators.action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        try:
            budget = archive_budget(budget=self.get_object(), actor=request.user)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(budget).data)

    @decorators.action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        return response.Response(budget_analytics(budget=self.get_object()))

    @decorators.action(detail=True, methods=["get", "post"], url_path="lines")
    def lines(self, request, pk=None):
        budget = self.get_object()
        if request.method == "POST":
            serializer = BudgetLineSerializer(data=request.data, context=self.get_serializer_context())
            serializer.is_valid(raise_exception=True)
            try:
                line = create_budget_line(budget=budget, actor=request.user, **serializer.validated_data)
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(BudgetLineSerializer(line, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)
        return response.Response(BudgetLineSerializer(budget.lines.select_related("category"), many=True, context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["patch", "delete"], url_path=r"lines/(?P<line_id>[^/.]+)")
    def line_detail(self, request, pk=None, line_id=None):
        budget = self.get_object()
        line = BudgetLine.objects.get(workspace=budget.workspace, budget=budget, id=line_id)
        if request.method == "DELETE":
            archive_budget_line(line=line, actor=request.user)
            return response.Response(status=status.HTTP_204_NO_CONTENT)
        serializer = BudgetLineSerializer(line, data=request.data, partial=True, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        try:
            line = update_budget_line(line=line, actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(BudgetLineSerializer(line, context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["post"], url_path="assign-expense")
    def assign_expense(self, request, pk=None):
        serializer = BudgetExpenseAssignmentSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        try:
            assignment = assign_expense_to_budget(transaction_obj=serializer.validated_data["transaction"], actor=request.user, budget_line=serializer.validated_data["budget_line"], is_manual=True)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response({"id": assignment.id, "budget": assignment.budget_id, "budget_line": assignment.budget_line_id})

    @decorators.action(detail=True, methods=["get"])
    def export(self, request, pk=None):
        return response.Response(budget_export_payload(budget=self.get_object()))

    @decorators.action(detail=False, methods=["get"])
    def alerts(self, request):
        filters_payload = {key: request.query_params.get(key) for key in ["status", "budget", "date", "severity"] if request.query_params.get(key)}
        return response.Response(budget_alerts(workspace=current_workspace(request), filters=filters_payload))
