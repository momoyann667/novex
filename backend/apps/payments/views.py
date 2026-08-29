from rest_framework import decorators, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Payment, Receipt
from .serializers import ManualPaymentSerializer, PaymentSerializer, ReceiptSerializer
from .services import record_manual_payment, register_webhook_event


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("payments.view")]

    def get_permissions(self):
        if self.action == "manual":
            return [RequireWorkspacePermission.for_permission("payments.create")()]
        if self.action == "webhook":
            return []
        return [RequireWorkspacePermission.for_permission("payments.view")()]

    def get_queryset(self):
        queryset = Payment.objects.select_related("member", "contribution", "receipt").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        if self.request.query_params.get("status"):
            queryset = queryset.filter(status=self.request.query_params["status"])
        if self.request.query_params.get("provider"):
            queryset = queryset.filter(provider=self.request.query_params["provider"])
        return queryset

    @decorators.action(detail=False, methods=["post"], url_path="manual")
    def manual(self, request):
        serializer = ManualPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace = current_workspace(request)
        payment = record_manual_payment(workspace=workspace, actor=request.user, **serializer.validated_data)
        return response.Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=["post"], permission_classes=[], url_path="webhooks/(?P<provider>[^/.]+)")
    def webhook(self, request, provider=None):
        event_id = request.headers.get("X-Provider-Event-ID") or request.data.get("event_id")
        if not event_id:
            return response.Response({"message": "Identifiant evenement manquant."}, status=status.HTTP_400_BAD_REQUEST)
        signature = request.headers.get("X-Provider-Signature", "")
        event, created = register_webhook_event(provider=provider or "unknown", event_id=event_id, payload=request.data, signature_valid=bool(signature))
        return response.Response({"event_id": event.event_id, "created": created, "processed": False}, status=status.HTTP_202_ACCEPTED)


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReceiptSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("payments.view")]

    def get_queryset(self):
        return Receipt.objects.select_related("payment").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
