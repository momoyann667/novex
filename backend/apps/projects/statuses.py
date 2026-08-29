from django.db import models


class ProjectStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PLANNED = "PLANNED", "Planifie"
    ACTIVE = "ACTIVE", "Actif"
    ON_HOLD = "ON_HOLD", "En pause"
    COMPLETED = "COMPLETED", "Termine"
    CANCELLED = "CANCELLED", "Annule"


class ProjectPriority(models.TextChoices):
    LOW = "LOW", "Basse"
    MEDIUM = "MEDIUM", "Moyenne"
    HIGH = "HIGH", "Haute"
    CRITICAL = "CRITICAL", "Critique"
