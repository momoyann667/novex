from datetime import datetime, time

from django.utils import timezone
from django.utils.dateparse import parse_date, parse_datetime
from rest_framework import decorators, filters, response, status, viewsets

from common.permissions.workspace import RequireWorkspacePermission
from .models import Event, EventActivity, EventDocument, EventParticipant
from .serializers import (
    AttendanceUpdateSerializer,
    CalendarEventSerializer,
    EventActivitySerializer,
    EventDocumentSerializer,
    EventExpenseAllocationSerializer,
    EventParticipantSerializer,
    EventRevenueAllocationSerializer,
    EventSerializer,
    RsvpSerializer,
)
from .services import (
    add_expense_allocation,
    add_participant,
    add_revenue_allocation,
    calendar_events,
    create_event,
    delete_event,
    event_stats,
    update_attendance,
    update_event,
    update_rsvp,
    workspace_event_stats,
)


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
            "participants": "events.manage_participants" if self.request.method == "POST" else "events.view",
            "rsvp": "events.manage_participants",
            "attendance": "events.manage_attendance",
            "expenses": "events.manage_budget" if self.request.method == "POST" else "events.view",
            "revenues": "events.manage_budget" if self.request.method == "POST" else "events.view",
            "documents": "events.manage_documents" if self.request.method == "POST" else "events.view",
            "report": "events.generate_reports",
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
        for field in ["status", "event_type", "project", "responsible_user"]:
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

    @decorators.action(detail=False, methods=["get"])
    def overview(self, request):
        return response.Response(workspace_event_stats(current_workspace(request)))

    @decorators.action(detail=False, methods=["get"])
    def calendar(self, request):
        start_at = parse_calendar_bound(request.query_params.get("start", ""))
        end_at = parse_calendar_bound(request.query_params.get("end", ""), end_of_day=True)
        if not start_at or not end_at:
            return response.Response({"message": "Parametres start et end requis au format date ou datetime ISO."}, status=status.HTTP_400_BAD_REQUEST)
        queryset = calendar_events(workspace=current_workspace(request), start_at=start_at, end_at=end_at)
        return response.Response(CalendarEventSerializer(queryset, many=True).data)

    @decorators.action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
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

    @decorators.action(detail=True, methods=["post"])
    def attendance(self, request, pk=None):
        event = self.get_object()
        serializer = AttendanceUpdateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        participant = EventParticipant.objects.filter(event=event, id=serializer.validated_data["participant_id"]).first()
        if not participant:
            return response.Response({"message": "Participant introuvable."}, status=status.HTTP_404_NOT_FOUND)
        participant = update_attendance(participant=participant, attended=serializer.validated_data["attended"], actor=request.user)
        return response.Response(EventParticipantSerializer(participant).data)

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

    @decorators.action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        event = self.get_object()
        queryset = EventActivity.objects.filter(event=event).order_by("-created_at")[:50]
        return response.Response(EventActivitySerializer(queryset, many=True).data)

    @decorators.action(detail=True, methods=["get"])
    def report(self, request, pk=None):
        event = self.get_object()
        return response.Response(
            {
                "event": EventSerializer(event, context=self.get_serializer_context()).data,
                "participants": EventParticipantSerializer(event.participants.select_related("member"), many=True).data,
                "expenses": EventExpenseAllocationSerializer(event.expense_allocations.all(), many=True).data,
                "revenues": EventRevenueAllocationSerializer(event.revenue_allocations.all(), many=True).data,
                "documents": EventDocumentSerializer(event.documents.all(), many=True).data,
                "observations": "",
                "generation": "Celery-ready: generation asynchrone a brancher avec le worker.",
            }
        )
