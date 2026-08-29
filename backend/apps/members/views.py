from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import filters, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Member, MemberCategory
from .serializers import MemberCategorySerializer, MemberSerializer
from .services import archive_member, create_member


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "phone", "email", "membership_number"]
    ordering_fields = ["created_at", "join_date", "last_name", "membership_number"]
    permission_classes = [RequireWorkspacePermission.for_permission("members.view")]

    def get_permissions(self):
        permission_map = {
            "create": "members.create",
            "update": "members.update",
            "partial_update": "members.update",
            "destroy": "members.archive",
            "archive": "members.archive",
        }
        permission_code = permission_map.get(self.action, "members.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        workspace = self.request.headers.get("X-Workspace")
        queryset = Member.objects.select_related("category", "workspace").filter(
            workspace__slug=workspace,
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        status_value = self.request.query_params.get("status")
        category = self.request.query_params.get("category")
        city = self.request.query_params.get("city")
        if status_value:
            queryset = queryset.filter(status=status_value)
        if category:
            queryset = queryset.filter(category_id=category)
        if city:
            queryset = queryset.filter(city__icontains=city)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace = self.request.user.workspace_memberships.get(workspace__slug=self.request.headers.get("X-Workspace"), status="active").workspace
        member = create_member(workspace=workspace, actor=self.request.user, **serializer.validated_data)
        return Response(MemberSerializer(member).data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        member = self.get_object()
        archive_member(member=member, actor=request.user)
        return Response(MemberSerializer(member).data, status=status.HTTP_200_OK)


class MemberCategoryViewSet(viewsets.ModelViewSet):
    serializer_class = MemberCategorySerializer
    permission_classes = [RequireWorkspacePermission.for_permission("members.view")]

    def get_permissions(self):
        permission_map = {
            "create": "members.update",
            "update": "members.update",
            "partial_update": "members.update",
            "destroy": "members.update",
        }
        permission_code = permission_map.get(self.action, "members.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        return MemberCategory.objects.filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )

    def perform_create(self, serializer):
        workspace = self.request.user.workspace_memberships.get(workspace__slug=self.request.headers.get("X-Workspace"), status="active").workspace
        serializer.save(workspace=workspace)
