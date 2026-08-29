from django.db import models


class ContributionType(models.TextChoices):
    MEMBERSHIP = "MEMBERSHIP", "Adhesion"
    MONTHLY = "MONTHLY", "Mensuelle"
    QUARTERLY = "QUARTERLY", "Trimestrielle"
    YEARLY = "YEARLY", "Annuelle"
    SPECIAL = "SPECIAL", "Speciale"
    EVENT = "EVENT", "Evenementielle"
    PROJECT = "PROJECT", "Projet"
    OTHER = "OTHER", "Autre"


class ContributionPeriodicity(models.TextChoices):
    ONE_TIME = "ONE_TIME", "Ponctuelle"
    MONTHLY = "MONTHLY", "Mensuelle"
    QUARTERLY = "QUARTERLY", "Trimestrielle"
    YEARLY = "YEARLY", "Annuelle"
    CUSTOM = "CUSTOM", "Personnalisee"


class CampaignStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    ACTIVE = "ACTIVE", "Active"
    PAUSED = "PAUSED", "En pause"
    CLOSED = "CLOSED", "Cloturee"
    CANCELLED = "CANCELLED", "Annulee"


class ContributionStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    PARTIALLY_PAID = "PARTIALLY_PAID", "Partiellement payee"
    PAID = "PAID", "Payee"
    OVERDUE = "OVERDUE", "En retard"
    CANCELLED = "CANCELLED", "Annulee"
    WAIVED = "WAIVED", "Exoneree"


class CampaignTargetMode(models.TextChoices):
    ALL_ACTIVE = "ALL_ACTIVE", "Tous les membres actifs"
    CATEGORY = "CATEGORY", "Categorie"
    SELECTED = "SELECTED", "Selection"
    SEGMENT = "SEGMENT", "Segment"


class ContributionReminderKind(models.TextChoices):
    REMINDER = "REMINDER", "Rappel"
    OVERDUE = "OVERDUE", "Relance retard"
    FINAL_NOTICE = "FINAL_NOTICE", "Dernier avis"


class ContributionReminderChannel(models.TextChoices):
    IN_APP = "IN_APP", "NOVEX"
    EMAIL = "EMAIL", "Email"
    SMS = "SMS", "SMS"
    WHATSAPP = "WHATSAPP", "WhatsApp"


class ContributionReminderStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    QUEUED = "QUEUED", "En file"
    SENT = "SENT", "Envoyee"
    FAILED = "FAILED", "Echec"
    CANCELLED = "CANCELLED", "Annulee"


class ContributionExportFormat(models.TextChoices):
    CSV = "CSV", "CSV"
    EXCEL = "EXCEL", "Excel"
    PDF = "PDF", "PDF"
