from datetime import datetime, time

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import decorators, filters, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Event, EventActivity, EventAnnouncement, EventDocument, EventFeedback, EventOrganizer, EventParticipant, EventScheduleItem, EventSpeaker, EventSponsor, EventTicket, EventTicketType
from .serializers import (
    AttendanceUpdateSerializer,
    EventAnnouncementSerializer,
    EventActivitySerializer,
    EventDocumentSerializer,
    EventExpenseAllocationSerializer,
    EventFeedbackSerializer,
    EventOrganizerSerializer,
    EventParticipantSerializer,
    EventRevenueAllocationSerializer,
    EventScheduleItemSerializer,
    EventSerializer,
    EventSpeakerSerializer,
    EventSponsorSerializer,
    EventTicketSerializer,
    EventTicketTypeSerializer,
    RsvpSerializer,
    RegisterSerializer,
    TicketCheckinSerializer,
    TicketOrderSerializer,
)
from .services import (
    add_organizer,
    add_expense_allocation,
    add_participant,
    add_revenue_allocation,
    change_event_status,
    checkin_ticket,
    create_event,
    create_ticket_order,
    create_ticket_type,
    delete_event,
    event_report_payload,
    event_stats,
    manual_attendance,
    register_member,
    unregister_member,
    update_attendance,
    update_event,
    update_rsvp,
    unified_calendar_items,
    workspace_event_stats,
)
from .statuses import EventStatus


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


def parse_calendar_bound(value: str, *, end_of_day: bool = False):
    parsed_datetime = parse_datetime(value)
    if parsed_datetime:
        return timezone.make_aware(parsed_datetime) if timezone.is_naive(parsed_datetime) else parsed_datetime
    parsed_date = parse_date(value)
    if parsed_date:
        clock = time.max if end_of_day else time.min
        return timezone.make_aware(datetime.combine(parsed_date, clock))
    return None


class EventViewSet(viewsets.ModelViewSet):
    serializer_class = EventSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "description", "location"]
    ordering_fields = ["start_at", "end_at", "created_at", "budget", "title"]

    def get_permissions(self):
        permission_map = {
            "create": "events.create",
            "update": "events.update",
            "partial_update": "events.update",
            "destroy": "events.delete",
            "publish": "events.publish",
            "cancel": "events.cancel",
            "complete": "events.update",
            "register": "events.view",
            "unregister": "events.view",
            "participants": "events.manage_participants" if self.request.method == "POST" else "events.view",
            "participant_detail": "events.manage_participants",
            "rsvp": "events.manage_participants",
            "attendance": "events.manage_attendance",
            "checkin": "events.manage_attendance",
            "manual_attendance": "events.manage_attendance",
            "organizers": "events.manage_team" if self.request.method == "POST" else "events.view",
            "tickets": "events.manage_tickets" if self.request.method == "POST" else "events.view",
            "ticket_orders": "events.manage_tickets",
            "ticket_detail": "events.view",
            "ticket_checkin": "events.manage_attendance",
            "sponsors": "events.manage_finance" if self.request.method == "POST" else "events.view",
            "schedule": "events.update" if self.request.method == "POST" else "events.view",
            "speakers": "events.update" if self.request.method == "POST" else "events.view",
            "feedback": "events.manage_feedback" if self.request.method == "POST" else "events.view",
            "announcements": "events.update" if self.request.method == "POST" else "events.view",
            "expenses": "events.manage_budget" if self.request.method == "POST" else "events.view",
            "revenues": "events.manage_budget" if self.request.method == "POST" else "events.view",
            "documents": "events.manage_documents" if self.request.method == "POST" else "events.view",
            "analytics": "events.view",
            "report": "events.view",
            "export_report": "events.export",
            "activity": "events.view",
            "stats": "events.view",
            "calendar": "events.view",
            "overview": "events.view",
        }
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "events.view"))()]

    def get_queryset(self):
        queryset = Event.objects.select_related("workspace", "project", "responsible_user", "responsible_member").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        for field in ["status", "event_type", "project", "responsible_user", "owner", "location_type"]:
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})
        if self.request.query_params.get("start"):
            queryset = queryset.filter(start_at__gte=self.request.query_params["start"])
        if self.request.query_params.get("end"):
            queryset = queryset.filter(start_at__lte=self.request.query_params["end"])
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        event = create_event(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        return response.Response(EventSerializer(event, context=self.get_serializer_context()).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        event = self.get_object()
        serializer = self.get_serializer(event, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        event = update_event(event=event, actor=request.user, **serializer.validated_data)
        return response.Response(EventSerializer(event, context=self.get_serializer_context()).data)

    def perform_destroy(self, instance):
        delete_event(event=instance, actor=self.request.user)

    @decorators.action(detail=True, methods=["post"])
    def publish(self, request, pk=None):
        try:
            event = change_event_status(event=self.get_object(), actor=request.user, status=EventStatus.PUBLISHED)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(EventSerializer(event, context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        return response.Response(EventSerializer(change_event_status(event=self.get_object(), actor=request.user, status=EventStatus.CANCELLED), context=self.get_serializer_context()).data)

    @decorators.action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        return response.Response(EventSerializer(change_event_status(event=self.get_object(), actor=request.user, status=EventStatus.COMPLETED), context=self.get_serializer_context()).data)

    @decorators.action(detail=False, methods=["get"])
    def overview(self, request):
        return response.Response(workspace_event_stats(current_workspace(request)))

    @decorators.action(detail=False, methods=["get"])
    def calendar(self, request):
        start_at = parse_calendar_bound(request.query_params.get("start", ""))
        end_at = parse_calendar_bound(request.query_params.get("end", ""), end_of_day=True)
        if not start_at or not end_at:
            return response.Response({"message": "Parametres start et end requis au format date ou datetime ISO."}, status=status.HTTP_400_BAD_REQUEST)
        items = unified_calendar_items(workspace=current_workspace(request), start_at=start_at, end_at=end_at)
        source_type = request.query_params.get("source_type")
        if source_type:
            items = [item for item in items if item["source_type"] == source_type]
        return response.Response(items)

    @decorators.action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        return response.Response(event_stats(self.get_object()))

    @decorators.action(detail=True, methods=["get"])
    def analytics(self, request, pk=None):
        return response.Response(event_stats(self.get_object()))

    @decorators.action(detail=True, methods=["get", "post"])
    def participants(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventParticipantSerializer(data=request.data, context=self.get_serializer_context())
            serializer.is_valid(raise_exception=True)
            try:
                participant = add_participant(event=event, member=serializer.validated_data["member"], actor=request.user)
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(EventParticipantSerializer(participant).data, status=status.HTTP_201_CREATED)
        return response.Response(EventParticipantSerializer(event.participants.select_related("member"), many=True).data)

    @decorators.action(detail=True, methods=["post"])
    def register(self, request, pk=None):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        member = serializer.validated_data["member"]
        if member.workspace_id != current_workspace(request).id:
            return response.Response({"message": "Le membre appartient a un autre workspace."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            participant = register_member(event=self.get_object(), member=member, actor=request.user, registration_data=serializer.validated_data.get("registration_data"))
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(EventParticipantSerializer(participant).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["post"])
    def unregister(self, request, pk=None):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            participant = unregister_member(event=self.get_object(), member=serializer.validated_data["member"], actor=request.user)
        except (EventParticipant.DoesNotExist, ValueError) as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(EventParticipantSerializer(participant).data)

    @decorators.action(detail=True, methods=["patch"], url_path=r"participants/(?P<participant_id>[^/.]+)")
    def participant_detail(self, request, pk=None, participant_id=None):
        participant = EventParticipant.objects.get(event=self.get_object(), id=participant_id)
        serializer = EventParticipantSerializer(participant, data=request.data, partial=True, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return response.Response(EventParticipantSerializer(participant).data)

    @decorators.action(detail=True, methods=["post"])
    def rsvp(self, request, pk=None):
        event = self.get_object()
        participant = EventParticipant.objects.filter(event=event, member_id=request.data.get("member")).first()
        if not participant:
            return response.Response({"message": "Participant introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = RsvpSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            participant = update_rsvp(participant=participant, status=serializer.validated_data["status"], actor=request.user)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(EventParticipantSerializer(participant).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def attendance(self, request, pk=None):
        event = self.get_object()
        if request.method == "GET":
            return response.Response(EventParticipantSerializer(event.participants.select_related("member").order_by("member__last_name"), many=True).data)
        serializer = AttendanceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participant = EventParticipant.objects.filter(event=event, id=serializer.validated_data["participant_id"]).first()
        if not participant:
            return response.Response({"message": "Participant introuvable."}, status=status.HTTP_404_NOT_FOUND)
        participant = update_attendance(participant=participant, attended=serializer.validated_data["attended"], actor=request.user)
        return response.Response(EventParticipantSerializer(participant).data)

    @decorators.action(detail=True, methods=["post"])
    def checkin(self, request, pk=None):
        event = self.get_object()
        participant_id = request.data.get("participant_id")
        qr_code = request.data.get("qr_code")
        participant = EventParticipant.objects.filter(event=event, id=participant_id).first() if participant_id else EventParticipant.objects.filter(event=event, qr_code=qr_code).first()
        if not participant:
            return response.Response({"message": "Participant introuvable."}, status=status.HTTP_404_NOT_FOUND)
        participant = update_attendance(participant=participant, attended=True, actor=request.user)
        return response.Response(EventParticipantSerializer(participant).data)

    @decorators.action(detail=True, methods=["post"], url_path="attendance/manual")
    def manual_attendance(self, request, pk=None):
        serializer = AttendanceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participant = manual_attendance(event=self.get_object(), participant_id=serializer.validated_data["participant_id"], attended=serializer.validated_data["attended"], actor=request.user)
        return response.Response(EventParticipantSerializer(participant).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def organizers(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventOrganizerSerializer(data=request.data, context=self.get_serializer_context())
            serializer.is_valid(raise_exception=True)
            try:
                organizer = add_organizer(event=event, member=serializer.validated_data["member"], role=serializer.validated_data["role"], actor=request.user)
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(EventOrganizerSerializer(organizer).data, status=status.HTTP_201_CREATED)
        return response.Response(EventOrganizerSerializer(event.organizers.select_related("member").filter(is_active=True), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def expenses(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventExpenseAllocationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            allocation = add_expense_allocation(event=event, actor=request.user, **serializer.validated_data)
            return response.Response(EventExpenseAllocationSerializer(allocation).data, status=status.HTTP_201_CREATED)
        return response.Response(EventExpenseAllocationSerializer(event.expense_allocations.all(), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def revenues(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventRevenueAllocationSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            allocation = add_revenue_allocation(event=event, actor=request.user, **serializer.validated_data)
            return response.Response(EventRevenueAllocationSerializer(allocation).data, status=status.HTTP_201_CREATED)
        return response.Response(EventRevenueAllocationSerializer(event.revenue_allocations.all(), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def documents(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventDocumentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            document = EventDocument.objects.create(workspace=event.workspace, event=event, uploaded_by=request.user, **serializer.validated_data)
            return response.Response(EventDocumentSerializer(document).data, status=status.HTTP_201_CREATED)
        return response.Response(EventDocumentSerializer(event.documents.order_by("-created_at"), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def tickets(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventTicketTypeSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            ticket_type = create_ticket_type(event=event, actor=request.user, **serializer.validated_data)
            return response.Response(EventTicketTypeSerializer(ticket_type).data, status=status.HTTP_201_CREATED)
        return response.Response(EventTicketTypeSerializer(event.ticket_types.order_by("price"), many=True).data)

    @decorators.action(detail=True, methods=["post"], url_path="tickets/orders")
    def ticket_orders(self, request, pk=None):
        event = self.get_object()
        serializer = TicketOrderSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            order = create_ticket_order(event=event, ticket_type=serializer.validated_data["ticket_type"], quantity=serializer.validated_data["quantity"], participant=serializer.validated_data.get("participant"), actor=request.user)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(TicketOrderSerializer(order).data, status=status.HTTP_201_CREATED)

    @decorators.action(detail=True, methods=["get"], url_path=r"tickets/(?P<ticket_id>[^/.]+)")
    def ticket_detail(self, request, pk=None, ticket_id=None):
        return response.Response(EventTicketSerializer(EventTicket.objects.get(event=self.get_object(), id=ticket_id)).data)

    @decorators.action(detail=True, methods=["post"], url_path=r"tickets/(?P<ticket_id>[^/.]+)/checkin")
    def ticket_checkin(self, request, pk=None, ticket_id=None):
        serializer = TicketCheckinSerializer(data={**request.data, "ticket_id": ticket_id})
        serializer.is_valid(raise_exception=True)
        ticket = EventTicket.objects.filter(event=self.get_object(), id=serializer.validated_data.get("ticket_id")).first()
        if not ticket and serializer.validated_data.get("code"):
            ticket = EventTicket.objects.filter(event=self.get_object(), code=serializer.validated_data["code"]).first()
        if not ticket:
            return response.Response({"message": "Ticket introuvable."}, status=status.HTTP_404_NOT_FOUND)
        try:
            ticket = checkin_ticket(ticket=ticket, actor=request.user)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(EventTicketSerializer(ticket).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def sponsors(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventSponsorSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            sponsor = EventSponsor.objects.create(workspace=event.workspace, event=event, **serializer.validated_data)
            return response.Response(EventSponsorSerializer(sponsor).data, status=status.HTTP_201_CREATED)
        return response.Response(EventSponsorSerializer(event.sponsors.all(), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def schedule(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventScheduleItemSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            item = EventScheduleItem.objects.create(workspace=event.workspace, event=event, **serializer.validated_data)
            return response.Response(EventScheduleItemSerializer(item).data, status=status.HTTP_201_CREATED)
        return response.Response(EventScheduleItemSerializer(event.schedule_items.order_by("start_time"), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def speakers(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventSpeakerSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            speaker = EventSpeaker.objects.create(workspace=event.workspace, event=event, **serializer.validated_data)
            return response.Response(EventSpeakerSerializer(speaker).data, status=status.HTTP_201_CREATED)
        return response.Response(EventSpeakerSerializer(event.speakers.all(), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def feedback(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventFeedbackSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            feedback = EventFeedback.objects.create(workspace=event.workspace, event=event, **serializer.validated_data)
            return response.Response(EventFeedbackSerializer(feedback).data, status=status.HTTP_201_CREATED)
        return response.Response(EventFeedbackSerializer(event.feedback.all(), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def announcements(self, request, pk=None):
        event = self.get_object()
        if request.method == "POST":
            serializer = EventAnnouncementSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            announcement = EventAnnouncement.objects.create(workspace=event.workspace, event=event, created_by=request.user, **serializer.validated_data)
            return response.Response(EventAnnouncementSerializer(announcement).data, status=status.HTTP_201_CREATED)
        return response.Response(EventAnnouncementSerializer(event.announcements.order_by("-created_at"), many=True).data)

    @decorators.action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        event = self.get_object()
        queryset = EventActivity.objects.filter(event=event).order_by("-created_at")[:50]
        return response.Response(EventActivitySerializer(queryset, many=True).data)

    @decorators.action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        return response.Response(event_report_payload(self.get_object()))

    @decorators.action(detail=True, methods=["post"], url_path="report/export")
    def export_report(self, request, pk=None):
        return response.Response({"event": self.get_object().id, "status": "queued", "formats": ["pdf", "xlsx"], "celery_ready": True})
