from rest_framework import decorators, filters, response, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from apps.audit_logs.models import AuditLog
from apps.budgets.models import BudgetLine
from apps.budgets.statuses import BudgetStatus
from common.permissions.workspace import RequireWorkspacePermission
from .models import CostCenter, FinancialCategory, FinancialTransaction, FiscalPeriod
from .serializers import (
    CostCenterSerializer,
    FinancialCategorySerializer,
    FinancialSettingsSerializer,
    FinancialDocumentSerializer,
    FinancialTransactionSerializer,
    FiscalPeriodSerializer,
    TransactionCancelSerializer,
)
from .services import (
    attach_transaction_document,
    cancel_transaction,
    close_fiscal_period,
    create_expense,
    create_income,
    ensure_default_categories,
    expense_budget_cards,
    expense_dashboard,
    finance_dashboard,
    finance_journal,
    financial_settings,
    period_is_closed,
    reject_expense,
    validate_expense,
)
from .statuses import FinancialCategoryKind, FinancialTransactionStatus, FinancialTransactionType


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


def period_query_params(request):
    year = request.query_params.get("year")
    month = request.query_params.get("month")
    return {
        "year": int(year) if year else None,
        "month": int(month) if month and month != "all" else None,
    }


class FinanceDashboardView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("finance.view")]

    def get(self, request):
        return response.Response(finance_dashboard(workspace=current_workspace(request), range_code=request.query_params.get("range", "30d"), group_by=request.query_params.get("group_by", "day")))


class FinanceAnalyticsView(FinanceDashboardView):
    permission_classes = [RequireWorkspacePermission.for_permission("finance.view_reports")]


class FinanceHistoryView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("finance.view")]

    def get(self, request):
        filters_payload = {key: request.query_params.get(key) for key in ["date_from", "date_to", "type", "category", "source", "project", "event", "status", "amount_min", "amount_max", "reference"] if request.query_params.get(key)}
        return response.Response(finance_journal(workspace=current_workspace(request), filters=filters_payload))


class FinancialSettingsView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("finance.update")]

    def get(self, request):
        return response.Response(FinancialSettingsSerializer(financial_settings(current_workspace(request))).data)

    def patch(self, request):
        item = financial_settings(current_workspace(request))
        serializer = FinancialSettingsSerializer(item, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(serializer.data)


class FinancialCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = FinancialCategorySerializer
    permission_classes = [RequireWorkspacePermission.for_permission("finance.manage_categories")]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]

    def get_queryset(self):
        queryset = FinancialCategory.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user, workspace__memberships__status="active")
        if self.request.query_params.get("kind"):
            queryset = queryset.filter(kind=self.request.query_params["kind"])
        return queryset.order_by("kind", "name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def list(self, request, *args, **kwargs):
        ensure_default_categories(current_workspace(request), actor=request.user)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        category = serializer.save(workspace=current_workspace(self.request), created_by=self.request.user)
        AuditLog.objects.create(workspace=category.workspace, actor=self.request.user, action="category.created", resource="financial_category", resource_id=str(category.id))

    @decorators.action(detail=True, methods=["post"], url_path="archive")
    def archive(self, request, pk=None):
        category = self.get_object()
        category.is_active = False
        category.save(update_fields=["is_active", "updated_at"])
        AuditLog.objects.create(workspace=category.workspace, actor=request.user, action="category.archived", resource="financial_category", resource_id=str(category.id))
        return response.Response(self.get_serializer(category).data)


class FinancialTransactionViewSet(viewsets.ModelViewSet):
    serializer_class = FinancialTransactionSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("finance.view")]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["description", "reference", "category__name", "supplier_name"]
    ordering_fields = ["transaction_date", "amount", "status", "created_at"]

    def get_permissions(self):
        permission_map = {
            "create": "finance.update",
            "update": "finance.update",
            "partial_update": "finance.update",
            "validate": "finance.validate_expense",
            "cancel": "finance.cancel",
            "destroy": "finance.cancel",
            "documents": "finance.update" if self.request.method == "POST" else "finance.view",
        }
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "finance.view"))()]

    def get_queryset(self):
        queryset = FinancialTransaction.objects.select_related("category", "project", "event", "cost_center").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        for key, field in {"type": "transaction_type", "category": "category_id", "source": "source", "project": "project_id", "event": "event_id", "status": "status"}.items():
            if self.request.query_params.get(key):
                queryset = queryset.filter(**{field: self.request.query_params[key]})
        if self.request.query_params.get("date_from"):
            queryset = queryset.filter(transaction_date__gte=self.request.query_params["date_from"])
        if self.request.query_params.get("date_to"):
            queryset = queryset.filter(transaction_date__lte=self.request.query_params["date_to"])
        if self.request.query_params.get("amount_min"):
            queryset = queryset.filter(amount__gte=self.request.query_params["amount_min"])
        if self.request.query_params.get("amount_max"):
            queryset = queryset.filter(amount__lte=self.request.query_params["amount_max"])
        return queryset.order_by("-transaction_date", "-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        service = create_income if serializer.validated_data["transaction_type"] == FinancialTransactionType.INCOME else create_expense
        try:
            transaction_obj = service(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(transaction_obj).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        transaction_obj = self.get_object()
        if transaction_obj.status == FinancialTransactionStatus.VALIDATED:
            return response.Response({"message": "Une transaction validee doit etre corrigee par ajustement."}, status=status.HTTP_400_BAD_REQUEST)
        if period_is_closed(transaction_obj.workspace, transaction_obj.transaction_date):
            return response.Response({"message": "La periode comptable est cloturee."}, status=status.HTTP_400_BAD_REQUEST)
        return super().update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        serializer = TransactionCancelSerializer(data=request.data or {"reason": "Annulation demandee"})
        serializer.is_valid(raise_exception=True)
        try:
            transaction_obj = cancel_transaction(transaction_obj=self.get_object(), actor=request.user, reason=serializer.validated_data["reason"])
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(transaction_obj).data)

    @decorators.action(detail=True, methods=["post"])
    def validate(self, request, pk=None):
        try:
            transaction_obj = validate_expense(transaction_obj=self.get_object(), actor=request.user)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(transaction_obj).data)

    @decorators.action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        serializer = TransactionCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            transaction_obj = cancel_transaction(transaction_obj=self.get_object(), actor=request.user, reason=serializer.validated_data["reason"])
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(transaction_obj).data)

    @decorators.action(detail=True, methods=["get", "post"], parser_classes=[MultiPartParser, FormParser], url_path="documents")
    def documents(self, request, pk=None):
        transaction_obj = self.get_object()
        if request.method == "POST":
            serializer = FinancialDocumentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                document = attach_transaction_document(transaction_obj=transaction_obj, actor=request.user, **serializer.validated_data)
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(FinancialDocumentSerializer(document).data, status=status.HTTP_201_CREATED)
        return response.Response(FinancialDocumentSerializer(transaction_obj.documents.order_by("-created_at"), many=True).data)


class IncomeViewSet(FinancialTransactionViewSet):
    def get_permissions(self):
        if self.action == "create":
            return [RequireWorkspacePermission.for_permission("finance.create_income")()]
        return super().get_permissions()

    def get_queryset(self):
        return super().get_queryset().filter(transaction_type=FinancialTransactionType.INCOME)

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["transaction_type"] = FinancialTransactionType.INCOME
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        try:
            transaction_obj = create_income(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(transaction_obj).data, status=status.HTTP_201_CREATED)


class ExpenseViewSet(FinancialTransactionViewSet):
    def get_permissions(self):
        permission_map = {
            "create": "finance.create_expense",
            "dashboard": "finance.view",
            "budgets": "finance.view",
            "categories": "finance.view",
            "budget_lines": "finance.view",
            "reject": "finance.validate_expense",
        }
        if self.action in permission_map:
            return [RequireWorkspacePermission.for_permission(permission_map[self.action])()]
        return super().get_permissions()

    def get_queryset(self):
        queryset = super().get_queryset().filter(transaction_type=FinancialTransactionType.EXPENSE).select_related("budget_assignment", "budget_assignment__budget", "budget_assignment__budget_line", "budget_assignment__budget_line__category", "created_by").prefetch_related("documents")
        params = period_query_params(self.request)
        if params["year"]:
            queryset = queryset.filter(transaction_date__year=params["year"])
        if params["month"]:
            queryset = queryset.filter(transaction_date__month=params["month"])
        if self.request.query_params.get("budget"):
            queryset = queryset.filter(budget_assignment__budget_id=self.request.query_params["budget"])
        return queryset

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        data["transaction_type"] = FinancialTransactionType.EXPENSE
        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        try:
            transaction_obj = create_expense(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(transaction_obj).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=["get"])
    def dashboard(self, request):
        return response.Response(expense_dashboard(workspace=current_workspace(request), **period_query_params(request)))

    @decorators.action(detail=False, methods=["get"])
    def budgets(self, request):
        return response.Response(expense_budget_cards(workspace=current_workspace(request), **period_query_params(request)))

    @decorators.action(detail=False, methods=["get"], url_path="categories")
    def categories(self, request):
        workspace = current_workspace(request)
        ensure_default_categories(workspace, actor=request.user)
        queryset = FinancialCategory.objects.filter(workspace=workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, is_active=True).order_by("name")
        return response.Response(FinancialCategorySerializer(queryset, many=True).data)

    @decorators.action(detail=False, methods=["get"], url_path="budget-lines")
    def budget_lines(self, request):
        from apps.budgets.services import line_summary

        workspace = current_workspace(request)
        queryset = BudgetLine.objects.filter(workspace=workspace, is_active=True, budget__status=BudgetStatus.ACTIVE).select_related("budget", "category").order_by("budget__name", "category__name")
        return response.Response(
            [
                {
                    "id": line.id,
                    "budget_id": line.budget_id,
                    "budget_name": line.budget.name,
                    "category_id": line.category_id,
                    "category_name": line.category.name,
                    "planned_amount": line.planned_amount,
                    "currency": line.budget.currency,
                    "remaining": line_summary(line)["remaining"],
                }
                for line in queryset
            ]
        )

    @decorators.action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        serializer = TransactionCancelSerializer(data=request.data or {"reason": "Depense refusee"})
        serializer.is_valid(raise_exception=True)
        try:
            transaction_obj = reject_expense(transaction_obj=self.get_object(), actor=request.user, reason=serializer.validated_data["reason"])
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(transaction_obj).data)


class CostCenterViewSet(viewsets.ModelViewSet):
    serializer_class = CostCenterSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("finance.update")]

    def get_queryset(self):
        return CostCenter.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user, workspace__memberships__status="active")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def perform_create(self, serializer):
        serializer.save(workspace=current_workspace(self.request))


class FiscalPeriodViewSet(viewsets.ModelViewSet):
    serializer_class = FiscalPeriodSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("finance.view_reports")]

    def get_permissions(self):
        if self.action == "close":
            return [RequireWorkspacePermission.for_permission("finance.close_period")()]
        return [RequireWorkspacePermission.for_permission("finance.view_reports")()]

    def get_queryset(self):
        return FiscalPeriod.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user, workspace__memberships__status="active").order_by("-start_date")

    def perform_create(self, serializer):
        serializer.save(workspace=current_workspace(self.request))

    @decorators.action(detail=True, methods=["post"])
    def close(self, request, pk=None):
        period = close_fiscal_period(period=self.get_object(), actor=request.user)
        return response.Response(self.get_serializer(period).data)
