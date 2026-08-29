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
    REFUND_REQUESTED = "payment.refund_requested", "Remboursement demande"
    RECEIPT_CREATED = "receipt.created", "Recu cree"
    RECEIPT_GENERATED = "receipt.generated", "Recu genere"
    RECEIPT_DOWNLOADED = "receipt.downloaded", "Recu telecharge"
    RECEIPT_SENT = "receipt.sent", "Recu envoye"
    PAYMENT_DOCUMENT_UPLOADED = "payment_document.uploaded", "Justificatif ajoute"
    PAYMENT_DOCUMENT_DELETED = "payment_document.deleted", "Justificatif supprime"
    FINANCIAL_ADJUSTMENT_CREATED = "financial_adjustment.created", "Ajustement financier cree"


class ReceiptStatus(models.TextChoices):
    GENERATED = "GENERATED", "Genere"
    SENT = "SENT", "Envoye"
    CANCELLED = "CANCELLED", "Annule"


class PaymentDocumentType(models.TextChoices):
    RECEIPT = "RECEIPT", "Recu"
    PROOF_OF_PAYMENT = "PROOF_OF_PAYMENT", "Preuve de paiement"
    BANK_TRANSFER = "BANK_TRANSFER", "Virement bancaire"
    MOBILE_MONEY_PROOF = "MOBILE_MONEY_PROOF", "Preuve Mobile Money"
    OTHER = "OTHER", "Autre"


class ScanStatus(models.TextChoices):
    NOT_CONFIGURED = "NOT_CONFIGURED", "Scan non configure"
    PENDING = "PENDING", "Scan en attente"
    CLEAN = "CLEAN", "Fichier sain"
    INFECTED = "INFECTED", "Fichier infecte"


class ReconciliationStatus(models.TextChoices):
    UNMATCHED = "UNMATCHED", "Non rapproche"
    MATCHED = "MATCHED", "Rapproche"
    REVIEW_REQUIRED = "REVIEW_REQUIRED", "Revue requise"


class FinancialAdjustmentStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    POSTED = "POSTED", "Comptabilise"
    CANCELLED = "CANCELLED", "Annule"


class FinancialAdjustmentDirection(models.TextChoices):
    IN = "IN", "Entree"
    OUT = "OUT", "Sortie"


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
