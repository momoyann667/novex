from django.contrib.auth import get_user_model
from rest_framework import serializers

from apps.members.models import Member
from apps.projects.models import Project
from apps.workspaces.models import WorkspaceMembership
from .models import Event, EventActivity, EventDocument, EventExpenseAllocation, EventParticipant, EventRevenueAllocation
from .services import event_stats
from .statuses import EventParticipantStatus, EventRecurrence, EventStatus, EventType


class EventParticipantSerializer(serializers.ModelSerializer):
    member_name = serializers.SerializerMethodField()

    class Meta:
        model = EventParticipant
        fields = ["id", "event", "member", "member_name", "status", "responded_at", "attendance_status", "checked_in_at", "created_at", "updated_at"]
        read_only_fields = ["id", "event", "member_name", "responded_at", "checked_in_at", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            self.fields["member"].queryset = Member.objects.filter(workspace=workspace)

    def get_member_name(self, obj):
        return str(obj.member)


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


class EventSerializer(serializers.ModelSerializer):
    event_type_label = serializers.CharField(source="get_event_type_display", read_only=True)
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    stats = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "description",
            "event_type",
            "event_type_label",
            "status",
            "status_label",
            "start_at",
            "end_at",
            "location",
            "responsible_user",
            "responsible_member",
            "capacity",
            "budget",
            "project",
            "recurrence",
            "reminder_offsets",
            "stats",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "stats", "created_at", "updated_at"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        workspace = self.context.get("workspace")
        if workspace:
            user_ids = WorkspaceMembership.objects.filter(workspace=workspace, status="active").values_list("user_id", flat=True)
            self.fields["responsible_user"].queryset = get_user_model().objects.filter(id__in=user_ids)
            self.fields["responsible_member"].queryset = Member.objects.filter(workspace=workspace)
            self.fields["project"].queryset = Project.objects.filter(workspace=workspace)

    def get_stats(self, obj):
        return event_stats(obj)

    def validate_event_type(self, value):
        if value not in EventType.values:
            raise serializers.ValidationError("Type d'evenement invalide.")
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
        if start_at and end_at and end_at <= start_at:
            raise serializers.ValidationError({"end_at": "La date de fin doit etre posterieure au debut."})
        if responsible_user and not WorkspaceMembership.objects.filter(workspace=workspace, user=responsible_user, status="active").exists():
            raise serializers.ValidationError({"responsible_user": "Le responsable doit appartenir au workspace."})
        if responsible_member and responsible_member.workspace_id != workspace.id:
            raise serializers.ValidationError({"responsible_member": "Le membre responsable doit appartenir au workspace."})
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
            EventType.CEREMONY: "amber",
            EventType.FUNDRAISING: "rose",
            EventType.COMMUNITY: "teal",
            EventType.SPORT: "lime",
            EventType.CULTURAL: "violet",
            EventType.OTHER: "slate",
        }.get(obj.event_type, "slate")


class AttendanceUpdateSerializer(serializers.Serializer):
    participant_id = serializers.IntegerField()
    attended = serializers.BooleanField()


class RsvpSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        EventParticipantStatus.INVITED,
        EventParticipantStatus.CONFIRMED,
        EventParticipantStatus.DECLINED,
    ])
