from decimal import Decimal

from rest_framework import serializers

from apps.contributions.models import Contribution
from apps.members.models import Member
from .models import Payment, PaymentEvent, Receipt
from .statuses import PaymentMethod


class PaymentEventSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentEvent
        fields = ["id", "event_type", "from_status", "to_status", "metadata", "created_at"]
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    receipt_reference = serializers.CharField(source="receipt.reference", read_only=True)
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
            "events",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


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
    class Meta:
        model = Receipt
        fields = ["id", "payment", "reference", "issued_at", "pdf_file"]
        read_only_fields = ["id", "reference", "issued_at", "pdf_file"]
