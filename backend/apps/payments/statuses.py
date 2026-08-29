from django.db import models


class PaymentStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    PROCESSING = "PROCESSING", "Traitement"
    SUCCESS = "SUCCESS", "Reussi"
    FAILED = "FAILED", "Echoue"
    CANCELLED = "CANCELLED", "Annule"
    EXPIRED = "EXPIRED", "Expire"
    REFUNDED = "REFUNDED", "Rembourse"
    PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED", "Partiellement rembourse"


class PaymentMethod(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    CASH = "CASH", "Especes"
    CHECK = "CHECK", "Cheque"
    OTHER = "OTHER", "Autre"
    EXTERNAL_MOBILE_MONEY = "EXTERNAL_MOBILE_MONEY", "Mobile Money externe"
    MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
    CARD = "CARD", "Carte bancaire"
    AGGREGATOR = "AGGREGATOR", "Agregateur"
    BANK_TRANSFER = "BANK_TRANSFER", "Virement"


class PaymentEventType(models.TextChoices):
    INITIALIZED = "payment.initialized", "Initialise"
    PROCESSING = "payment.processing", "Traitement"
    SUCCEEDED = "payment.succeeded", "Reussi"
    FAILED = "payment.failed", "Echoue"
    CANCELLED = "payment.cancelled", "Annule"
    EXPIRED = "payment.expired", "Expire"
    REFUNDED = "payment.refunded", "Rembourse"
    WEBHOOK_RECEIVED = "payment.webhook_received", "Webhook recu"
    WEBHOOK_REJECTED = "payment.webhook_rejected", "Webhook rejete"


TERMINAL_PAYMENT_STATUSES = {
    PaymentStatus.SUCCESS,
    PaymentStatus.FAILED,
    PaymentStatus.CANCELLED,
    PaymentStatus.EXPIRED,
    PaymentStatus.REFUNDED,
    PaymentStatus.PARTIALLY_REFUNDED,
}

ALLOWED_PAYMENT_TRANSITIONS = {
    PaymentStatus.PENDING: {PaymentStatus.PROCESSING, PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED},
    PaymentStatus.PROCESSING: {PaymentStatus.SUCCESS, PaymentStatus.FAILED, PaymentStatus.CANCELLED, PaymentStatus.EXPIRED},
    PaymentStatus.SUCCESS: {PaymentStatus.REFUNDED, PaymentStatus.PARTIALLY_REFUNDED},
    PaymentStatus.FAILED: set(),
    PaymentStatus.CANCELLED: set(),
    PaymentStatus.EXPIRED: set(),
    PaymentStatus.REFUNDED: set(),
    PaymentStatus.PARTIALLY_REFUNDED: {PaymentStatus.REFUNDED},
}
