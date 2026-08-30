from django.db import models


class BudgetPeriodType(models.TextChoices):
    MONTHLY = "MONTHLY", "Mensuel"
    QUARTERLY = "QUARTERLY", "Trimestriel"
    SEMIANNUAL = "SEMIANNUAL", "Semestriel"
    ANNUAL = "ANNUAL", "Annuel"
    CUSTOM = "CUSTOM", "Personnalise"


class BudgetScopeType(models.TextChoices):
    WORKSPACE = "WORKSPACE", "Association"
    PROJECT = "PROJECT", "Projet"
    EVENT = "EVENT", "Evenement"


class BudgetStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    ACTIVE = "ACTIVE", "Actif"
    PAUSED = "PAUSED", "En pause"
    CLOSED = "CLOSED", "Cloture"
    ARCHIVED = "ARCHIVED", "Archive"


class BudgetAlertType(models.TextChoices):
    THRESHOLD_REACHED = "budget.threshold_reached", "Seuil atteint"
    NEARLY_EXCEEDED = "budget.nearly_exceeded", "Presque depasse"
    EXCEEDED = "budget.exceeded", "Depasse"


class BudgetAlertSeverity(models.TextChoices):
    INFO = "INFO", "Information"
    WARNING = "WARNING", "Alerte"
    CRITICAL = "CRITICAL", "Critique"


class BudgetRiskLevel(models.TextChoices):
    NORMAL = "NORMAL", "Normal"
    WATCH = "WATCH", "Surveillance"
    ATTENTION = "ATTENTION", "Attention"
    CRITICAL = "CRITICAL", "Critique"
    EXCEEDED = "EXCEEDED", "Depasse"

