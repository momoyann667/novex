from django.db import models


class EventType(models.TextChoices):
    MEETING = "MEETING", "Reunion"
    GENERAL_ASSEMBLY = "GENERAL_ASSEMBLY", "Assemblee generale"
    TRAINING = "TRAINING", "Formation"
    CONFERENCE = "CONFERENCE", "Conference"
    SEMINAR = "SEMINAR", "Seminaire"
    WORKSHOP = "WORKSHOP", "Atelier"
    CEREMONY = "CEREMONY", "Ceremonie"
    FUNDRAISING = "FUNDRAISING", "Collecte de fonds"
    SOCIAL = "SOCIAL", "Social"
    COMMUNITY = "COMMUNITY", "Communautaire"
    SPORT = "SPORT", "Sport"
    CULTURAL = "CULTURAL", "Culturel"
    OTHER = "OTHER", "Autre"


class EventStatus(models.TextChoices):
    DRAFT = "DRAFT", "Brouillon"
    PLANNED = "PLANNED", "Planifie"
    REGISTRATION_OPEN = "REGISTRATION_OPEN", "Inscriptions ouvertes"
    REGISTRATION_CLOSED = "REGISTRATION_CLOSED", "Inscriptions fermees"
    ONGOING = "ONGOING", "En cours"
    COMPLETED = "COMPLETED", "Termine"
    CANCELLED = "CANCELLED", "Annule"
    POSTPONED = "POSTPONED", "Reporte"
    ARCHIVED = "ARCHIVED", "Archive"


class EventParticipantStatus(models.TextChoices):
    INVITED = "INVITED", "Invite"
    REGISTERED = "REGISTERED", "Inscrit"
    CONFIRMED = "CONFIRMED", "Confirme"
    WAITLISTED = "WAITLISTED", "Liste d'attente"
    DECLINED = "DECLINED", "Refuse"
    ATTENDED = "ATTENDED", "Present"
    ABSENT = "ABSENT", "Absent"
    CANCELLED = "CANCELLED", "Annule"


class EventVisibility(models.TextChoices):
    PRIVATE = "PRIVATE", "Prive"
    MEMBERS_ONLY = "MEMBERS_ONLY", "Membres uniquement"
    WORKSPACE = "WORKSPACE", "Workspace"
    PUBLIC = "PUBLIC", "Public"


class EventLocationType(models.TextChoices):
    PHYSICAL = "PHYSICAL", "Physique"
    ONLINE = "ONLINE", "En ligne"
    HYBRID = "HYBRID", "Hybride"


class EventOrganizerRole(models.TextChoices):
    EVENT_MANAGER = "EVENT_MANAGER", "Responsable evenement"
    CHECKIN_MANAGER = "CHECKIN_MANAGER", "Responsable check-in"
    FINANCE_MANAGER = "FINANCE_MANAGER", "Responsable finance"
    COMMUNICATION_MANAGER = "COMMUNICATION_MANAGER", "Communication"
    OBSERVER = "OBSERVER", "Observateur"


class EventTicketStatus(models.TextChoices):
    RESERVED = "RESERVED", "Reserve"
    CONFIRMED = "CONFIRMED", "Confirme"
    CHECKED_IN = "CHECKED_IN", "Utilise"
    CANCELLED = "CANCELLED", "Annule"


class EventOrderStatus(models.TextChoices):
    PENDING = "PENDING", "En attente"
    PAID = "PAID", "Paye"
    CANCELLED = "CANCELLED", "Annule"


class EventAnnouncementChannel(models.TextChoices):
    IN_APP = "in_app", "In-app"
    EMAIL = "email", "Email"
    WHATSAPP = "whatsapp", "WhatsApp"
    SMS = "sms", "SMS"


class EventRecurrence(models.TextChoices):
    NONE = "none", "Aucune"
    DAILY = "daily", "Quotidienne"
    WEEKLY = "weekly", "Hebdomadaire"
    MONTHLY = "monthly", "Mensuelle"
    YEARLY = "yearly", "Annuelle"


DEFAULT_REMINDER_OFFSETS = [1440, 60]


def default_reminder_offsets() -> list[int]:
    return DEFAULT_REMINDER_OFFSETS.copy()
