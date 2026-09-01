from django.conf import settings
from rest_framework.permissions import BasePermission


class IsWorkspaceMember(BasePermission):
    message = "Vous n'avez pas acces a ce workspace."

    def has_object_permission(self, request, view, obj):
        return obj.memberships.filter(user=request.user, status="active").exists()


class IsWorkspaceOwner(BasePermission):
    message = "Seul le proprietaire peut modifier ce workspace."

    def has_object_permission(self, request, view, obj):
        return obj.owner_id == request.user.id


class RequireWorkspacePermission(BasePermission):
    required_permission = "workspace.view"
    message = "Vous n'avez pas les permissions necessaires."

    @classmethod
    def for_permission(cls, permission_code: str):
        return type(f"Require_{permission_code.replace('.', '_')}", (cls,), {"required_permission": permission_code})

    def has_permission(self, request, view):
        workspace_slug = request.headers.get("X-Workspace")
        if not workspace_slug or not request.user or not request.user.is_authenticated:
            return False
        membership = (
            request.user.workspace_memberships.filter(workspace__slug=workspace_slug, status="active")
            .select_related("role", "workspace")
            .prefetch_related("role__role_permissions__permission")
            .first()
        )
        if not membership:
            return False
        if settings.DEBUG:
            return True
        permissions = {rp.permission.code for rp in membership.role.role_permissions.all()}
        return "*" in permissions or self.required_permission in permissions
