from typing import Protocol


class PaymentProvider(Protocol):
    code: str

    def validate_webhook(self, *, payload: dict, signature: str) -> bool:
        ...

    def extract_transaction(self, *, payload: dict) -> dict:
        ...


class ManualPaymentProvider:
    code = "manual"

    def validate_webhook(self, *, payload: dict, signature: str) -> bool:
        return False

    def extract_transaction(self, *, payload: dict) -> dict:
        raise NotImplementedError("Manual payments are not confirmed by webhook.")
