from decimal import Decimal

from rest_framework import serializers

from apps.contributions.models import Contribution
from apps.members.models import Member
from .models import FinancialAdjustment, Payment, PaymentDocument, PaymentEvent, Receipt
from .statuses import FinancialAdjustmentDirection, PaymentDocumentType, PaymentMethod


class PaymentEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentEvent
        fields = ["id", "event_type", "from_status", "to_status", "metadata", "created_at"]
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    receipt_reference = serializers.CharField(source="receipt.reference", read_only=True)
    receipt_number = serializers.CharField(source="receipt.receipt_number", read_only=True)
    member_name = serializers.SerializerMethodField()
    events = PaymentEventSerializer(many=True, read_only=True)

    class Meta:
        model = Payment
        fields = [
            "id",
            "workspace",
            "member",
            "contribution",
            "reference",
            "amount",
            "provider_fee",
            "novex_fee",
            "net_amount",
            "currency",
            "provider",
            "provider_transaction_id",
            "checkout_url",
            "status",
            "payment_method",
            "paid_at",
            "metadata",
            "receipt_reference",
            "receipt_number",
            "member_name",
            "reconciliation_status",
            "refund_amount",
            "refund_reference",
            "refund_reason",
            "refunded_at",
            "events",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_member_name(self, obj):
        return str(obj.member)


class PaymentInitializeSerializer(serializers.Serializer):
    contribution = serializers.PrimaryKeyRelatedField(queryset=Contribution.objects.all())
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    idempotency_key = serializers.CharField(max_length=160)
    payment_method = serializers.ChoiceField(
        choices=[PaymentMethod.MOBILE_MONEY, PaymentMethod.CARD, PaymentMethod.AGGREGATOR, PaymentMethod.BANK_TRANSFER],
        default=PaymentMethod.MOBILE_MONEY,
    )
    provider = serializers.CharField(max_length=64, required=False, allow_blank=True)


class PaymentRefundSerializer(serializers.Serializer):
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False)


class ManualPaymentSerializer(serializers.Serializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())
    contribution = serializers.PrimaryKeyRelatedField(queryset=Contribution.objects.all(), required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    paid_at = serializers.DateTimeField(required=False)
    idempotency_key = serializers.CharField(max_length=160)
    payment_method = serializers.ChoiceField(choices=PaymentMethod.choices, default=PaymentMethod.MANUAL)


class ReceiptSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()
    payment_reference = serializers.CharField(source="payment.reference", read_only=True)

    class Meta:
        model = Receipt
        fields = [
            "id",
            "workspace",
            "payment",
            "payment_reference",
            "contribution",
            "member",
            "member_name",
            "reference",
            "receipt_number",
            "amount",
            "currency",
            "status",
            "issued_at",
            "pdf_url",
            "pdf_file",
            "storage_key",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields

    def get_member_name(self, obj):
        return str(obj.member)


class ReceiptSendSerializer(serializers.Serializer):
    channel = serializers.ChoiceField(choices=["in_app", "email", "whatsapp", "sms"], default="in_app")


class PaymentDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentDocument
        fields = ["id", "payment", "title", "file", "document_type", "mime_type", "size_bytes", "scan_status", "uploaded_by", "deleted_at", "created_at"]
        read_only_fields = ["id", "payment", "mime_type", "size_bytes", "scan_status", "uploaded_by", "deleted_at", "created_at"]

    def validate_document_type(self, value):
        if value not in PaymentDocumentType.values:
            raise serializers.ValidationError("Type de justificatif invalide.")
        return value


class FinancialAdjustmentSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialAdjustment
        fields = ["id", "payment", "contribution", "member", "direction", "amount", "currency", "reason", "reference", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["payment"].queryset = Payment.objects.filter(workspace=workspace)
            self.fields["contribution"].queryset = Contribution.objects.filter(workspace=workspace)
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)

    def validate_direction(self, value):
        if value not in FinancialAdjustmentDirection.values:
            raise serializers.ValidationError("Direction invalide.")
        return value

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit etre positif.")
        return value

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        if not workspace:
            return attrs
        for field in ["payment", "contribution", "member"]:
            item = attrs.get(field)
            if item and item.workspace_id != workspace.id:
                raise serializers.ValidationError({field: "Cette ressource appartient a un autre workspace."})
        return attrs
