from django.db import models


class ProjectStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PLANNED = "PLANNED", "Planifie"
    ACTIVE = "ACTIVE", "Actif"
    ON_HOLD = "ON_HOLD", "En pause"
    COMPLETED = "COMPLETED", "Termine"
    CANCELLED = "CANCELLED", "Annule"
    ARCHIVED = "ARCHIVED", "Archive"


class ProjectPriority(models.TextChoices):
    LOW = "LOW", "Basse"
    MEDIUM = "MEDIUM", "Moyenne"
    HIGH = "HIGH", "Haute"
    CRITICAL = "CRITICAL", "Critique"


class ProjectVisibility(models.TextChoices):
    PRIVATE = "PRIVATE", "Prive"
    TEAM = "TEAM", "Equipe"
    WORKSPACE = "WORKSPACE", "Workspace"


class ProjectRole(models.TextChoices):
    PROJECT_MANAGER = "PROJECT_MANAGER", "Responsable projet"
    MEMBER = "MEMBER", "Membre"
    FINANCE = "FINANCE", "Finance"
    OBSERVER = "OBSERVER", "Observateur"


class ProjectObjectiveStatus(models.TextChoices):
    NOT_STARTED = "NOT_STARTED", "Non demarre"
    IN_PROGRESS = "IN_PROGRESS", "En cours"
    ACHIEVED = "ACHIEVED", "Atteint"
    AT_RISK = "AT_RISK", "A risque"
    CANCELLED = "CANCELLED", "Annule"


class ProjectMilestoneStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    IN_PROGRESS = "IN_PROGRESS", "En cours"
    COMPLETED = "COMPLETED", "Termine"
    DELAYED = "DELAYED", "En retard"


class ProjectTaskStatus(models.TextChoices):
    TODO = "TODO", "A faire"
    IN_PROGRESS = "IN_PROGRESS", "En cours"
    BLOCKED = "BLOCKED", "Bloque"
    DONE = "DONE", "Termine"
    CANCELLED = "CANCELLED", "Annule"


class ProjectRiskLevel(models.TextChoices):
    LOW = "LOW", "Faible"
    MEDIUM = "MEDIUM", "Moyen"
    HIGH = "HIGH", "Eleve"
    CRITICAL = "CRITICAL", "Critique"


class ProjectAlertType(models.TextChoices):
    TASK_OVERDUE = "project.task_overdue", "Tache en retard"
    DEADLINE_NEAR = "project.deadline_near", "Echeance proche"
    BUDGET_NEAR_LIMIT = "project.budget_near_limit", "Budget proche limite"
    BUDGET_EXCEEDED = "project.budget_exceeded", "Budget depasse"
    MILESTONE_DELAYED = "project.milestone_delayed", "Jalon en retard"
