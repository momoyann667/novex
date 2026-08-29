from rest_framework import decorators, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Payment, Receipt
from .serializers import ManualPaymentSerializer, PaymentInitializeSerializer, PaymentRefundSerializer, PaymentSerializer, ReceiptSerializer
from .services import initialize_contribution_payment, payment_dashboard, process_payment_webhook, record_manual_payment, request_refund


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("payments.view")]

    def get_permissions(self):
        permission_map = {
            "list": "payments.view",
            "retrieve": "payments.view_details",
            "manual": "payments.manage",
            "initialize": "payments.manage",
            "dashboard": "payments.view",
            "refund": "payments.refund",
            "result": "payments.view_details",
        }
        if self.action == "webhook":
            return []
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "payments.view"))()]

    def get_queryset(self):
        queryset = Payment.objects.select_related("member", "contribution", "receipt").prefetch_related("events").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        if self.request.query_params.get("status"):
            queryset = queryset.filter(status=self.request.query_params["status"])
        if self.request.query_params.get("provider"):
            queryset = queryset.filter(provider=self.request.query_params["provider"])
        if self.request.query_params.get("reference"):
            queryset = queryset.filter(reference=self.request.query_params["reference"])
        return queryset

    @decorators.action(detail=False, methods=["post"], url_path="manual")
    def manual(self, request):
        serializer = ManualPaymentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace = current_workspace(request)
        try:
            payment = record_manual_payment(workspace=workspace, actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=["post"], url_path="initialize")
    def initialize(self, request):
        serializer = PaymentInitializeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace = current_workspace(request)
        try:
            payment = initialize_contribution_payment(
                workspace=workspace,
                actor=request.user,
                contribution=serializer.validated_data["contribution"],
                amount=serializer.validated_data["amount"],
                payment_method=serializer.validated_data["payment_method"],
                idempotency_key=serializer.validated_data["idempotency_key"],
                provider_code=serializer.validated_data.get("provider") or None,
            )
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(PaymentSerializer(payment).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=False, methods=["get"], url_path="dashboard")
    def dashboard(self, request):
        return response.Response(payment_dashboard(workspace=current_workspace(request)))

    @decorators.action(detail=False, methods=["get"], url_path="result")
    def result(self, request):
        reference = request.query_params.get("reference")
        if not reference:
            return response.Response({"message": "Reference paiement manquante."}, status=status.HTTP_400_BAD_REQUEST)
        payment = self.get_queryset().filter(reference=reference).first()
        if not payment:
            return response.Response({"message": "Paiement introuvable."}, status=status.HTTP_404_NOT_FOUND)
        return response.Response(PaymentSerializer(payment).data)

    @decorators.action(detail=True, methods=["post"], url_path="refund")
    def refund(self, request, pk=None):
        serializer = PaymentRefundSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            payment = request_refund(payment=self.get_object(), actor=request.user, amount=serializer.validated_data.get("amount"))
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(PaymentSerializer(payment).data)

    @decorators.action(detail=False, methods=["post"], permission_classes=[], url_path="webhooks/(?P<provider>[^/.]+)")
    def webhook(self, request, provider=None):
        event_id = request.headers.get("X-Provider-Event-ID") or request.data.get("event_id")
        if not event_id:
            return response.Response({"message": "Identifiant evenement manquant."}, status=status.HTTP_400_BAD_REQUEST)
        signature = request.headers.get("X-Provider-Signature", "")
        event, payment, processed = process_payment_webhook(provider_code=provider or "unknown", event_id=event_id, payload=request.data, signature=signature)
        return response.Response(
            {"event_id": event.event_id, "signature_valid": event.signature_valid, "processed": processed, "payment_id": payment.id if payment else None},
            status=status.HTTP_202_ACCEPTED,
        )


class ReceiptViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = ReceiptSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("payments.view")]

    def get_queryset(self):
        return Receipt.objects.select_related("payment").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
