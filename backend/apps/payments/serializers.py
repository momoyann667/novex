from decimal import Decimal

from django.db.models import Sum
from rest_framework import serializers

from apps.contributions.models import Contribution
from apps.members.models import Member
from apps.projects.models import Project
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
        return str(obj.member) if obj.member_id else ""


class PaymentInitializeSerializer(serializers.Serializer):
    contribution = serializers.PrimaryKeyRelatedField(queryset=Contribution.objects.all())
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    idempotency_key = serializers.CharField(max_length=160)
    payment_method = serializers.ChoiceField(
        choices=[PaymentMethod.MOBILE_MONEY, PaymentMethod.CARD, PaymentMethod.AGGREGATOR, PaymentMethod.BANK_TRANSFER],
        default=PaymentMethod.MOBILE_MONEY,
    )
    provider = serializers.CharField(max_length=64, required=False, allow_blank=True)


class PayableContributionSerializer(serializers.ModelSerializer):
    campaign_name = serializers.CharField(source="campaign.name", read_only=True)
    period_label = serializers.CharField(source="campaign.period_label", read_only=True)
    period_start = serializers.DateField(source="campaign.period_start", read_only=True)
    period_end = serializers.DateField(source="campaign.period_end", read_only=True)
    remaining_amount = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Contribution
        fields = [
            "id",
            "campaign",
            "campaign_name",
            "period_label",
            "period_start",
            "period_end",
            "amount_due",
            "amount_paid",
            "waived_amount",
            "remaining_amount",
            "currency",
            "due_date",
            "status",
        ]
        read_only_fields = fields


class DonationProjectSerializer(serializers.ModelSerializer):
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    funding_received = serializers.SerializerMethodField()
    funding_remaining = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "name", "description", "status", "status_label", "budget", "currency", "progress", "image", "funding_received", "funding_remaining"]
        read_only_fields = fields

    def get_funding_received(self, obj):
        return obj.financial_transactions.filter(source="DONATION").aggregate(total=Sum("amount"))["total"] or 0

    def get_funding_remaining(self, obj):
        received = self.get_funding_received(obj)
        return max(obj.budget - received, Decimal("0.00"))


class SelfContributionPaymentItemSerializer(serializers.Serializer):
    contribution = serializers.PrimaryKeyRelatedField(queryset=Contribution.objects.all())
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))


class SelfPaymentInitializeSerializer(serializers.Serializer):
    type = serializers.ChoiceField(choices=["CONTRIBUTION", "DONATION"])
    items = SelfContributionPaymentItemSerializer(many=True, required=False)
    project = serializers.PrimaryKeyRelatedField(queryset=Project.objects.all(), required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"), required=False)
    idempotency_key = serializers.CharField(max_length=160)
    payment_method = serializers.ChoiceField(
        choices=[PaymentMethod.MOBILE_MONEY, PaymentMethod.CARD, PaymentMethod.AGGREGATOR, PaymentMethod.BANK_TRANSFER],
        default=PaymentMethod.MOBILE_MONEY,
    )
    provider = serializers.CharField(max_length=64, required=False, allow_blank=True)

    def validate(self, attrs):
        payment_type = attrs.get("type")
        if payment_type == "CONTRIBUTION" and not attrs.get("items"):
            raise serializers.ValidationError({"items": "Selectionnez au moins une cotisation."})
        if payment_type == "DONATION":
            if not attrs.get("project"):
                raise serializers.ValidationError({"project": "Selectionnez un projet a soutenir."})
            if attrs.get("amount") is None:
                raise serializers.ValidationError({"amount": "Le montant du don est obligatoire."})
        return attrs


class SelfPaymentInitializeResultSerializer(serializers.Serializer):
    payments = PaymentSerializer(many=True)
    checkout_url = serializers.CharField(allow_blank=True)
    status = serializers.CharField()
    provider = serializers.CharField()
    online_available = serializers.BooleanField()


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
