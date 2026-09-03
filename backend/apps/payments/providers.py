import hashlib
import hmac
import json
import os
from dataclasses import dataclass
from typing import Protocol

from .statuses import PaymentStatus


class PaymentProvider(Protocol):
    code: str

    def initialize_payment(self, *, payment) -> "ProviderInitResult":
        ...

    def get_payment_status(self, *, payment) -> str:
        ...

    def verify_payment(self, *, payment, payload: dict | None = None) -> bool:
        ...

    def handle_webhook(self, *, payload: dict, signature: str) -> dict:
        ...

    def refund_payment(self, *, payment, amount=None) -> dict:
        ...

    def validate_webhook(self, *, payload: dict, signature: str) -> bool:
        ...

    def extract_transaction(self, *, payload: dict) -> dict:
        ...


@dataclass(frozen=True)
class ProviderInitResult:
    provider_transaction_id: str
    checkout_url: str
    status: str
    raw_response: dict


class ManualPaymentProvider:
    code = "manual"

    def initialize_payment(self, *, payment) -> ProviderInitResult:
        raise NotImplementedError("Manual payments do not use provider checkout.")

    def validate_webhook(self, *, payload: dict, signature: str) -> bool:
        return False

    def get_payment_status(self, *, payment) -> str:
        return payment.status

    def verify_payment(self, *, payment, payload: dict | None = None) -> bool:
        return False

    def handle_webhook(self, *, payload: dict, signature: str) -> dict:
        raise NotImplementedError("Manual payments are not confirmed by webhook.")

    def refund_payment(self, *, payment, amount=None) -> dict:
        return {"status": "not_configured", "payment": payment.reference, "amount": str(amount or payment.amount)}

    def extract_transaction(self, *, payload: dict) -> dict:
        raise NotImplementedError("Manual payments are not confirmed by webhook.")


class EnvironmentHmacProvider:
    def __init__(self, code: str = "env_hmac") -> None:
        self.code = code

    def initialize_payment(self, *, payment) -> ProviderInitResult:
        return ProviderInitResult(
            provider_transaction_id=f"{self.code}-{payment.reference}",
            checkout_url="",
            status=PaymentStatus.PROCESSING,
            raw_response={"configured": bool(os.environ.get("NOVEX_PAYMENT_WEBHOOK_SECRET"))},
        )

    def validate_webhook(self, *, payload: dict, signature: str) -> bool:
        secret = os.environ.get("NOVEX_PAYMENT_WEBHOOK_SECRET")
        if not secret or not signature:
            return False
        body = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode()
        expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return hmac.compare_digest(signature, expected)

    def get_payment_status(self, *, payment) -> str:
        return payment.status

    def verify_payment(self, *, payment, payload: dict | None = None) -> bool:
        if not payload:
            return False
        data = self.extract_transaction(payload=payload)
        return (
            data.get("reference") == payment.reference
            and str(data.get("amount")) == str(payment.amount)
            and data.get("currency") == payment.currency
        )

    def handle_webhook(self, *, payload: dict, signature: str) -> dict:
        return {"signature_valid": self.validate_webhook(payload=payload, signature=signature), "transaction": self.extract_transaction(payload=payload)}

    def refund_payment(self, *, payment, amount=None) -> dict:
        return {"status": "not_configured", "payment": payment.reference, "amount": str(amount or payment.amount)}

    def extract_transaction(self, *, payload: dict) -> dict:
        return {
            "reference": payload.get("reference", ""),
            "provider_transaction_id": payload.get("provider_transaction_id", ""),
            "status": payload.get("status", ""),
            "amount": payload.get("amount"),
            "currency": payload.get("currency", ""),
        }


def get_payment_provider(provider_code: str | None = None) -> PaymentProvider:
    if provider_code == ManualPaymentProvider.code:
        return ManualPaymentProvider()
    return EnvironmentHmacProvider(provider_code or "env_hmac")
