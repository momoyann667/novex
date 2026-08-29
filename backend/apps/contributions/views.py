from rest_framework import decorators, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Contribution, ContributionCampaign, ReminderRule
from .serializers import ContributionCampaignSerializer, ContributionSerializer, ReminderRuleSerializer
from .services import create_campaign, generate_contributions_for_campaign


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class ContributionCampaignViewSet(viewsets.ModelViewSet):
    serializer_class = ContributionCampaignSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("contributions.view")]

    def get_permissions(self):
        permission_map = {
            "create": "contributions.create",
            "update": "contributions.manage",
            "partial_update": "contributions.manage",
            "destroy": "contributions.manage",
            "generate": "contributions.create",
        }
        permission_code = permission_map.get(self.action, "contributions.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        return ContributionCampaign.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        campaign = create_campaign(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        return response.Response(ContributionCampaignSerializer(campaign).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["post"])
    def generate(self, request, pk=None):
        campaign = self.get_object()
        created = generate_contributions_for_campaign(campaign=campaign, actor=request.user)
        return response.Response({"created": created}, status=status.HTTP_201_CREATED)


class ContributionViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ContributionSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("contributions.view")]

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
        return queryset


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
