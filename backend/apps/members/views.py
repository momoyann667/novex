from rest_framework import filters, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from common.permissions.workspace import RequireWorkspacePermission
from .models import Member, MemberCategory, MemberCustomFieldDefinition, MemberGroup, MemberTag
from .serializers import (
    MemberCategorySerializer,
    MemberCustomFieldDefinitionSerializer,
    MemberGroupSerializer,
    MemberSerializer,
    MemberSummarySerializer,
    MemberTagSerializer,
)
from .services import archive_member, create_member, member_seniority, restore_member, update_member


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "phone", "email", "membership_number", "function"]
    ordering_fields = ["created_at", "updated_at", "join_date", "last_name", "status", "membership_number"]
    ordering = ["last_name", "first_name"]
    permission_classes = [RequireWorkspacePermission.for_permission("members.view")]

    def get_permissions(self):
        permission_map = {
            "create": "members.create",
            "update": "members.update",
            "partial_update": "members.update",
            "destroy": "members.archive",
            "archive": "members.archive",
            "restore": "members.restore",
            "summary": "members.view",
        }
        permission_code = permission_map.get(self.action, "members.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        workspace = self.request.headers.get("X-Workspace")
        queryset = (
            Member.objects.select_related("category", "workspace", "linked_user")
            .prefetch_related("tags", "groups")
            .filter(
                workspace__slug=workspace,
                workspace__memberships__user=self.request.user,
                workspace__memberships__status="active",
            )
            .distinct()
        )
        filters_map = {
            "status": "status",
            "function": "function__iexact",
            "category": "category_id",
            "city": "city__icontains",
            "joined_from": "join_date__gte",
            "joined_to": "join_date__lte",
        }
        for key, field in filters_map.items():
            value = self.request.query_params.get(key)
            if value:
                queryset = queryset.filter(**{field: value})
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tags = serializer.validated_data.pop("tags", None)
        groups = serializer.validated_data.pop("groups", None)
        member = create_member(workspace=current_workspace(request), actor=request.user, tags=tags, groups=groups, **serializer.validated_data)
        return Response(self.get_serializer(member).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        member = self.get_object()
        serializer = self.get_serializer(member, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        tags = serializer.validated_data.pop("tags", None)
        groups = serializer.validated_data.pop("groups", None)
        updated = update_member(member=member, actor=request.user, tags=tags, groups=groups, **serializer.validated_data)
        return Response(self.get_serializer(updated).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        member = archive_member(member=self.get_object(), actor=request.user)
        return Response(self.get_serializer(member).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        member = archive_member(member=self.get_object(), actor=request.user)
        return Response(self.get_serializer(member).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        member = restore_member(member=self.get_object(), actor=request.user)
        return Response(self.get_serializer(member).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        member = self.get_object()
        rows = member.activities.select_related("actor").order_by("-created_at")[:50]
        from .serializers import MemberActivitySerializer

        return Response(MemberActivitySerializer(rows, many=True).data)

    @action(detail=True, methods=["get"], url_path="seniority")
    def seniority(self, request, pk=None):
        return Response(member_seniority(self.get_object()))

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        payload = {
            "total": queryset.count(),
            "active": queryset.filter(status=Member.Status.ACTIVE).count(),
            "inactive": queryset.filter(status=Member.Status.INACTIVE).count(),
            "suspended": queryset.filter(status=Member.Status.SUSPENDED).count(),
            "archived": queryset.filter(status=Member.Status.ARCHIVED).count(),
        }
        return Response(MemberSummarySerializer(payload).data)


class WorkspaceScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [RequireWorkspacePermission.for_permission("members.view")]

    def get_permissions(self):
        permission_map = {"create": "members.update", "update": "members.update", "partial_update": "members.update", "destroy": "members.update"}
        permission_code = permission_map.get(self.action, "members.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        return self.model.objects.filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(workspace=current_workspace(self.request))


class MemberCategoryViewSet(WorkspaceScopedViewSet):
    model = MemberCategory
    serializer_class = MemberCategorySerializer


class MemberTagViewSet(WorkspaceScopedViewSet):
    model = MemberTag
    serializer_class = MemberTagSerializer


class MemberGroupViewSet(WorkspaceScopedViewSet):
    model = MemberGroup
    serializer_class = MemberGroupSerializer


class MemberCustomFieldDefinitionViewSet(WorkspaceScopedViewSet):
    model = MemberCustomFieldDefinition
    serializer_class = MemberCustomFieldDefinitionSerializer

    def get_permissions(self):
        permission_map = {"create": "members.manage_custom_fields", "update": "members.manage_custom_fields", "partial_update": "members.manage_custom_fields", "destroy": "members.manage_custom_fields"}
        permission_code = permission_map.get(self.action, "members.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]
