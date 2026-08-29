from rest_framework import viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Member
from .serializers import MemberSerializer


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("members.view")]

    def get_queryset(self):
        workspace = self.request.headers.get("X-Workspace")
        return Member.objects.filter(workspace__slug=workspace, workspace__memberships__user=self.request.user, workspace__memberships__status="active")

    def perform_create(self, serializer):
        workspace = self.request.user.workspace_memberships.get(workspace__slug=self.request.headers.get("X-Workspace"), status="active").workspace
        serializer.save(workspace=workspace)
