from django.http import FileResponse
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework import decorators, filters, response, status, views, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from apps.members.models import Member
from .models import FinancialAdjustment, Payment, Receipt
from .serializers import (
    FinancialAdjustmentSerializer,
    DonationProjectSerializer,
    ManualPaymentSerializer,
    PayableContributionSerializer,
    PaymentDocumentSerializer,
    PaymentInitializeSerializer,
    PaymentRefundSerializer,
    PaymentSerializer,
    ReceiptSendSerializer,
    ReceiptSerializer,
    SelfPaymentInitializeSerializer,
)
from .services import (
    attach_payment_document,
    create_financial_adjustment,
    delete_payment_document,
    donation_projects_for_workspace,
    financial_history,
    initialize_contribution_payment,
    initialize_donation_payment,
    initialize_self_contribution_payments,
    member_financial_history,
    payment_dashboard,
    payable_contributions_for_member,
    process_payment_webhook,
    receipt_downloaded,
    record_manual_payment,
    request_refund,
    send_receipt,
)


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class PaymentViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = PaymentSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["reference", "provider_transaction_id", "member__first_name", "member__last_name", "member__phone", "contribution__campaign__name"]
    ordering_fields = ["created_at", "paid_at", "amount", "status", "payment_method"]
    permission_classes = [RequireWorkspacePermission.for_permission("payments.view")]

    def get_permissions(self):
        permission_map = {
            "list": "payments.view",
            "retrieve": "payments.view_details",
            "manual": "payments.manage",
            "initialize": "payments.manage",
            "self_contributions": "payments.view",
            "donation_projects": "payments.view",
            "self_initialize": "payments.view",
            "dashboard": "payments.view",
            "refund": "payments.refund",
            "result": "payments.view_details",
            "documents": "payment_documents.view" if self.request.method == "GET" else "payment_documents.upload",
            "delete_document": "payment_documents.delete",
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
        if self.request.query_params.get("method"):
            queryset = queryset.filter(payment_method=self.request.query_params["method"])
        if self.request.query_params.get("campaign"):
            queryset = queryset.filter(contribution__campaign_id=self.request.query_params["campaign"])
        if self.request.query_params.get("member"):
            queryset = queryset.filter(member_id=self.request.query_params["member"])
        if self.request.query_params.get("date_from"):
            queryset = queryset.filter(created_at__date__gte=self.request.query_params["date_from"])
        if self.request.query_params.get("date_to"):
            queryset = queryset.filter(created_at__date__lte=self.request.query_params["date_to"])
        if self.request.query_params.get("amount_min"):
            queryset = queryset.filter(amount__gte=self.request.query_params["amount_min"])
        if self.request.query_params.get("amount_max"):
            queryset = queryset.filter(amount__lte=self.request.query_params["amount_max"])
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

    @decorators.action(detail=False, methods=["get"], url_path="contributions")
    def self_contributions(self, request):
        workspace = current_workspace(request)
        try:
            payload = payable_contributions_for_member(workspace=workspace, user=request.user)
        except ValueError as exc:
            return response.Response({"message": str(exc), "member": None, "results": []}, status=status.HTTP_200_OK)
        return response.Response(
            {
                "member": {"id": payload["member"].id, "name": str(payload["member"]), "membership_number": payload["member"].membership_number},
                "results": PayableContributionSerializer(payload["contributions"], many=True).data,
            }
        )

    @decorators.action(detail=False, methods=["get"], url_path="donation-projects")
    def donation_projects(self, request):
        return response.Response(DonationProjectSerializer(donation_projects_for_workspace(workspace=current_workspace(request)), many=True).data)

    @decorators.action(detail=False, methods=["post"], url_path="self-initialize")
    def self_initialize(self, request):
        serializer = SelfPaymentInitializeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        workspace = current_workspace(request)
        try:
            if serializer.validated_data["type"] == "CONTRIBUTION":
                payments = initialize_self_contribution_payments(
                    workspace=workspace,
                    actor=request.user,
                    items=serializer.validated_data["items"],
                    payment_method=serializer.validated_data["payment_method"],
                    idempotency_key=serializer.validated_data["idempotency_key"],
                    provider_code=serializer.validated_data.get("provider") or None,
                )
            else:
                payments = [
                    initialize_donation_payment(
                        workspace=workspace,
                        actor=request.user,
                        project=serializer.validated_data["project"],
                        amount=serializer.validated_data["amount"],
                        payment_method=serializer.validated_data["payment_method"],
                        idempotency_key=serializer.validated_data["idempotency_key"],
                        provider_code=serializer.validated_data.get("provider") or None,
                    )
                ]
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        checkout_url = next((payment.checkout_url for payment in payments if payment.checkout_url), "")
        return response.Response(
            {
                "payments": PaymentSerializer(payments, many=True).data,
                "checkout_url": checkout_url,
                "status": payments[0].status if payments else "PENDING",
                "provider": payments[0].provider if payments else "",
                "online_available": bool(checkout_url),
            },
            status=status.HTTP_201_CREATED,
        )

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
        return response.Response(payment_dashboard(workspace=current_workspace(request), range_code=request.query_params.get("range", "30d"), group_by=request.query_params.get("group_by", "day")))

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

    @decorators.action(detail=True, methods=["get", "post"], parser_classes=[MultiPartParser, FormParser], url_path="documents")
    def documents(self, request, pk=None):
        payment = self.get_object()
        if request.method == "POST":
            serializer = PaymentDocumentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                document = attach_payment_document(payment=payment, actor=request.user, **serializer.validated_data)
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(PaymentDocumentSerializer(document).data, status=status.HTTP_201_CREATED)
        return response.Response(PaymentDocumentSerializer(payment.documents.filter(deleted_at__isnull=True).order_by("-created_at"), many=True).data)

    @decorators.action(detail=True, methods=["delete"], url_path="documents/(?P<document_id>[^/.]+)")
    def delete_document(self, request, pk=None, document_id=None):
        payment = self.get_object()
        document = payment.documents.filter(id=document_id, deleted_at__isnull=True).first()
        if not document:
            return response.Response({"message": "Justificatif introuvable."}, status=status.HTTP_404_NOT_FOUND)
        delete_payment_document(document=document, actor=request.user)
        return response.Response(status=status.HTTP_204_NO_CONTENT)

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
    permission_classes = [RequireWorkspacePermission.for_permission("receipts.view")]

    def get_permissions(self):
        permission_map = {"download": "receipts.download", "send": "receipts.send"}
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "receipts.view"))()]

    def get_queryset(self):
        return Receipt.objects.select_related("payment", "member", "contribution").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )

    @decorators.action(detail=True, methods=["get"], url_path="download")
    def download(self, request, pk=None):
        receipt = receipt_downloaded(receipt=self.get_object(), actor=request.user)
        if not receipt.pdf_file:
            return response.Response({"message": "PDF non disponible."}, status=status.HTTP_404_NOT_FOUND)
        return FileResponse(receipt.pdf_file.open("rb"), as_attachment=True, filename=f"{receipt.receipt_number}.pdf")

    @decorators.action(detail=True, methods=["post"], url_path="send")
    def send(self, request, pk=None):
        serializer = ReceiptSendSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = send_receipt(receipt=self.get_object(), actor=request.user, channel=serializer.validated_data["channel"])
        return response.Response(result, status=status.HTTP_202_ACCEPTED)


class FinancialHistoryView(views.APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("financial_history.view")]

    def get(self, request):
        workspace = current_workspace(request)
        filters_payload = {key: request.query_params.get(key) for key in ["date_from", "date_to", "type", "member", "reference", "status"] if request.query_params.get(key)}
        return response.Response(financial_history(workspace=workspace, filters=filters_payload))


class MemberFinancialHistoryView(views.APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("financial_history.view")]

    def get(self, request, member_id):
        workspace = current_workspace(request)
        member = Member.objects.filter(workspace=workspace, id=member_id).first()
        if not member:
            return response.Response({"message": "Membre introuvable."}, status=status.HTTP_404_NOT_FOUND)
        return response.Response(member_financial_history(workspace=workspace, member=member))


class FinancialAdjustmentViewSet(viewsets.ModelViewSet):
    serializer_class = FinancialAdjustmentSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("financial_adjustments.manage")]

    def get_queryset(self):
        return FinancialAdjustment.objects.filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        ).order_by("-created_at")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            adjustment = create_financial_adjustment(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(adjustment).data, status=status.HTTP_201_CREATED)
