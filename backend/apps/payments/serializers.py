from decimal import Decimal

from rest_framework import serializers

from apps.contributions.models import Contribution
from apps.members.models import Member
from .models import Payment, Receipt


class PaymentSerializer(serializers.ModelSerializer):
    receipt_reference = serializers.CharField(source="receipt.reference", read_only=True)

    class Meta:
        model = Payment
        fields = ["id", "workspace", "member", "contribution", "amount", "currency", "provider", "provider_transaction_id", "status", "payment_method", "paid_at", "metadata", "receipt_reference", "created_at", "updated_at"]
        read_only_fields = ["id", "workspace", "provider_transaction_id", "status", "receipt_reference", "created_at", "updated_at"]


class ManualPaymentSerializer(serializers.Serializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())
    contribution = serializers.PrimaryKeyRelatedField(queryset=Contribution.objects.all(), required=False, allow_null=True)
    amount = serializers.DecimalField(max_digits=14, decimal_places=2, min_value=Decimal("0.01"))
    paid_at = serializers.DateTimeField(required=False)
    idempotency_key = serializers.CharField(max_length=160)


class ReceiptSerializer(serializers.ModelSerializer):
    class Meta:
        model = Receipt
        fields = ["id", "payment", "reference", "issued_at", "pdf_file"]
        read_only_fields = ["id", "reference", "issued_at", "pdf_file"]
