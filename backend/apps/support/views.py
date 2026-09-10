from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.audit_logs.models import AuditLog
from apps.novex_admin.permissions import IsNovexAdmin
from common.permissions.workspace import RequireWorkspacePermission
from .models import SupportTicketCategory
from .serializers import SupportTicketCreateSerializer, SupportTicketReplySerializer, SupportTicketSerializer, SupportTicketStatusSerializer
from .services import (
    admin_ticket_queryset,
    create_support_ticket,
    creator_ticket_queryset,
    filter_admin_tickets,
    reply_to_ticket,
    ticket_quota,
    ticket_stats,
    update_ticket_status,
)


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


def paginate_queryset(request, queryset, serializer_class):
    page = max(1, int(request.query_params.get("page", 1)))
    page_size = min(100, max(1, int(request.query_params.get("page_size", 20))))
    total = queryset.count()
    start = (page - 1) * page_size
    end = start + page_size
    return {
        "count": total,
        "page": page,
        "page_size": page_size,
        "next": page + 1 if end < total else None,
        "previous": page - 1 if page > 1 else None,
        "results": serializer_class(queryset[start:end], many=True).data,
    }


class CreatorSupportTicketViewSet(viewsets.ViewSet):
    permission_classes = [RequireWorkspacePermission.for_permission("support.tickets.view_own")]

    def get_permissions(self):
        permission = "support.tickets.create" if self.action == "create" else "support.tickets.view_own"
        return [RequireWorkspacePermission.for_permission(permission)()]

    def list(self, request):
        workspace = current_workspace(request)
        queryset = creator_ticket_queryset(workspace=workspace, creator=request.user)
        return Response({
            "stats": ticket_stats(queryset),
            "quota": ticket_quota(workspace=workspace, creator=request.user),
            "categories": [{"value": value, "label": label} for value, label in SupportTicketCategory.choices],
            "tickets": paginate_queryset(request, queryset, SupportTicketSerializer),
        })

    def create(self, request):
        workspace = current_workspace(request)
        serializer = SupportTicketCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            ticket = create_support_ticket(workspace=workspace, creator=request.user, **serializer.validated_data)
        except ValueError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SupportTicketSerializer(ticket).data, status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        workspace = current_workspace(request)
        ticket = creator_ticket_queryset(workspace=workspace, creator=request.user).filter(id=pk).first()
        if not ticket:
            return Response({"message": "Ticket introuvable."}, status=status.HTTP_404_NOT_FOUND)
        AuditLog.objects.create(workspace=workspace, actor=request.user, action="TICKET_VIEWED", resource="support_ticket", resource_id=str(ticket.id))
        return Response(SupportTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        workspace = current_workspace(request)
        ticket = creator_ticket_queryset(workspace=workspace, creator=request.user).filter(id=pk).first()
        if not ticket:
            return Response({"message": "Ticket introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = SupportTicketReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reply_to_ticket(ticket=ticket, author=request.user, body=serializer.validated_data["body"], is_admin_reply=False)
        return Response(SupportTicketSerializer(ticket).data)


class AdminSupportTicketViewSet(viewsets.ViewSet):
    permission_classes = [IsNovexAdmin]

    def list(self, request):
        queryset = filter_admin_tickets(admin_ticket_queryset(), request.query_params)
        return Response({
            "stats": ticket_stats(queryset),
            "tickets": paginate_queryset(request, queryset, SupportTicketSerializer),
        })

    def retrieve(self, request, pk=None):
        ticket = admin_ticket_queryset().filter(id=pk).first()
        if not ticket:
            return Response({"message": "Ticket introuvable."}, status=status.HTTP_404_NOT_FOUND)
        AuditLog.objects.create(workspace=ticket.workspace, actor=request.user, action="TICKET_VIEWED", resource="support_ticket", resource_id=str(ticket.id))
        return Response(SupportTicketSerializer(ticket).data)

    @action(detail=True, methods=["patch", "post"])
    def status(self, request, pk=None):
        ticket = admin_ticket_queryset().filter(id=pk).first()
        if not ticket:
            return Response({"message": "Ticket introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = SupportTicketStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            ticket = update_ticket_status(ticket=ticket, admin=request.user, status=serializer.validated_data["status"])
        except ValueError as exc:
            return Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(SupportTicketSerializer(ticket).data)

    @action(detail=True, methods=["post"])
    def reply(self, request, pk=None):
        ticket = admin_ticket_queryset().filter(id=pk).first()
        if not ticket:
            return Response({"message": "Ticket introuvable."}, status=status.HTTP_404_NOT_FOUND)
        serializer = SupportTicketReplySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reply_to_ticket(ticket=ticket, author=request.user, body=serializer.validated_data["body"], is_admin_reply=True)
        return Response(SupportTicketSerializer(ticket).data)
