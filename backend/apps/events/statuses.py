from django.db import models


class EventType(models.TextChoices):
    MEETING = "MEETING", "Reunion"
    GENERAL_ASSEMBLY = "GENERAL_ASSEMBLY", "Assemblee generale"
    TRAINING = "TRAINING", "Formation"
    CONFERENCE = "CONFERENCE", "Conference"
    CEREMONY = "CEREMONY", "Ceremonie"
    FUNDRAISING = "FUNDRAISING", "Collecte de fonds"
    COMMUNITY = "COMMUNITY", "Communautaire"
    SPORT = "SPORT", "Sport"
    CULTURAL = "CULTURAL", "Culturel"
    OTHER = "OTHER", "Autre"


class EventStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PLANNED = "PLANNED", "Planifie"
    ONGOING = "ONGOING", "En cours"
    COMPLETED = "COMPLETED", "Termine"
    CANCELLED = "CANCELLED", "Annule"
    POSTPONED = "POSTPONED", "Reporte"


class EventParticipantStatus(models.TextChoices):
    INVITED = "INVITED", "Invite"
    CONFIRMED = "CONFIRMED", "Confirme"
    DECLINED = "DECLINED", "Refuse"
    ATTENDED = "ATTENDED", "Present"
    ABSENT = "ABSENT", "Absent"


class EventRecurrence(models.TextChoices):
    NONE = "none", "Aucune"
    DAILY = "daily", "Quotidienne"
    WEEKLY = "weekly", "Hebdomadaire"
    MONTHLY = "monthly", "Mensuelle"
    YEARLY = "yearly", "Annuelle"


DEFAULT_REMINDER_OFFSETS = [1440, 60]


def default_reminder_offsets() -> list[int]:
    return DEFAULT_REMINDER_OFFSETS.copy()
