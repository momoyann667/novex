from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response

from apps.workspaces.models import WorkspaceMembership
from common.permissions.workspace import RequireWorkspacePermission
from .services import get_dashboard_overview


@api_view(["GET"])
@permission_classes([RequireWorkspacePermission.for_permission("workspace.view")])
def overview(request):
    workspace_slug = request.headers.get("X-Workspace")
    membership = (
        WorkspaceMembership.objects.select_related("workspace", "role")
        .prefetch_related("role__role_permissions__permission")
        .get(user=request.user, workspace__slug=workspace_slug, status=WorkspaceMembership.Status.ACTIVE)
    )
    permissions = {rp.permission.code for rp in membership.role.role_permissions.all()}
    data = get_dashboard_overview(
        workspace=membership.workspace,
        period_code=request.query_params.get("period"),
        user_permissions=permissions,
    )
    return Response(data)
