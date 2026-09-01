from decimal import Decimal
from uuid import uuid4

from django.db import transaction
from django.db.models import Avg, Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.communications.models import Communication
from apps.contributions.models import Contribution, ContributionCampaign, ContributionReminder
from apps.finance.models import FinancialTransaction
from apps.finance.statuses import FinancialTransactionStatus, FinancialTransactionType
from apps.members.models import Member
from apps.projects.models import Project, ProjectMilestone, ProjectTask
from apps.workspaces.models import Workspace
from .models import (
    Event,
    EventActivity,
    EventAnnouncement,
    EventDocument,
    EventExpenseAllocation,
    EventFeedback,
    EventOrganizer,
    EventParticipant,
    EventRevenueAllocation,
    EventScheduleItem,
    EventSpeaker,
    EventSponsor,
    EventTicket,
    EventTicketType,
    ExternalParticipant,
    TicketOrder,
)
from .statuses import EventOrderStatus, EventOrganizerRole, EventParticipantStatus, EventStatus, EventTicketStatus


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
    data.setdefault("code", next_event_code(workspace))
    data.setdefault("country", workspace.country)
    if data.get("project") and data["project"].workspace_id != workspace.id:
        raise ValueError("Le projet associe appartient a un autre workspace.")
    if data.get("owner") and data["owner"].workspace_id != workspace.id:
        raise ValueError("Le responsable evenement appartient a un autre workspace.")
    event = Event.objects.create(workspace=workspace, created_by=actor, **data)
    log_event_activity(event=event, actor=actor, action="event.created")
    return event


@transaction.atomic
def update_event(*, event: Event, actor, **data) -> Event:
    event = Event.objects.select_for_update().get(id=event.id)
    previous_status = event.status
    if data.get("project") and data["project"].workspace_id != event.workspace_id:
        raise ValueError("Le projet associe appartient a un autre workspace.")
    if data.get("owner") and data["owner"].workspace_id != event.workspace_id:
        raise ValueError("Le responsable evenement appartient a un autre workspace.")
    for field, value in data.items():
        setattr(event, field, value)
    event.save()
    action = "event.cancelled" if previous_status != event.status and event.status == EventStatus.CANCELLED else "event.updated"
    log_event_activity(event=event, actor=actor, action=action, metadata={"status": event.status})
    return event


def delete_event(*, event: Event, actor) -> None:
    if event.participants.exists() or event.tickets.exists() or event.documents.exists() or event.financial_transactions.exists():
        change_event_status(event=event, actor=actor, status=EventStatus.ARCHIVED if event.status == EventStatus.COMPLETED else EventStatus.CANCELLED)
        return
    log_event_activity(event=event, actor=actor, action="event.deleted")
    event.delete()


def next_event_code(workspace: Workspace) -> str:
    year = timezone.localdate().year
    prefix = f"EVT-{year}-"
    last = Event.objects.filter(workspace=workspace, code__startswith=prefix).order_by("-code").first()
    next_number = int(last.code.rsplit("-", 1)[-1]) + 1 if last and last.code.rsplit("-", 1)[-1].isdigit() else 1
    return f"{prefix}{next_number:03d}"


def build_qr_code(prefix: str, code: str) -> str:
    return f"NOVEX {prefix}:{code}"


@transaction.atomic
def change_event_status(*, event: Event, actor, status: str) -> Event:
    event = Event.objects.select_for_update().get(id=event.id)
    if status == EventStatus.PUBLISHED and event.status != EventStatus.DRAFT:
        raise ValueError("Seul un brouillon peut etre publie.")
    if status == EventStatus.ARCHIVED and event.status not in {EventStatus.COMPLETED, EventStatus.CANCELLED}:
        raise ValueError("Seul un evenement termine ou annule peut etre archive.")
    previous = event.status
    event.status = status
    event.save(update_fields=["status", "updated_at"])
    action = (
        "event.published"
        if status == EventStatus.PUBLISHED
        else "event.completed"
        if status == EventStatus.COMPLETED
        else "event.cancelled"
        if status == EventStatus.CANCELLED
        else "event.archived"
        if status == EventStatus.ARCHIVED
        else "event.updated"
    )
    log_event_activity(event=event, actor=actor, action=action, metadata={"from": previous, "to": status})
    return event


@transaction.atomic
def add_participant(*, event: Event, member: Member, actor) -> EventParticipant:
    if member.workspace_id != event.workspace_id:
        raise ValueError("Le membre n'appartient pas au workspace de l'evenement.")
    participant, created = EventParticipant.objects.get_or_create(workspace=event.workspace, event=event, member=member)
    if created:
        log_event_activity(event=event, actor=actor, action="event.participant_added", metadata={"member_id": member.id})
    return participant


def confirmed_or_registered_count(event: Event) -> int:
    return event.participants.filter(status__in=[EventParticipantStatus.REGISTERED, EventParticipantStatus.CONFIRMED]).count()


def event_is_full(event: Event) -> bool:
    return bool(event.capacity and confirmed_or_registered_count(event) >= event.capacity)


@transaction.atomic
def register_member(*, event: Event, member: Member, actor, registration_data: dict | None = None) -> EventParticipant:
    event = Event.objects.select_for_update().get(id=event.id)
    if member.workspace_id != event.workspace_id:
        raise ValueError("Le membre n'appartient pas au workspace de l'evenement.")
    if event.registration_deadline and timezone.now() > event.registration_deadline:
        raise ValueError("La date limite d'inscription est depassee.")
    status = EventParticipantStatus.WAITLISTED if event_is_full(event) else EventParticipantStatus.REGISTERED
    participant, _created = EventParticipant.objects.update_or_create(
        workspace=event.workspace,
        event=event,
        member=member,
        defaults={"status": status, "attendance_status": status, "registration_data": registration_data or {}, "responded_at": timezone.now()},
    )
    if not participant.qr_code:
        participant.qr_code = build_qr_code("EVENT", f"{event.code}-{participant.id}")
        participant.save(update_fields=["qr_code", "updated_at"])
    log_event_activity(event=event, actor=actor, action="event.participant_registered", metadata={"member_id": member.id, "status": status})
    return participant


@transaction.atomic
def unregister_member(*, event: Event, member: Member, actor) -> EventParticipant:
    participant = EventParticipant.objects.select_for_update().get(event=event, member=member)
    if event.registration_deadline and timezone.now() > event.registration_deadline:
        raise ValueError("La date limite d'annulation est depassee.")
    participant.status = EventParticipantStatus.CANCELLED
    participant.attendance_status = EventParticipantStatus.CANCELLED
    participant.save(update_fields=["status", "attendance_status", "updated_at"])
    log_event_activity(event=event, actor=actor, action="event.participant_cancelled", metadata={"member_id": member.id})
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
    participant = EventParticipant.objects.select_for_update().select_related("event").get(id=participant.id)
    participant.mark_response(status)
    log_event_activity(event=participant.event, actor=actor, action="event.rsvp_updated", metadata={"member_id": participant.member_id, "status": status})
    return participant


@transaction.atomic
def update_attendance(*, participant: EventParticipant, attended: bool, actor) -> EventParticipant:
    participant = EventParticipant.objects.select_for_update().select_related("event").get(id=participant.id)
    participant.attendance_status = EventParticipantStatus.ATTENDED if attended else EventParticipantStatus.ABSENT
    participant.status = participant.attendance_status
    participant.checked_in_at = timezone.now() if attended else None
    participant.save(update_fields=["attendance_status", "status", "checked_in_at", "updated_at"])
    log_event_activity(
        event=participant.event,
        actor=actor,
        action="event.checkin" if attended else "event.checkout",
        metadata={"member_id": participant.member_id, "attended": attended},
    )
    return participant


@transaction.atomic
def manual_attendance(*, event: Event, participant_id: int, attended: bool, actor) -> EventParticipant:
    participant = EventParticipant.objects.select_for_update().get(event=event, id=participant_id)
    return update_attendance(participant=participant, attended=attended, actor=actor)


def event_finance_summary(event: Event) -> dict:
    finance_expenses = FinancialTransaction.objects.filter(event=event, transaction_type=FinancialTransactionType.EXPENSE, status=FinancialTransactionStatus.VALIDATED).aggregate(total=Sum("amount"))["total"] or ZERO
    finance_revenues = FinancialTransaction.objects.filter(event=event, transaction_type=FinancialTransactionType.INCOME, status=FinancialTransactionStatus.VALIDATED).aggregate(total=Sum("amount"))["total"] or ZERO
    expenses = (event.expense_allocations.aggregate(total=Sum("amount"))["total"] or ZERO) + finance_expenses
    revenues = (event.revenue_allocations.aggregate(total=Sum("amount"))["total"] or ZERO) + finance_revenues
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
        registered=Count("id", filter=Q(status=EventParticipantStatus.REGISTERED)),
        confirmed=Count("id", filter=Q(status__in=[EventParticipantStatus.CONFIRMED, EventParticipantStatus.ATTENDED])),
        waitlisted=Count("id", filter=Q(status=EventParticipantStatus.WAITLISTED)),
        attended=Count("id", filter=Q(attendance_status=EventParticipantStatus.ATTENDED)),
        absent=Count("id", filter=Q(attendance_status=EventParticipantStatus.ABSENT)),
    )
    confirmed = stats["confirmed"] or 0
    attended = stats["attended"] or 0
    registered = (stats["registered"] or 0) + confirmed
    occupancy_rate = round((registered / event.capacity) * 100, 2) if event.capacity else 0
    return {**stats, "attendance_rate": round((attended / confirmed) * 100, 2) if confirmed else 0, "occupancy_rate": occupancy_rate, "capacity": event.capacity or 0}


def event_stats(event: Event) -> dict:
    feedback = event.feedback.aggregate(average_rating=Avg("rating"), responses=Count("id"), satisfied=Count("id", filter=Q(satisfaction__gte=4)))
    responses = feedback["responses"] or 0
    satisfaction_rate = round(((feedback["satisfied"] or 0) / responses) * 100, 2) if responses else 0
    return {**event_participant_stats(event), **event_finance_summary(event), "average_rating": round(feedback["average_rating"] or 0, 2), "feedback_responses": responses, "satisfaction_rate": satisfaction_rate}


def workspace_event_stats(workspace: Workspace) -> dict:
    now = timezone.now()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    events = Event.objects.filter(workspace=workspace)
    aggregates = events.aggregate(
        upcoming_events=Count("id", filter=Q(end_at__gte=now) & ~Q(status__in=[EventStatus.CANCELLED, EventStatus.ARCHIVED])),
        month_events=Count("id", filter=Q(start_at__gte=month_start)),
        completed_events=Count("id", filter=Q(status=EventStatus.COMPLETED)),
        cancelled_events=Count("id", filter=Q(status=EventStatus.CANCELLED)),
        planned_participants=Sum("capacity"),
        total_budget=Sum("budget"),
    )
    expenses = EventExpenseAllocation.objects.filter(workspace=workspace).aggregate(total=Sum("amount"))["total"] or ZERO
    revenues = EventRevenueAllocation.objects.filter(workspace=workspace).aggregate(total=Sum("amount"))["total"] or ZERO
    expenses += FinancialTransaction.objects.filter(workspace=workspace, event__isnull=False, transaction_type=FinancialTransactionType.EXPENSE, status=FinancialTransactionStatus.VALIDATED).aggregate(total=Sum("amount"))["total"] or ZERO
    revenues += FinancialTransaction.objects.filter(workspace=workspace, event__isnull=False, transaction_type=FinancialTransactionType.INCOME, status=FinancialTransactionStatus.VALIDATED).aggregate(total=Sum("amount"))["total"] or ZERO
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
        "net_result": revenues - expenses,
    }


def calendar_events(*, workspace: Workspace, start_at, end_at):
    return Event.objects.filter(workspace=workspace, start_at__lt=end_at, end_at__gte=start_at).order_by("start_at")


def day_bounds(value):
    return (
        timezone.make_aware(timezone.datetime.combine(value, timezone.datetime.min.time())),
        timezone.make_aware(timezone.datetime.combine(value, timezone.datetime.max.time())),
    )


def calendar_item(
    *,
    uid: str,
    source_type: str,
    title: str,
    start_at,
    end_at=None,
    status="",
    color="slate",
    source_url="",
    location="",
    description="",
    all_day=False,
):
    if end_at is None:
        end_at = start_at
    return {
        "id": uid,
        "source_type": source_type,
        "title": title,
        "description": description,
        "status": status,
        "start_at": start_at.isoformat(),
        "end_at": end_at.isoformat(),
        "location": location,
        "all_day": all_day,
        "color": color,
        "source_url": source_url,
    }


def unified_calendar_items(*, workspace: Workspace, start_at, end_at):
    items = []
    start_date = start_at.date()
    end_date = end_at.date()

    for event in calendar_events(workspace=workspace, start_at=start_at, end_at=end_at).select_related("project"):
        items.append(
            calendar_item(
                uid=f"event:{event.id}",
                source_type="EVENT",
                title=event.title,
                description=event.description,
                status=event.status,
                start_at=event.start_at,
                end_at=event.end_at,
                location=event.location or event.city,
                color="blue",
                source_url=f"events/{event.id}",
            )
        )

    projects = (
        Project.objects.filter(workspace=workspace)
        .filter(Q(start_date__range=(start_date, end_date)) | Q(end_date__range=(start_date, end_date)))
        .only("id", "name", "status", "start_date", "end_date", "progress")
    )
    for project in projects:
        if project.start_date:
            day_start, day_end = day_bounds(project.start_date)
            items.append(
                calendar_item(
                    uid=f"project-start:{project.id}",
                    source_type="PROJECT",
                    title=f"Debut projet - {project.name}",
                    status=project.status,
                    start_at=day_start,
                    end_at=day_end,
                    color="amber",
                    source_url=f"projects/{project.id}",
                    all_day=True,
                )
            )
        if project.end_date:
            day_start, day_end = day_bounds(project.end_date)
            items.append(
                calendar_item(
                    uid=f"project-deadline:{project.id}",
                    source_type="DEADLINE",
                    title=f"Echeance projet - {project.name}",
                    status=project.status,
                    start_at=day_start,
                    end_at=day_end,
                    color="rose",
                    source_url=f"projects/{project.id}",
                    all_day=True,
                )
            )

    for milestone in (
        ProjectMilestone.objects.select_related("project")
        .filter(workspace=workspace, due_date__range=(start_date, end_date))
        .only("id", "name", "status", "due_date", "project_id", "project__name")
    ):
        day_start, day_end = day_bounds(milestone.due_date)
        items.append(
            calendar_item(
                uid=f"milestone:{milestone.id}",
                source_type="DEADLINE",
                title=f"Jalon - {milestone.name}",
                description=milestone.project.name,
                status=milestone.status,
                start_at=day_start,
                end_at=day_end,
                color="orange",
                source_url=f"projects/{milestone.project_id}",
                all_day=True,
            )
        )

    for task in (
        ProjectTask.objects.select_related("project")
        .filter(workspace=workspace, due_date__range=(start_date, end_date))
        .only("id", "title", "status", "due_date", "project_id", "project__name")
    ):
        day_start, day_end = day_bounds(task.due_date)
        items.append(
            calendar_item(
                uid=f"task:{task.id}",
                source_type="TASK",
                title=f"Tache - {task.title}",
                description=task.project.name,
                status=task.status,
                start_at=day_start,
                end_at=day_end,
                color="violet",
                source_url=f"projects/{task.project_id}/tasks",
                all_day=True,
            )
        )

    for campaign in ContributionCampaign.objects.filter(workspace=workspace, due_date__range=(start_date, end_date)).only(
        "id",
        "name",
        "status",
        "due_date",
        "amount",
        "currency",
    ):
        day_start, day_end = day_bounds(campaign.due_date)
        items.append(
            calendar_item(
                uid=f"contribution-campaign:{campaign.id}",
                source_type="CONTRIBUTION",
                title=f"Cotisation - {campaign.name}",
                description=f"{campaign.amount} {campaign.currency}",
                status=campaign.status,
                start_at=day_start,
                end_at=day_end,
                color="emerald",
                source_url="contributions",
                all_day=True,
            )
        )

    contributions = (
        Contribution.objects.select_related("campaign", "member")
        .filter(workspace=workspace, due_date__range=(start_date, end_date))
        .exclude(status__in=["PAID", "WAIVED"])
        .only(
            "id",
            "status",
            "due_date",
            "amount_due",
            "currency",
            "campaign__name",
            "member__first_name",
            "member__last_name",
        )
    )
    for contribution in contributions:
        day_start, day_end = day_bounds(contribution.due_date)
        member_name = f"{contribution.member.first_name} {contribution.member.last_name}".strip()
        items.append(
            calendar_item(
                uid=f"contribution:{contribution.id}",
                source_type="CONTRIBUTION",
                title=f"Echeance cotisation - {member_name}",
                description=f"{contribution.campaign.name} - {contribution.amount_due} {contribution.currency}",
                status=contribution.status,
                start_at=day_start,
                end_at=day_end,
                color="emerald",
                source_url="contributions",
                all_day=True,
            )
        )

    for reminder in (
        ContributionReminder.objects.select_related("campaign")
        .filter(workspace=workspace, scheduled_for__gte=start_at, scheduled_for__lte=end_at)
        .only("id", "status", "scheduled_for", "subject", "campaign__name")
    ):
        items.append(
            calendar_item(
                uid=f"reminder:{reminder.id}",
                source_type="REMINDER",
                title=reminder.subject,
                description=reminder.campaign.name,
                status=reminder.status,
                start_at=reminder.scheduled_for,
                color="teal",
                source_url="contributions",
                location="Notification",
            )
        )

    for communication in Communication.objects.filter(workspace=workspace, scheduled_at__gte=start_at, scheduled_at__lte=end_at).only(
        "id",
        "title",
        "status",
        "scheduled_at",
        "communication_type",
    ):
        items.append(
            calendar_item(
                uid=f"communication:{communication.id}",
                source_type="COMMUNICATION",
                title=f"Communication - {communication.title}",
                status=communication.status,
                start_at=communication.scheduled_at,
                color="cyan",
                source_url="communication",
                location="Centre de communication",
            )
        )

    for transaction in FinancialTransaction.objects.filter(
        workspace=workspace,
        transaction_date__range=(start_date, end_date),
    ).only("id", "description", "status", "transaction_type", "transaction_date", "amount"):
        day_start, day_end = day_bounds(transaction.transaction_date)
        color = "emerald" if transaction.transaction_type == FinancialTransactionType.INCOME else "rose"
        items.append(
            calendar_item(
                uid=f"finance:{transaction.id}",
                source_type="FINANCE",
                title=f"Finance - {transaction.description}",
                description=f"{transaction.amount} {workspace.currency}",
                status=transaction.status,
                start_at=day_start,
                end_at=day_end,
                color=color,
                source_url="finance",
                all_day=True,
            )
        )

    return sorted(items, key=lambda item: (item["start_at"], item["source_type"], item["title"]))


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


@transaction.atomic
def add_organizer(*, event: Event, member: Member, actor, role: str = EventOrganizerRole.OBSERVER) -> EventOrganizer:
    if member.workspace_id != event.workspace_id:
        raise ValueError("Le membre appartient a un autre workspace.")
    organizer, created = EventOrganizer.objects.update_or_create(workspace=event.workspace, event=event, member=member, defaults={"role": role, "is_active": True, "created_by": actor})
    log_event_activity(event=event, actor=actor, action="event.organizer_added", metadata={"member_id": member.id, "role": role, "created": created})
    return organizer


@transaction.atomic
def create_ticket_type(*, event: Event, actor, **data) -> EventTicketType:
    data.setdefault("currency", event.workspace.currency)
    data.setdefault("available_quantity", data.get("quantity", 0))
    ticket_type = EventTicketType.objects.create(workspace=event.workspace, event=event, **data)
    log_event_activity(event=event, actor=actor, action="event.ticket_created", metadata={"ticket_type_id": ticket_type.id})
    return ticket_type


def next_ticket_code() -> str:
    return f"NVX-TKT-{uuid4().hex[:8].upper()}"


@transaction.atomic
def create_ticket_order(*, event: Event, ticket_type: EventTicketType, quantity: int, actor, participant: EventParticipant | None = None) -> TicketOrder:
    event = Event.objects.select_for_update().get(id=event.id)
    ticket_type = EventTicketType.objects.select_for_update().get(id=ticket_type.id)
    if ticket_type.event_id != event.id or ticket_type.workspace_id != event.workspace_id:
        raise ValueError("Type de ticket invalide pour cet evenement.")
    if quantity <= 0:
        raise ValueError("La quantite doit etre positive.")
    if ticket_type.available_quantity < quantity:
        raise ValueError("Stock de tickets insuffisant.")
    total = ticket_type.price * quantity
    order = TicketOrder.objects.create(workspace=event.workspace, event=event, participant=participant, total_amount=total, currency=ticket_type.currency, reference=f"EVTORD-{uuid4().hex[:10].upper()}", created_by=actor)
    for _index in range(quantity):
        code = next_ticket_code()
        EventTicket.objects.create(workspace=event.workspace, event=event, ticket_type=ticket_type, order=order, participant=participant, code=code, qr_code=build_qr_code("TICKET", code))
    ticket_type.available_quantity -= quantity
    ticket_type.save(update_fields=["available_quantity", "updated_at"])
    log_event_activity(event=event, actor=actor, action="event.ticket_created", metadata={"order_id": order.id, "quantity": quantity, "amount": str(total)})
    return order


@transaction.atomic
def checkin_ticket(*, ticket: EventTicket, actor) -> EventTicket:
    ticket = EventTicket.objects.select_for_update().select_related("event", "participant").get(id=ticket.id)
    if ticket.status == EventTicketStatus.CHECKED_IN:
        raise ValueError("Ce ticket a deja ete valide.")
    if ticket.status == EventTicketStatus.CANCELLED:
        raise ValueError("Ce ticket est annule.")
    ticket.status = EventTicketStatus.CHECKED_IN
    ticket.checked_in_at = timezone.now()
    ticket.checked_in_by = actor
    ticket.save(update_fields=["status", "checked_in_at", "checked_in_by"])
    if ticket.participant_id:
        update_attendance(participant=ticket.participant, attended=True, actor=actor)
    log_event_activity(event=ticket.event, actor=actor, action="event.ticket_validated", metadata={"ticket_id": ticket.id, "code": ticket.code})
    return ticket


def cost_per_attendee(event: Event) -> Decimal:
    stats = event_stats(event)
    attended = stats["attended"] or 0
    return round((stats["expenses"] / attended), 2) if attended else ZERO


def event_report_payload(event: Event) -> dict:
    stats = event_stats(event)
    return {
        "summary": {"id": event.id, "code": event.code, "title": event.title, "type": event.event_type, "status": event.status, "project": event.project_id},
        "participants": {key: stats[key] for key in ["participants", "registered", "confirmed", "waitlisted", "attended", "absent", "attendance_rate", "occupancy_rate"]},
        "finance": {key: stats[key] for key in ["budget", "expenses", "revenues", "remaining", "balance", "budget_consumed_rate"]},
        "cost_per_attendee": cost_per_attendee(event),
        "schedule": [{"title": item.title, "start_time": item.start_time, "end_time": item.end_time, "speaker": item.speaker, "location": item.location} for item in event.schedule_items.order_by("start_time")],
        "documents": [{"title": item.title, "type": item.document_type} for item in event.documents.order_by("-created_at")],
        "feedback": {"average_rating": stats["average_rating"], "responses": stats["feedback_responses"], "satisfaction_rate": stats["satisfaction_rate"]},
        "observations": "",
        "export_formats_prepared": ["pdf", "xlsx"],
    }
