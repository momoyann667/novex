from rest_framework import mixins, viewsets

from common.permissions.workspace import IsWorkspaceMember
from .models import Workspace
from .serializers import WorkspaceCreateSerializer, WorkspaceSerializer


class WorkspaceViewSet(mixins.CreateModelMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    lookup_field = "slug"

    def get_queryset(self):
        return Workspace.objects.filter(memberships__user=self.request.user, memberships__status="active").distinct()

    def get_permissions(self):
        if self.action == "create":
            return super().get_permissions()
        return [IsWorkspaceMember()]

    def get_serializer_class(self):
        if self.action == "create":
            return WorkspaceCreateSerializer
        return WorkspaceSerializer
