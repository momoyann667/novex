from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.members.models import Member
from apps.projects.models import Project
from apps.workspaces.models import WorkspaceMembership
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
from .services import event_report_payload, event_stats
from .statuses import EventLocationType, EventOrganizerRole, EventParticipantStatus, EventRecurrence, EventStatus, EventTicketStatus, EventType, EventVisibility


class EventParticipantSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = EventParticipant
        fields = ["id", "event", "member", "member_name", "external_participant", "status", "registration_data", "qr_code", "responded_at", "attendance_status", "checked_in_at", "created_at", "updated_at"]
        read_only_fields = ["id", "event", "member_name", "qr_code", "responded_at", "checked_in_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)

    def get_member_name(self, obj):
        return str(obj.member or obj.external_participant or "")


class ExternalParticipantSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExternalParticipant
        fields = ["id", "name", "email", "phone", "organization", "function", "created_at"]
        read_only_fields = ["id", "created_at"]


class EventOrganizerSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = EventOrganizer
        fields = ["id", "event", "member", "member_name", "role", "is_active", "created_at"]
        read_only_fields = ["id", "event", "member_name", "created_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)

    def get_member_name(self, obj):
        return str(obj.member)

    def validate_role(self, value):
        if value not in EventOrganizerRole.values:
            raise serializers.ValidationError("Role organisateur invalide.")
        return value


class EventExpenseAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventExpenseAllocation
        fields = ["id", "event", "external_expense_id", "label", "amount", "spent_at", "notes", "created_at"]
        read_only_fields = ["id", "event", "created_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit etre positif.")
        return value


class EventRevenueAllocationSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventRevenueAllocation
        fields = ["id", "event", "external_revenue_id", "label", "amount", "received_at", "notes", "created_at"]
        read_only_fields = ["id", "event", "created_at"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Le montant doit etre positif.")
        return value


class EventDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventDocument
        fields = ["id", "event", "title", "file", "document_type", "notes", "created_at"]
        read_only_fields = ["id", "event", "created_at"]


class EventActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = EventActivity
        fields = ["id", "action", "metadata", "created_at"]


class EventTicketTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventTicketType
        fields = ["id", "event", "name", "description", "price", "currency", "quantity", "available_quantity", "is_active", "created_at", "updated_at"]
        read_only_fields = ["id", "event", "currency", "available_quantity", "created_at", "updated_at"]


class TicketOrderSerializer(serializers.ModelSerializer):
    ticket_type = serializers.PrimaryKeyRelatedField(queryset=EventTicketType.objects.all(), write_only=True)
    quantity = serializers.IntegerField(min_value=1, write_only=True)

    class Meta:
        model = TicketOrder
        fields = ["id", "event", "participant", "payment", "ticket_type", "quantity", "total_amount", "currency", "status", "reference", "created_at"]
        read_only_fields = ["id", "event", "payment", "total_amount", "currency", "status", "reference", "created_at"]


class EventTicketSerializer(serializers.ModelSerializer):
    ticket_type_name = serializers.CharField(source="ticket_type.name", read_only=True)

    class Meta:
        model = EventTicket
        fields = ["id", "event", "ticket_type", "ticket_type_name", "order", "participant", "code", "qr_code", "status", "checked_in_at", "created_at"]
        read_only_fields = fields


class EventSponsorSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventSponsor
        fields = ["id", "event", "name", "contact", "contribution_amount", "notes", "created_at"]
        read_only_fields = ["id", "event", "created_at"]


class EventScheduleItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventScheduleItem
        fields = ["id", "event", "title", "description", "start_time", "end_time", "speaker", "location", "created_at"]
        read_only_fields = ["id", "event", "created_at"]

    def validate(self, attrs):
        start = attrs.get("start_time") or getattr(self.instance, "start_time", None)
        end = attrs.get("end_time") or getattr(self.instance, "end_time", None)
        if start and end and end <= start:
            raise serializers.ValidationError({"end_time": "La fin doit etre posterieure au debut."})
        return attrs


class EventSpeakerSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventSpeaker
        fields = ["id", "event", "name", "function", "organization", "biography", "photo", "created_at"]
        read_only_fields = ["id", "event", "created_at"]


class EventFeedbackSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventFeedback
        fields = ["id", "event", "participant", "rating", "satisfaction", "comment", "created_at"]
        read_only_fields = ["id", "event", "created_at"]

    def validate_rating(self, value):
        if value < 0 or value > 5:
            raise serializers.ValidationError("La note doit etre comprise entre 0 et 5.")
        return value

    def validate_satisfaction(self, value):
        if value < 0 or value > 5:
            raise serializers.ValidationError("La satisfaction doit etre comprise entre 0 et 5.")
        return value


class EventAnnouncementSerializer(serializers.ModelSerializer):
    class Meta:
        model = EventAnnouncement
        fields = ["id", "event", "title", "message", "channels", "sent_at", "created_at"]
        read_only_fields = ["id", "event", "sent_at", "created_at"]


class EventSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    stats = serializers.SerializerMethodField()
    report = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "code",
            "title",
            "description",
            "cover_image",
            "event_type",
            "event_type_label",
            "status",
            "status_label",
            "visibility",
            "start_at",
            "end_at",
            "timezone",
            "location_type",
            "location",
            "address",
            "city",
            "country",
            "online_url",
            "online_platform",
            "registration_required",
            "registration_deadline",
            "owner",
            "responsible_user",
            "responsible_member",
            "capacity",
            "budget",
            "project",
            "recurrence",
            "reminder_offsets",
            "stats",
            "report",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "code", "stats", "report", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            user_ids = WorkspaceMembership.objects.filter(workspace=workspace, status="active").values_list("user_id", flat=True)
            self.fields["responsible_user"].queryset = get_user_model().objects.filter(id__in=user_ids)
            self.fields["responsible_member"].queryset = Member.objects.filter(workspace=workspace)
            self.fields["owner"].queryset = Member.objects.filter(workspace=workspace)
            self.fields["project"].queryset = Project.objects.filter(workspace=workspace)

    def get_stats(self, obj):
        return event_stats(obj)

    def get_report(self, obj):
        return {"ready": True, "formats": ["pdf", "xlsx"]}

    def validate_event_type(self, value):
        if value not in EventType.values:
            raise serializers.ValidationError("Type d'evenement invalide.")
        return value

    def validate_visibility(self, value):
        if value not in EventVisibility.values:
            raise serializers.ValidationError("Visibilite invalide.")
        return value

    def validate_location_type(self, value):
        if value not in EventLocationType.values:
            raise serializers.ValidationError("Type de lieu invalide.")
        return value

    def validate_status(self, value):
        if value not in EventStatus.values:
            raise serializers.ValidationError("Statut d'evenement invalide.")
        return value

    def validate_recurrence(self, value):
        if value not in EventRecurrence.values:
            raise serializers.ValidationError("Recurrence invalide.")
        return value

    def validate_budget(self, value):
        if value < 0:
            raise serializers.ValidationError("Le budget ne peut pas etre negatif.")
        return value

    def validate_reminder_offsets(self, value):
        if not isinstance(value, list) or any(not isinstance(item, int) or item <= 0 for item in value):
            raise serializers.ValidationError("Les rappels doivent etre une liste de minutes positives.")
        return value

    def validate(self, attrs):
        workspace = self.context.get("workspace")
        start_at = attrs.get("start_at") or getattr(self.instance, "start_at", None)
        end_at = attrs.get("end_at") or getattr(self.instance, "end_at", None)
        responsible_user = attrs.get("responsible_user") or getattr(self.instance, "responsible_user", None)
        responsible_member = attrs.get("responsible_member") or getattr(self.instance, "responsible_member", None)
        project = attrs.get("project") or getattr(self.instance, "project", None)
        owner = attrs.get("owner") or getattr(self.instance, "owner", None)
        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError({"end_at": "La date de fin doit etre posterieure au debut."})
        if attrs.get("registration_deadline") and start_at and attrs["registration_deadline"] > start_at:
            raise serializers.ValidationError({"registration_deadline": "La date limite doit etre avant le debut."})
        if responsible_user and not WorkspaceMembership.objects.filter(workspace=workspace, user=responsible_user, status="active").exists():
            raise serializers.ValidationError({"responsible_user": "Le responsable doit appartenir au workspace."})
        if responsible_member and responsible_member.workspace_id != workspace.id:
            raise serializers.ValidationError({"responsible_member": "Le membre responsable doit appartenir au workspace."})
        if owner and owner.workspace_id != workspace.id:
            raise serializers.ValidationError({"owner": "Le responsable evenement doit appartenir au workspace."})
        if project and project.workspace_id != workspace.id:
            raise serializers.ValidationError({"project": "Le projet associe doit appartenir au workspace."})
        return attrs


class CalendarEventSerializer(serializers.ModelSerializer):
    color = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = ["id", "title", "event_type", "status", "start_at", "end_at", "location", "project", "color"]

    def get_color(self, obj):
        return {
            EventType.MEETING: "blue",
            EventType.GENERAL_ASSEMBLY: "indigo",
            EventType.TRAINING: "emerald",
            EventType.CONFERENCE: "cyan",
            EventType.SEMINAR: "cyan",
            EventType.WORKSHOP: "emerald",
            EventType.CEREMONY: "amber",
            EventType.FUNDRAISING: "rose",
            EventType.SOCIAL: "pink",
            EventType.COMMUNITY: "teal",
            EventType.SPORT: "lime",
            EventType.CULTURAL: "violet",
            EventType.OTHER: "slate",
        }.get(obj.event_type, "slate")


class AttendanceUpdateSerializer(serializers.Serializer):
    participant_id = serializers.IntegerField()
    attended = serializers.BooleanField()


class RegisterSerializer(serializers.Serializer):
    member = serializers.PrimaryKeyRelatedField(queryset=Member.objects.all())
    registration_data = serializers.JSONField(required=False)


class TicketCheckinSerializer(serializers.Serializer):
    ticket_id = serializers.IntegerField(required=False)
    code = serializers.CharField(required=False)


class RsvpSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        EventParticipantStatus.INVITED,
        EventParticipantStatus.CONFIRMED,
        EventParticipantStatus.DECLINED,
    ])
