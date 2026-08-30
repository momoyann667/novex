from django.db import models


class ReportType(models.TextChoices):
    OVERVIEW = "overview", "Vue d'ensemble"
    FINANCE = "finance", "Finance"
    MEMBERS = "members", "Membres"
    CONTRIBUTIONS = "contributions", "Cotisations"
    PROJECTS = "projects", "Projets"
    EVENTS = "events", "Evenements"
    DOCUMENTS = "documents", "Documents"
    ACTIVITY = "activity", "Activite"
    PERFORMANCE = "performance", "Performance"
    ANNUAL = "annual", "Annuel"


class WidgetType(models.TextChoices):
    KPI = "kpi", "KPI"
    CHART = "chart", "Graphique"
    TABLE = "table", "Table"
    PROGRESS = "progress", "Progression"
    ALERT = "alert", "Alerte"


class ShareSubjectType(models.TextChoices):
    MEMBER = "member", "Membre"
    ROLE = "role", "Role"
    TEAM = "team", "Equipe"


class ScheduledReportFrequency(models.TextChoices):
    WEEKLY = "weekly", "Hebdomadaire"
    MONTHLY = "monthly", "Mensuelle"
    QUARTERLY = "quarterly", "Trimestrielle"


class ExportFormat(models.TextChoices):
    PDF = "pdf", "PDF"
    XLSX = "xlsx", "Excel"
    CSV = "csv", "CSV"


class ExportStatus(models.TextChoices):
    PENDING = "pending", "En attente"
    PROCESSING = "processing", "En traitement"
    COMPLETED = "completed", "Termine"
    FAILED = "failed", "Echoue"
