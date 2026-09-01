from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.members.models import Member
from apps.payments.models import Payment
from apps.projects.models import Project
from apps.workspaces.models import Workspace
from .statuses import (
    EventLocationType,
    EventOrderStatus,
    EventOrganizerRole,
    EventParticipantStatus,
    EventRecurrence,
    EventStatus,
    EventTicketStatus,
    EventType,
    EventVisibility,
    default_reminder_offsets,
)


class Event(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="events")
    code = models.CharField(max_length=32, blank=True)
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    cover_image = models.ImageField(upload_to="event-covers/", blank=True)
    event_type = models.CharField(max_length=32, choices=EventType.choices, default=EventType.OTHER)
    status = models.CharField(max_length=24, choices=EventStatus.choices, default=EventStatus.DRAFT)
    visibility = models.CharField(max_length=16, choices=EventVisibility.choices, default=EventVisibility.WORKSPACE)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    timezone = models.CharField(max_length=64, default="Africa/Abidjan")
    location_type = models.CharField(max_length=16, choices=EventLocationType.choices, default=EventLocationType.PHYSICAL)
    location = models.CharField(max_length=180, blank=True)
    address = models.CharField(max_length=220, blank=True)
    city = models.CharField(max_length=120, blank=True)
    country = models.CharField(max_length=2, default="CI")
    online_url = models.URLField(blank=True)
    online_platform = models.CharField(max_length=80, blank=True)
    registration_required = models.BooleanField(default=False)
    registration_deadline = models.DateTimeField(null=True, blank=True)
    owner = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="owned_events")
    responsible_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="responsible_events",
    )
    responsible_member = models.ForeignKey(Member, on_delete=models.SET_NULL, null=True, blank=True, related_name="responsible_events")
    capacity = models.PositiveIntegerField(null=True, blank=True)
    budget = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    ticket_price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
    recurrence = models.CharField(max_length=16, choices=EventRecurrence.choices, default=EventRecurrence.NONE)
    reminder_offsets = models.JSONField(default=default_reminder_offsets, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["workspace", "code"], name="uniq_event_workspace_code")]
        indexes = [
            models.Index(fields=["workspace", "code"]),
            models.Index(fields=["workspace", "start_at"]),
            models.Index(fields=["workspace", "end_at"]),
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "event_type"]),
            models.Index(fields=["workspace", "owner"]),
            models.Index(fields=["workspace", "project"]),
        ]

    def __str__(self) -> str:
        return self.title

    @property
    def name(self) -> str:
        return self.title

    @property
    def start_datetime(self):
        return self.start_at

    @property
    def end_datetime(self):
        return self.end_at


class EventParticipant(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="participants")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_participants")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, null=True, blank=True, related_name="event_participations")
    external_participant = models.ForeignKey("ExternalParticipant", on_delete=models.SET_NULL, null=True, blank=True, related_name="event_participations")
    status = models.CharField(max_length=24, choices=EventParticipantStatus.choices, default=EventParticipantStatus.INVITED)
    registration_data = models.JSONField(default=dict, blank=True)
    qr_code = models.CharField(max_length=120, blank=True)
    responded_at = models.DateTimeField(null=True, blank=True)
    attendance_status = models.CharField(max_length=24, choices=EventParticipantStatus.choices, default=EventParticipantStatus.INVITED)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["event", "member"], name="uniq_event_member_participant")]
        indexes = [
            models.Index(fields=["workspace", "event", "status"]),
            models.Index(fields=["workspace", "member"]),
            models.Index(fields=["workspace", "external_participant"]),
            models.Index(fields=["workspace", "qr_code"]),
        ]

    def mark_response(self, status: str) -> None:
        self.status = status
        self.responded_at = timezone.now()
        self.save(update_fields=["status", "responded_at", "updated_at"])


class EventExpenseAllocation(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_expense_allocations")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="expense_allocations")
    external_expense_id = models.CharField(max_length=120, blank=True)
    label = models.CharField(max_length=180)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    spent_at = models.DateField(default=timezone.localdate)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event", "spent_at"]), models.Index(fields=["workspace", "external_expense_id"])]


class EventRevenueAllocation(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_revenue_allocations")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="revenue_allocations")
    external_revenue_id = models.CharField(max_length=120, blank=True)
    label = models.CharField(max_length=180)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    received_at = models.DateField(default=timezone.localdate)
    notes = models.TextField(blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event", "received_at"]), models.Index(fields=["workspace", "external_revenue_id"])]


class EventDocument(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_documents")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=180)
    file = models.FileField(upload_to="event-documents/", blank=True)
    document_type = models.CharField(max_length=80, blank=True)
    notes = models.TextField(blank=True)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event", "-created_at"])]


class EventActivity(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_activities")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="activities")
    actor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    action = models.CharField(max_length=120)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event", "-created_at"]), models.Index(fields=["action", "-created_at"])]


class ExternalParticipant(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="external_event_participants")
    name = models.CharField(max_length=180)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    organization = models.CharField(max_length=180, blank=True)
    function = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "email"]), models.Index(fields=["workspace", "phone"])]

    def __str__(self) -> str:
        return self.name


class EventOrganizer(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_organizers")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="organizers")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="event_organizer_roles")
    role = models.CharField(max_length=32, choices=EventOrganizerRole.choices, default=EventOrganizerRole.OBSERVER)
    is_active = models.BooleanField(default=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["event", "member"], name="uniq_event_organizer_member")]
        indexes = [models.Index(fields=["workspace", "event"]), models.Index(fields=["workspace", "member"]), models.Index(fields=["workspace", "role"])]


class EventTicketType(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_ticket_types")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="ticket_types")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    currency = models.CharField(max_length=3, default="XOF")
    quantity = models.PositiveIntegerField(default=0)
    available_quantity = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["event", "name"], name="uniq_event_ticket_type_name")]
        indexes = [models.Index(fields=["workspace", "event"]), models.Index(fields=["workspace", "is_active"])]


class TicketOrder(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_ticket_orders")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="ticket_orders")
    participant = models.ForeignKey(EventParticipant, on_delete=models.SET_NULL, null=True, blank=True, related_name="ticket_orders")
    payment = models.OneToOneField(Payment, on_delete=models.PROTECT, null=True, blank=True, related_name="event_ticket_order")
    total_amount = models.DecimalField(max_digits=14, decimal_places=2)
    currency = models.CharField(max_length=3, default="XOF")
    status = models.CharField(max_length=24, choices=EventOrderStatus.choices, default=EventOrderStatus.PENDING)
    reference = models.CharField(max_length=80, unique=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event"]), models.Index(fields=["workspace", "status"]), models.Index(fields=["reference"])]


class EventTicket(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_tickets")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="tickets")
    ticket_type = models.ForeignKey(EventTicketType, on_delete=models.PROTECT, related_name="tickets")
    order = models.ForeignKey(TicketOrder, on_delete=models.CASCADE, related_name="tickets")
    participant = models.ForeignKey(EventParticipant, on_delete=models.SET_NULL, null=True, blank=True, related_name="tickets")
    code = models.CharField(max_length=32, unique=True)
    qr_code = models.CharField(max_length=160, blank=True)
    status = models.CharField(max_length=24, choices=EventTicketStatus.choices, default=EventTicketStatus.RESERVED)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    checked_in_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="checked_event_tickets")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event"]), models.Index(fields=["workspace", "code"]), models.Index(fields=["workspace", "status"])]


class EventSponsor(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_sponsors")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="sponsors")
    name = models.CharField(max_length=180)
    contact = models.CharField(max_length=180, blank=True)
    contribution_amount = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0.00"))
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event"])]


class EventScheduleItem(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_schedule_items")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="schedule_items")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    start_time = models.DateTimeField()
    end_time = models.DateTimeField()
    speaker = models.CharField(max_length=180, blank=True)
    location = models.CharField(max_length=180, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event", "start_time"])]


class EventSpeaker(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_speakers")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="speakers")
    name = models.CharField(max_length=180)
    function = models.CharField(max_length=120, blank=True)
    organization = models.CharField(max_length=180, blank=True)
    biography = models.TextField(blank=True)
    photo = models.ImageField(upload_to="event-speakers/", blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event"])]


class EventFeedback(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_feedback")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="feedback")
    participant = models.ForeignKey(EventParticipant, on_delete=models.SET_NULL, null=True, blank=True, related_name="feedback")
    rating = models.PositiveSmallIntegerField(default=0)
    satisfaction = models.PositiveSmallIntegerField(default=0)
    comment = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event"]), models.Index(fields=["workspace", "rating"])]


class EventAnnouncement(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_announcements")
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="announcements")
    title = models.CharField(max_length=180)
    message = models.TextField()
    channels = models.JSONField(default=list, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["workspace", "event", "-created_at"])]
