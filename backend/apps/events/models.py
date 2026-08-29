from decimal import Decimal

from django.conf import settings
from django.db import models
from django.utils import timezone

from apps.members.models import Member
from apps.projects.models import Project
from apps.workspaces.models import Workspace
from .statuses import EventParticipantStatus, EventRecurrence, EventStatus, EventType, default_reminder_offsets


class Event(models.Model):
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="events")
    title = models.CharField(max_length=180)
    description = models.TextField(blank=True)
    event_type = models.CharField(max_length=32, choices=EventType.choices, default=EventType.OTHER)
    status = models.CharField(max_length=24, choices=EventStatus.choices, default=EventStatus.DRAFT)
    start_at = models.DateTimeField()
    end_at = models.DateTimeField()
    location = models.CharField(max_length=180, blank=True)
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
    project = models.ForeignKey(Project, on_delete=models.SET_NULL, null=True, blank=True, related_name="events")
    recurrence = models.CharField(max_length=16, choices=EventRecurrence.choices, default=EventRecurrence.NONE)
    reminder_offsets = models.JSONField(default=default_reminder_offsets, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["workspace", "start_at"]),
            models.Index(fields=["workspace", "end_at"]),
            models.Index(fields=["workspace", "status"]),
            models.Index(fields=["workspace", "event_type"]),
            models.Index(fields=["workspace", "project"]),
        ]

    def __str__(self) -> str:
        return self.title


class EventParticipant(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE, related_name="participants")
    workspace = models.ForeignKey(Workspace, on_delete=models.CASCADE, related_name="event_participants")
    member = models.ForeignKey(Member, on_delete=models.CASCADE, related_name="event_participations")
    status = models.CharField(max_length=24, choices=EventParticipantStatus.choices, default=EventParticipantStatus.INVITED)
    responded_at = models.DateTimeField(null=True, blank=True)
    attendance_status = models.CharField(max_length=24, choices=EventParticipantStatus.choices, default=EventParticipantStatus.INVITED)
    checked_in_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["event", "member"], name="uniq_event_member_participant")]
        indexes = [models.Index(fields=["workspace", "event", "status"]), models.Index(fields=["workspace", "member"])]

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
