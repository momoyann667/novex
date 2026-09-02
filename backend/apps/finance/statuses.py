from django.db import models


class FinancialTransactionType(models.TextChoices):
    INCOME = "INCOME", "Recette"
    EXPENSE = "EXPENSE", "Depense"


class FinancialTransactionStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PENDING = "PENDING", "En attente"
    VALIDATED = "VALIDATED", "Validee"
    REJECTED = "REJECTED", "Refusee"
    CANCELLED = "CANCELLED", "Annulee"


class FinancialTransactionSource(models.TextChoices):
    MANUAL = "MANUAL", "Manuel"
    CONTRIBUTION = "CONTRIBUTION", "Cotisation"
    PAYMENT = "PAYMENT", "Paiement"
    DONATION = "DONATION", "Don"
    GRANT = "GRANT", "Subvention"
    SPONSORSHIP = "SPONSORSHIP", "Sponsoring"
    EVENT = "EVENT", "Evenement"
    PROJECT = "PROJECT", "Projet"
    OTHER = "OTHER", "Autre"


class FinancialTransactionSenderType(models.TextChoices):
    MEMBER = "MEMBER", "Membre"
    OTHER = "OTHER", "Autre"


class FinancialCategoryKind(models.TextChoices):
    INCOME_CATEGORY = "INCOME_CATEGORY", "Categorie recette"
    EXPENSE_CATEGORY = "EXPENSE_CATEGORY", "Categorie depense"


class ExpensePaymentMethod(models.TextChoices):
    CASH = "CASH", "Especes"
    MOBILE_MONEY = "MOBILE_MONEY", "Mobile Money"
    BANK_TRANSFER = "BANK_TRANSFER", "Virement"
    CARD = "CARD", "Carte"
    OTHER = "OTHER", "Autre"


class FiscalPeriodStatus(models.TextChoices):
    OPEN = "OPEN", "Ouverte"
    CLOSED = "CLOSED", "Cloturee"


class FinancialDocumentType(models.TextChoices):
    INVOICE = "INVOICE", "Facture"
    RECEIPT = "RECEIPT", "Recu"
    VOUCHER = "VOUCHER", "Bon"
    PHOTO = "PHOTO", "Photo"
    PDF = "PDF", "PDF"
    OTHER = "OTHER", "Autre"
