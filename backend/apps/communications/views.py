from rest_framework import decorators, filters, response, status, viewsets
from rest_framework.views import APIView

from common.permissions.workspace import RequireWorkspacePermission
from apps.members.models import Member
from apps.workspaces.models import WorkspaceMembership
from .models import (
    AudienceType,
    Communication,
    CommunicationCategory,
    CommunicationChannel,
    CommunicationPriority,
    CommunicationRecipient,
    CommunicationRecipientStatus,
    CommunicationStatus,
    CommunicationTemplate,
    CommunicationType,
)
from .serializers import (
    AudiencePreviewSerializer,
    CommunicationActionSerializer,
    CommunicationDashboardSerializer,
    CommunicationRecipientSerializer,
    CommunicationSerializer,
    CommunicationTemplateSerializer,
)
from .services import (
    audience_preview,
    cancel_communication,
    communication_queryset_for_workspace,
    communication_stats,
    create_communication,
    create_template,
    mark_all_notifications_read,
    notification_queryset_for_user,
    schedule_communication,
    send_communication,
    update_communication,
    workspace_communication_dashboard,
)


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


def choices_payload():
    return {
        "types": [{"value": value, "label": label} for value, label in CommunicationType.choices],
        "statuses": [{"value": value, "label": label} for value, label in CommunicationStatus.choices],
        "channels": [{"value": value, "label": label} for value, label in CommunicationChannel.choices],
        "priorities": [{"value": value, "label": label} for value, label in CommunicationPriority.choices],
        "categories": [{"value": value, "label": label} for value, label in CommunicationCategory.choices],
        "audiences": [{"value": value, "label": label} for value, label in AudienceType.choices],
    }


def current_membership(request):
    return WorkspaceMembership.objects.select_related("role").get(user=request.user, workspace__slug=request.headers.get("X-Workspace"), status=WorkspaceMembership.Status.ACTIVE)


class CommunicationViewSet(viewsets.ModelViewSet):
    serializer_class = CommunicationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["title", "content", "created_by__email"]
    ordering_fields = ["created_at", "scheduled_at", "sent_at", "title", "status"]
    ordering = ["-created_at"]

    def get_permissions(self):
        permission_map = {
            "create": "communication.create",
            "update": "communication.edit",
            "partial_update": "communication.edit",
            "destroy": "communication.delete",
            "send": "communication.send",
            "schedule": "communication.schedule",
            "cancel": "communication.cancel",
            "stats": "communication.view_stats",
            "dashboard": "communication.view_stats",
            "audience_preview": "communication.create",
            "choices": "communication.view",
        }
        permission_code = permission_map.get(self.action, "communication.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        queryset = communication_queryset_for_workspace(current_workspace(self.request))
        membership = current_membership(self.request)
        if membership.role.code.upper() == "MEMBER":
            member = Member.objects.filter(workspace=membership.workspace, linked_user=self.request.user).first()
            queryset = queryset.filter(recipients__user=self.request.user)
            if member:
                queryset = queryset | communication_queryset_for_workspace(membership.workspace).filter(recipients__member=member)
            queryset = queryset.distinct()
        if self.request.query_params.get("status"):
            queryset = queryset.filter(status=self.request.query_params["status"])
        if self.request.query_params.get("type"):
            queryset = queryset.filter(communication_type=self.request.query_params["type"])
        if self.request.query_params.get("category"):
            queryset = queryset.filter(category=self.request.query_params["category"])
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        attachments = serializer.validated_data.pop("attachments", None)
        communication = create_communication(workspace=current_workspace(request), actor=request.user, attachments=attachments, **serializer.validated_data)
        return response.Response(self.get_serializer(communication).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        communication = self.get_object()
        serializer = self.get_serializer(communication, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        attachments = serializer.validated_data.pop("attachments", None)
        updated = update_communication(communication=communication, actor=request.user, attachments=attachments, **serializer.validated_data)
        return response.Response(self.get_serializer(updated).data)

    def perform_destroy(self, instance):
        from .services import log_communication

        log_communication(workspace=instance.workspace, actor=self.request.user, action="communication.deleted", communication=instance)
        instance.delete()

    @decorators.action(detail=False, methods=["get"])
    def dashboard(self, request):
        return response.Response(CommunicationDashboardSerializer(workspace_communication_dashboard(current_workspace(request))).data)

    @decorators.action(detail=False, methods=["get"], url_path="choices")
    def choices(self, request):
        return response.Response(choices_payload())

    @decorators.action(detail=False, methods=["post"], url_path="audience-preview")
    def audience_preview(self, request):
        serializer = AudiencePreviewSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        return response.Response(audience_preview(current_workspace(request), serializer.validated_data["audience_type"], serializer.validated_data.get("audience_filters"), serializer.validated_data.get("channels") or [CommunicationChannel.IN_APP]))

    @decorators.action(detail=True, methods=["post"])
    def send(self, request, pk=None):
        serializer = CommunicationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        communication = send_communication(communication=self.get_object(), actor=request.user, send_now=serializer.validated_data.get("send_now", True))
        return response.Response(self.get_serializer(communication).data)

    @decorators.action(detail=True, methods=["post"])
    def schedule(self, request, pk=None):
        serializer = CommunicationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        if not serializer.validated_data.get("scheduled_at"):
            return response.Response({"scheduled_at": "Ce champ est requis."}, status=status.HTTP_400_BAD_REQUEST)
        communication = schedule_communication(communication=self.get_object(), actor=request.user, scheduled_at=serializer.validated_data["scheduled_at"])
        return response.Response(self.get_serializer(communication).data)

    @decorators.action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        communication = cancel_communication(communication=self.get_object(), actor=request.user)
        return response.Response(self.get_serializer(communication).data)

    @decorators.action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        return response.Response(communication_stats(Communication.objects.filter(id=self.get_object().id)))

    @decorators.action(detail=True, methods=["get"])
    def recipients(self, request, pk=None):
        recipients = self.get_object().recipients.select_related("member", "user").order_by("-created_at")
        page = self.paginate_queryset(recipients)
        serializer = CommunicationRecipientSerializer(page or recipients, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return response.Response(serializer.data)


class CommunicationTemplateViewSet(viewsets.ModelViewSet):
    serializer_class = CommunicationTemplateSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "subject", "content"]
    ordering_fields = ["created_at", "updated_at", "name"]
    ordering = ["name"]

    def get_permissions(self):
        permission_map = {"create": "communication.manage_templates", "update": "communication.manage_templates", "partial_update": "communication.manage_templates", "destroy": "communication.manage_templates"}
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "communication.manage_templates"))()]

    def get_queryset(self):
        return CommunicationTemplate.objects.filter(workspace=current_workspace(self.request))

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        template = create_template(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        return response.Response(self.get_serializer(template).data, status=status.HTTP_201_CREATED)


class MyNotificationsView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("communication.view")]

    def get(self, request):
        queryset = notification_queryset_for_user(current_workspace(request), request.user)
        if request.query_params.get("unread") == "true":
            queryset = queryset.exclude(status=CommunicationRecipientStatus.READ)
        return response.Response(CommunicationRecipientSerializer(queryset[:100], many=True).data)


class MarkAllNotificationsReadView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("communication.view")]

    def post(self, request):
        return response.Response({"updated": mark_all_notifications_read(workspace=current_workspace(request), user=request.user)})


class MarkNotificationReadView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("communication.view")]

    def post(self, request, recipient_id: int):
        recipient = notification_queryset_for_user(current_workspace(request), request.user).filter(id=recipient_id).first()
        if not recipient:
            return response.Response({"message": "Notification introuvable."}, status=status.HTTP_404_NOT_FOUND)
        recipient.mark_read()
        return response.Response(CommunicationRecipientSerializer(recipient).data)
