from rest_framework import response, status, views

from common.permissions.workspace import RequireWorkspacePermission
from .serializers import SubscriptionCheckoutSerializer
from .services import cancel_subscription, create_subscription_checkout, reactivate_subscription, retry_subscription_payment, subscription_overview, subscription_payments_overview


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class SubscriptionOverviewView(views.APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("subscriptions.view")]

    def get(self, request):
        return response.Response(subscription_overview(workspace=current_workspace(request)))


class SubscriptionCheckoutView(views.APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("subscriptions.manage")]

    def post(self, request):
        serializer = SubscriptionCheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payload = create_subscription_checkout(workspace=current_workspace(request), actor=request.user, plan_code=serializer.validated_data["plan"])
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(payload, status=status.HTTP_201_CREATED)


class SubscriptionCancelView(views.APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("subscriptions.manage")]

    def post(self, request):
        cancel_subscription(workspace=current_workspace(request), actor=request.user)
        return response.Response(subscription_overview(workspace=current_workspace(request)))


class SubscriptionReactivateView(views.APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("subscriptions.manage")]

    def post(self, request):
        reactivate_subscription(workspace=current_workspace(request), actor=request.user)
        return response.Response(subscription_overview(workspace=current_workspace(request)))


class SubscriptionPaymentsView(views.APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("subscriptions.view")]

    def get(self, request):
        filters = {key: request.query_params.get(key) for key in ["period", "status", "plan", "search", "date_from", "date_to"] if request.query_params.get(key)}
        page = int(request.query_params.get("page", "1"))
        page_size = int(request.query_params.get("page_size", "10"))
        return response.Response(subscription_payments_overview(workspace=current_workspace(request), filters=filters, page=page, page_size=page_size))


class SubscriptionPaymentRetryView(views.APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("subscriptions.manage")]

    def post(self, request, payment_id):
        try:
            payload = retry_subscription_payment(workspace=current_workspace(request), actor=request.user, payment_id=payment_id)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(payload, status=status.HTTP_201_CREATED)
