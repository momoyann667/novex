from decimal import Decimal

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.members.models import Member
from apps.projects.models import Project
from apps.workspaces.models import Workspace
from .models import Event, EventActivity, EventExpenseAllocation, EventParticipant, EventRevenueAllocation
from .statuses import EventParticipantStatus, EventStatus


ZERO = Decimal("0.00")


def log_event_activity(*, event: Event, actor, action: str, metadata: dict | None = None) -> EventActivity:
    activity = EventActivity.objects.create(
        workspace=event.workspace,
        event=event,
        actor=actor,
        action=action,
        metadata=metadata or {},
    )
    AuditLog.objects.create(
        workspace=event.workspace,
        actor=actor,
        action=action,
        resource="event",
        resource_id=str(event.id),
        metadata=metadata or {},
    )
    return activity


@transaction.atomic
def create_event(*, workspace: Workspace, actor, **data) -> Event:
    event = Event.objects.create(workspace=workspace, created_by=actor, **data)
    log_event_activity(event=event, actor=actor, action="event.created")
    return event


@transaction.atomic
def update_event(*, event: Event, actor, **data) -> Event:
    previous_status = event.status
    for field, value in data.items():
        setattr(event, field, value)
    event.save()
    action = "event.cancelled" if previous_status != event.status and event.status == EventStatus.CANCELLED else "event.updated"
    log_event_activity(event=event, actor=actor, action=action, metadata={"status": event.status})
    return event


def delete_event(*, event: Event, actor) -> None:
    log_event_activity(event=event, actor=actor, action="event.deleted")
    event.delete()


@transaction.atomic
def add_participant(*, event: Event, member: Member, actor) -> EventParticipant:
    if member.workspace_id != event.workspace_id:
        raise ValueError("Le membre n'appartient pas au workspace de l'evenement.")
    participant, created = EventParticipant.objects.get_or_create(workspace=event.workspace, event=event, member=member)
    if created:
        log_event_activity(event=event, actor=actor, action="event.participant_added", metadata={"member_id": member.id})
    return participant


@transaction.atomic
def remove_participant(*, participant: EventParticipant, actor) -> None:
    event = participant.event
    member_id = participant.member_id
    participant.delete()
    log_event_activity(event=event, actor=actor, action="event.participant_removed", metadata={"member_id": member_id})


@transaction.atomic
def update_rsvp(*, participant: EventParticipant, status: str, actor) -> EventParticipant:
    if status not in {EventParticipantStatus.CONFIRMED, EventParticipantStatus.DECLINED, EventParticipantStatus.INVITED}:
        raise ValueError("Statut RSVP invalide.")
    participant.mark_response(status)
    log_event_activity(event=participant.event, actor=actor, action="event.rsvp_updated", metadata={"member_id": participant.member_id, "status": status})
    return participant


@transaction.atomic
def update_attendance(*, participant: EventParticipant, attended: bool, actor) -> EventParticipant:
    participant.attendance_status = EventParticipantStatus.ATTENDED if attended else EventParticipantStatus.ABSENT
    participant.status = participant.attendance_status
    participant.checked_in_at = timezone.now() if attended else None
    participant.save(update_fields=["attendance_status", "status", "checked_in_at", "updated_at"])
    log_event_activity(
        event=participant.event,
        actor=actor,
        action="event.attendance_updated",
        metadata={"member_id": participant.member_id, "attended": attended},
    )
    return participant


def event_finance_summary(event: Event) -> dict:
    expenses = event.expense_allocations.aggregate(total=Sum("amount"))["total"] or ZERO
    revenues = event.revenue_allocations.aggregate(total=Sum("amount"))["total"] or ZERO
    remaining = event.budget - expenses
    balance = revenues - expenses
    margin = round((balance / revenues) * 100, 2) if revenues else 0
    budget_consumed_rate = round((expenses / event.budget) * 100, 2) if event.budget else 0
    return {
        "budget": event.budget,
        "expenses": expenses,
        "revenues": revenues,
        "remaining": remaining,
        "balance": balance,
        "margin": margin,
        "budget_consumed_rate": budget_consumed_rate,
    }


def event_participant_stats(event: Event) -> dict:
    stats = event.participants.aggregate(
        participants=Count("id"),
        confirmed=Count("id", filter=Q(status=EventParticipantStatus.CONFIRMED)),
        attended=Count("id", filter=Q(attendance_status=EventParticipantStatus.ATTENDED)),
        absent=Count("id", filter=Q(attendance_status=EventParticipantStatus.ABSENT)),
    )
    expected = stats["participants"] or 0
    attended = stats["attended"] or 0
    return {**stats, "attendance_rate": round((attended / expected) * 100, 2) if expected else 0}


def event_stats(event: Event) -> dict:
    return {**event_participant_stats(event), **event_finance_summary(event)}


def workspace_event_stats(workspace: Workspace) -> dict:
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    events = Event.objects.filter(workspace=workspace)
    aggregates = events.aggregate(
        upcoming_events=Count("id", filter=Q(start_at__gte=now) & ~Q(status=EventStatus.CANCELLED)),
        month_events=Count("id", filter=Q(start_at__gte=month_start)),
        completed_events=Count("id", filter=Q(status=EventStatus.COMPLETED)),
        cancelled_events=Count("id", filter=Q(status=EventStatus.CANCELLED)),
        planned_participants=Sum("capacity"),
        total_budget=Sum("budget"),
    )
    expenses = EventExpenseAllocation.objects.filter(workspace=workspace).aggregate(total=Sum("amount"))["total"] or ZERO
    revenues = EventRevenueAllocation.objects.filter(workspace=workspace).aggregate(total=Sum("amount"))["total"] or ZERO
    participant_totals = EventParticipant.objects.filter(workspace=workspace).aggregate(
        total=Count("id"),
        attended=Count("id", filter=Q(attendance_status=EventParticipantStatus.ATTENDED)),
    )
    participant_count = participant_totals["total"] or 0
    attended_count = participant_totals["attended"] or 0
    return {
        "upcoming_events": aggregates["upcoming_events"] or 0,
        "month_events": aggregates["month_events"] or 0,
        "completed_events": aggregates["completed_events"] or 0,
        "cancelled_events": aggregates["cancelled_events"] or 0,
        "planned_participants": aggregates["planned_participants"] or 0,
        "average_attendance_rate": round((attended_count / participant_count) * 100, 2) if participant_count else 0,
        "total_budget": aggregates["total_budget"] or ZERO,
        "total_expenses": expenses,
        "total_revenues": revenues,
    }


def calendar_events(*, workspace: Workspace, start_at, end_at):
    return Event.objects.filter(workspace=workspace, start_at__lt=end_at, end_at__gte=start_at).order_by("start_at")


@transaction.atomic
def add_expense_allocation(*, event: Event, actor, **data) -> EventExpenseAllocation:
    allocation = EventExpenseAllocation.objects.create(workspace=event.workspace, event=event, created_by=actor, **data)
    log_event_activity(event=event, actor=actor, action="event.expense_linked", metadata={"amount": str(allocation.amount)})
    return allocation


@transaction.atomic
def add_revenue_allocation(*, event: Event, actor, **data) -> EventRevenueAllocation:
    allocation = EventRevenueAllocation.objects.create(workspace=event.workspace, event=event, created_by=actor, **data)
    log_event_activity(event=event, actor=actor, action="event.revenue_linked", metadata={"amount": str(allocation.amount)})
    return allocation
