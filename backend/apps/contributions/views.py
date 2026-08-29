from rest_framework import decorators, filters, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Contribution, ContributionCampaign, ReminderRule
from .serializers import (
    ContributionCampaignSerializer,
    ContributionManualPaymentSerializer,
    ContributionSerializer,
    ContributionWaiverSerializer,
    ReminderRuleSerializer,
)
from .services import (
    activate_campaign,
    campaign_contribution_stats,
    cancel_campaign,
    cancel_contribution,
    contribution_dashboard,
    create_campaign,
    generate_contributions_for_campaign,
    record_manual_contribution_payment,
    update_campaign,
    update_contribution,
    waive_contribution,
)


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class ContributionCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = ContributionCampaignSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "period_label"]
    ordering_fields = ["created_at", "due_date", "period_start", "amount", "name"]
    permission_classes = [RequireWorkspacePermission.for_permission("contributions.view")]

    def get_permissions(self):
        permission_map = {
            "create": "contributions.create",
            "update": "contributions.update",
            "partial_update": "contributions.update",
            "destroy": "contributions.cancel",
            "generate": "contributions.create",
            "activate": "contributions.manage",
            "cancel": "contributions.cancel",
            "stats": "contributions.view_reports",
            "members": "contributions.view",
        }
        permission_code = permission_map.get(self.action, "contributions.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        queryset = ContributionCampaign.objects.filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        if self.request.query_params.get("status"):
            queryset = queryset.filter(status=self.request.query_params["status"])
        if self.request.query_params.get("type"):
            queryset = queryset.filter(contribution_type=self.request.query_params["type"])
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = create_campaign(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        return response.Response(ContributionCampaignSerializer(campaign, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        campaign = self.get_object()
        serializer = self.get_serializer(campaign, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        campaign = update_campaign(campaign=campaign, actor=request.user, **serializer.validated_data)
        return response.Response(ContributionCampaignSerializer(campaign, context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        campaign = self.get_object()
        created = generate_contributions_for_campaign(campaign=campaign, actor=request.user)
        return response.Response({"created": created}, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["post"])
    def activate(self, request, pk=None):
        created = activate_campaign(campaign=self.get_object(), actor=request.user)
        return response.Response({"created": created}, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        cancelled = cancel_campaign(campaign=self.get_object(), actor=request.user)
        return response.Response({"cancelled": cancelled}, status=status.HTTP_200_OK)

    @decorators.action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        campaign = self.get_object()
        return response.Response(campaign_contribution_stats(campaign))

    @decorators.action(detail=True, methods=["get"])
    def members(self, request, pk=None):
        campaign = self.get_object()
        queryset = campaign.contributions.select_related("member").order_by("member__last_name", "member__first_name")
        return response.Response(ContributionSerializer(queryset, many=True).data)


class ContributionViewSet(viewsets.ModelViewSet):
    serializer_class = ContributionSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["member__first_name", "member__last_name", "member__phone", "member__membership_number"]
    ordering_fields = ["created_at", "due_date", "amount_due", "amount_paid", "status"]
    permission_classes = [RequireWorkspacePermission.for_permission("contributions.view")]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def get_permissions(self):
        permission_map = {
            "create": "contributions.create",
            "update": "contributions.update",
            "partial_update": "contributions.update",
            "destroy": "contributions.cancel",
            "cancel": "contributions.cancel",
            "waive": "contributions.waive",
            "payments": "contributions.record_payment" if self.request.method == "POST" else "contributions.view",
            "dashboard": "contributions.view",
            "stats": "contributions.view_reports",
        }
        permission_code = permission_map.get(self.action, "contributions.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        queryset = Contribution.objects.select_related("member", "campaign").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        if self.request.query_params.get("status"):
            queryset = queryset.filter(status=self.request.query_params["status"])
        if self.request.query_params.get("campaign"):
            queryset = queryset.filter(campaign_id=self.request.query_params["campaign"])
        if self.request.query_params.get("member"):
            queryset = queryset.filter(member_id=self.request.query_params["member"])
        if self.request.query_params.get("due_before"):
            queryset = queryset.filter(due_date__lte=self.request.query_params["due_before"])
        if self.request.query_params.get("due_after"):
            queryset = queryset.filter(due_date__gte=self.request.query_params["due_after"])
        return queryset

    def perform_create(self, serializer):
        serializer.save(workspace=current_workspace(self.request))

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        contribution = self.get_object()
        serializer = self.get_serializer(contribution, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        contribution = update_contribution(contribution=contribution, actor=request.user, **serializer.validated_data)
        return response.Response(ContributionSerializer(contribution).data)

    def perform_destroy(self, instance):
        cancel_contribution(contribution=instance, actor=self.request.user)

    @decorators.action(detail=False, methods=["get"])
    def dashboard(self, request):
        return response.Response(contribution_dashboard(workspace=current_workspace(request), period=request.query_params.get("period")))

    @decorators.action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        item = self.get_object()
        return response.Response(
            {
                "amount_due": item.amount_due,
                "amount_paid": item.amount_paid,
                "waived_amount": item.waived_amount,
                "remaining_amount": item.remaining_amount,
                "status": item.status,
            }
        )

    @decorators.action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        item = cancel_contribution(contribution=self.get_object(), actor=request.user)
        return response.Response(ContributionSerializer(item).data)

    @decorators.action(detail=True, methods=["post"])
    def waive(self, request, pk=None):
        serializer = ContributionWaiverSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        item = waive_contribution(contribution=self.get_object(), actor=request.user, **serializer.validated_data)
        return response.Response(ContributionSerializer(item).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def payments(self, request, pk=None):
        contribution = self.get_object()
        if request.method == "POST":
            serializer = ContributionManualPaymentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            payment = record_manual_contribution_payment(contribution=contribution, actor=request.user, **serializer.validated_data)
            return response.Response({"payment_id": payment.id, "status": payment.status}, status=status.HTTP_201_CREATED)
        return response.Response(
            [
                {"id": payment.id, "amount": payment.amount, "status": payment.status, "paid_at": payment.paid_at, "method": payment.payment_method}
                for payment in contribution.payments.order_by("-created_at")
            ]
        )


class ReminderRuleViewSet(viewsets.ModelViewSet):
    serializer_class = ReminderRuleSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("contributions.view")]

    def get_permissions(self):
        permission_map = {
            "create": "contributions.manage",
            "update": "contributions.manage",
            "partial_update": "contributions.manage",
            "destroy": "contributions.manage",
        }
        permission_code = permission_map.get(self.action, "contributions.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        return ReminderRule.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(workspace=current_workspace(self.request))
