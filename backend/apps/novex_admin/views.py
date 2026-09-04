from django.shortcuts import get_object_or_404
from rest_framework import response, status, views

from .permissions import IsNovexAdmin
from .services import (
    admin_activity,
    admin_association_detail,
    admin_associations,
    admin_dashboard,
    admin_payments,
    admin_plans,
    admin_reports,
    admin_subscriptions,
    admin_users,
    create_admin_user,
    delete_admin_user,
    update_admin_user,
    update_association_status,
)
from apps.workspaces.models import Workspace


class AdminBaseView(views.APIView):
    permission_classes = [IsNovexAdmin]


class AdminDashboardView(AdminBaseView):
    def get(self, request):
        return response.Response(admin_dashboard(request.query_params.get("period", "30d")))


class AdminAssociationsView(AdminBaseView):
    def get(self, request):
        return response.Response(admin_associations(request.query_params))


class AdminAssociationDetailView(AdminBaseView):
    def get(self, request, workspace_id):
        get_object_or_404(Workspace, id=workspace_id)
        return response.Response(admin_association_detail(workspace_id))


class AdminAssociationSuspendView(AdminBaseView):
    def post(self, request, workspace_id):
        payload = update_association_status(workspace_id=workspace_id, actor=request.user, status=Workspace.Status.SUSPENDED, reason=request.data.get("reason", ""))
        return response.Response(payload)


class AdminAssociationActivateView(AdminBaseView):
    def post(self, request, workspace_id):
        payload = update_association_status(workspace_id=workspace_id, actor=request.user, status=Workspace.Status.ACTIVE, reason=request.data.get("reason", ""))
        return response.Response(payload)


class AdminUsersView(AdminBaseView):
    def get(self, request):
        return response.Response(admin_users(request.query_params))

    def post(self, request):
        try:
            payload = create_admin_user(actor=request.user, data=request.data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(payload, status=status.HTTP_201_CREATED)


class AdminUserDetailView(AdminBaseView):
    def patch(self, request, user_id):
        try:
            payload = update_admin_user(actor=request.user, user_id=user_id, data=request.data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(payload)

    def delete(self, request, user_id):
        try:
            delete_admin_user(actor=request.user, user_id=user_id)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(status=status.HTTP_204_NO_CONTENT)


class AdminSubscriptionsView(AdminBaseView):
    def get(self, request):
        return response.Response(admin_subscriptions(request.query_params))


class AdminPaymentsView(AdminBaseView):
    def get(self, request):
        return response.Response(admin_payments(request.query_params))


class AdminPlansView(AdminBaseView):
    def get(self, request):
        return response.Response(admin_plans())


class AdminActivityView(AdminBaseView):
    def get(self, request):
        return response.Response(admin_activity(request.query_params))


class AdminAuditView(AdminActivityView):
    pass


class AdminReportsView(AdminBaseView):
    def get(self, request):
        return response.Response(admin_reports(request.query_params.get("period", "30d")))


class AdminSettingsView(AdminBaseView):
    def get(self, request):
        return response.Response(
            {
                "admin": request.user.email,
                "security": {"staff_required": True, "superuser_required": True, "impersonation_enabled": False},
                "permissions": ["ADMIN_DASHBOARD_VIEW", "ASSOCIATIONS_VIEW", "USERS_VIEW", "SUBSCRIPTIONS_VIEW", "SAAS_PAYMENTS_VIEW", "PLANS_VIEW"],
            }
        )
