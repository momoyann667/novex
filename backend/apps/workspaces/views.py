from rest_framework import decorators, mixins, response, viewsets
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from common.permissions.workspace import IsWorkspaceMember, IsWorkspaceOwner
from apps.audit_logs.models import AuditLog
from .models import Workspace
from .serializers import WorkspaceCreateSerializer, WorkspaceSerializer, WorkspaceSettingsSerializer
from .services import ensure_workspace_settings


class WorkspaceViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    lookup_field = "slug"

    def get_queryset(self):
        return Workspace.objects.filter(memberships__user=self.request.user, memberships__status="active").distinct()

    def get_permissions(self):
        if self.action == "create":
            return super().get_permissions()
        if self.action == "workspace_settings" and self.request.method == "PATCH":
            return [IsWorkspaceOwner()]
        if self.action == "workspace_settings":
            return [IsWorkspaceMember()]
        if self.action in ["update", "partial_update"]:
            return [IsWorkspaceOwner()]
        return [IsWorkspaceMember()]

    def get_serializer_class(self):
        if self.action == "create":
            return WorkspaceCreateSerializer
        return WorkspaceSerializer

    @decorators.action(detail=True, methods=["get", "patch"], parser_classes=[JSONParser, MultiPartParser, FormParser], url_path="settings")
    def workspace_settings(self, request, slug=None):
        workspace = self.get_object()
        workspace_settings = ensure_workspace_settings(workspace)
        if request.method == "PATCH":
            serializer = WorkspaceSettingsSerializer(workspace_settings, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            workspace_settings = serializer.save()
            AuditLog.objects.create(
                workspace=workspace_settings.workspace,
                actor=request.user,
                action="workspace.settings_updated",
                resource="workspace_settings",
                resource_id=str(workspace_settings.id),
                metadata={"fields": sorted(serializer.validated_data.keys())},
            )
            return response.Response(WorkspaceSettingsSerializer(workspace_settings).data)
        return response.Response(WorkspaceSettingsSerializer(workspace_settings).data)
