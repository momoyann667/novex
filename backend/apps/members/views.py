import csv

from django.core.cache import cache
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import filters, status, views, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from common.permissions.workspace import RequireWorkspacePermission
from .models import Member, MemberCategory, MemberCustomFieldDefinition, MemberGroup, MemberInvitation, MembershipApplication, MembershipSettings, MemberTag
from .serializers import (
    InvitationTokenSerializer,
    MemberCategorySerializer,
    MemberCustomFieldDefinitionSerializer,
    MemberDirectoryBulkActionSerializer,
    MemberDirectorySerializer,
    MemberGroupSerializer,
    MemberInvitationSerializer,
    MemberSerializer,
    MemberSummarySerializer,
    MembershipApplicationActionSerializer,
    MembershipApplicationSerializer,
    MembershipApplicationSummarySerializer,
    MembershipSettingsSerializer,
    PublicInvitationSerializer,
    PublicMembershipApplicationSerializer,
    PublicMembershipSettingsSerializer,
    SelfMemberDashboardSerializer,
    SelfMemberProfileSerializer,
    MemberTagSerializer,
)
from .services import (
    accept_invitation,
    approve_application,
    archive_member,
    cancel_application,
    cancel_invitation,
    create_member,
    create_member_invitation,
    create_membership_application,
    decline_invitation,
    expire_application,
    filter_member_directory,
    get_invitation_by_token,
    get_membership_settings,
    log_member_export,
    member_directory_base_queryset,
    member_directory_facets,
    member_directory_segments,
    member_directory_summary,
    member_contribution_status,
    member_dashboard,
    member_seniority,
    reject_application,
    resend_invitation,
    restore_member,
    sort_member_directory,
    review_application,
    self_member_for_user,
    update_self_member_profile,
    update_member,
)


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


def member_contribution_label(member):
    return {
        "up_to_date": "A jour",
        "overdue": "En retard",
        "partial": "Partiellement paye",
        "pending": "En attente",
        "none": "Aucune cotisation",
    }[member_contribution_status(member)]


class MemberViewSet(viewsets.ModelViewSet):
    serializer_class = MemberSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "phone", "email", "membership_number", "function"]
    ordering_fields = ["created_at", "updated_at", "join_date", "last_name", "status", "membership_number"]
    ordering = ["last_name", "first_name"]
    permission_classes = [RequireWorkspacePermission.for_permission("members.view")]

    def get_permissions(self):
        permission_map = {
            "create": "members.create",
            "update": "members.update",
            "partial_update": "members.update",
            "destroy": "members.archive",
            "archive": "members.archive",
            "restore": "members.restore",
            "summary": "members.view",
            "directory": "members.view",
            "directory_export": "members.export",
            "export": "members.export",
            "bulk_archive": "members.archive",
            "bulk_status": "members.update",
        }
        permission_code = permission_map.get(self.action, "members.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        workspace = self.request.headers.get("X-Workspace")
        queryset = (
            Member.objects.select_related("category", "workspace", "linked_user")
            .prefetch_related("tags", "groups")
            .filter(
                workspace__slug=workspace,
                workspace__memberships__user=self.request.user,
                workspace__memberships__status="active",
            )
            .distinct()
        )
        filters_map = {
            "status": "status",
            "function": "function__iexact",
            "role": "function__iexact",
            "category": "category_id",
            "city": "city__icontains",
            "joined_from": "join_date__gte",
            "joined_to": "join_date__lte",
        }
        for key, field in filters_map.items():
            value = self.request.query_params.get(key)
            if value:
                queryset = queryset.filter(**{field: value})
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tags = serializer.validated_data.pop("tags", None)
        groups = serializer.validated_data.pop("groups", None)
        member = create_member(workspace=current_workspace(request), actor=request.user, tags=tags, groups=groups, **serializer.validated_data)
        return Response(self.get_serializer(member).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        member = self.get_object()
        serializer = self.get_serializer(member, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        tags = serializer.validated_data.pop("tags", None)
        groups = serializer.validated_data.pop("groups", None)
        updated = update_member(member=member, actor=request.user, tags=tags, groups=groups, **serializer.validated_data)
        return Response(self.get_serializer(updated).data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        member = archive_member(member=self.get_object(), actor=request.user)
        return Response(self.get_serializer(member).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        member = archive_member(member=self.get_object(), actor=request.user)
        return Response(self.get_serializer(member).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        member = restore_member(member=self.get_object(), actor=request.user)
        return Response(self.get_serializer(member).data, status=status.HTTP_200_OK)

    @action(detail=True, methods=["get"])
    def history(self, request, pk=None):
        member = self.get_object()
        rows = member.activities.select_related("actor").order_by("-created_at")[:50]
        from .serializers import MemberActivitySerializer

        return Response(MemberActivitySerializer(rows, many=True).data)

    @action(detail=True, methods=["get"], url_path="seniority")
    def seniority(self, request, pk=None):
        return Response(member_seniority(self.get_object()))

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        payload = {
            "total": queryset.count(),
            "active": queryset.filter(status=Member.Status.ACTIVE).count(),
            "pending": queryset.filter(status=Member.Status.PENDING).count(),
            "inactive": queryset.filter(status=Member.Status.INACTIVE).count(),
            "suspended": queryset.filter(status=Member.Status.SUSPENDED).count(),
            "archived": queryset.filter(status=Member.Status.ARCHIVED).count(),
        }
        return Response(MemberSummarySerializer(payload).data)

    @action(detail=False, methods=["get"])
    def directory(self, request):
        workspace = current_workspace(request)
        queryset = sort_member_directory(filter_member_directory(member_directory_base_queryset(workspace), request.query_params), request.query_params.get("sort") or request.query_params.get("ordering"))
        page = self.paginate_queryset(queryset)
        serializer = MemberDirectorySerializer(page or queryset, many=True, context=self.get_serializer_context())
        payload = {
            "summary": member_directory_summary(workspace),
            "facets": member_directory_facets(workspace),
            "segments": member_directory_segments(workspace),
            "results": serializer.data,
        }
        if page is not None:
            response = self.get_paginated_response(serializer.data)
            response.data["summary"] = payload["summary"]
            response.data["facets"] = payload["facets"]
            response.data["segments"] = payload["segments"]
            return response
        return Response(payload)

    @action(detail=False, methods=["get"], url_path="directory-export")
    def directory_export(self, request):
        workspace = current_workspace(request)
        queryset = sort_member_directory(filter_member_directory(member_directory_base_queryset(workspace), request.query_params), request.query_params.get("sort") or request.query_params.get("ordering"))
        return self.export_directory_queryset(request, workspace, queryset, request.query_params.dict())

    @action(detail=False, methods=["post"], url_path="export")
    def export(self, request):
        workspace = current_workspace(request)
        filters_payload = dict(request.data)
        queryset = sort_member_directory(filter_member_directory(member_directory_base_queryset(workspace), filters_payload), filters_payload.get("sort") or filters_payload.get("ordering"))
        return self.export_directory_queryset(request, workspace, queryset, filters_payload)

    def export_directory_queryset(self, request, workspace, queryset, filters_payload):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="novex-membres.csv"'
        response.write("\ufeff")
        writer = csv.writer(response)
        writer.writerow(["Numero", "Nom", "Prenoms", "Fonction", "Telephone", "Email", "Statut", "Categorie", "Ville", "Adhesion", "Cotisation", "Derniere activite"])
        count = 0
        for member in queryset.iterator(chunk_size=500):
            count += 1
            writer.writerow([
                member.membership_number,
                member.last_name,
                member.first_name,
                member.function,
                member.phone,
                member.email,
                member.status,
                member.category.name if member.category_id else "",
                member.city,
                member.join_date,
                member_contribution_label(member),
                getattr(member, "last_activity_at", "") or "",
            ])
        log_member_export(workspace=workspace, actor=request.user, count=count, filters=filters_payload)
        return response

    @action(detail=False, methods=["post"], url_path="bulk-archive")
    def bulk_archive(self, request):
        serializer = MemberDirectoryBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        members = self.get_queryset().filter(id__in=serializer.validated_data["member_ids"]).exclude(status=Member.Status.ARCHIVED)
        archived = 0
        for member in members:
            archive_member(member=member, actor=request.user)
            archived += 1
        return Response({"archived": archived}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="bulk-status")
    def bulk_status(self, request):
        serializer = MemberDirectoryBulkActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        next_status = serializer.validated_data.get("status")
        if not next_status:
            return Response({"status": "Ce champ est requis."}, status=status.HTTP_400_BAD_REQUEST)
        members = self.get_queryset().filter(id__in=serializer.validated_data["member_ids"])
        updated = 0
        for member in members:
            update_member(member=member, actor=request.user, status=next_status)
            updated += 1
        return Response({"updated": updated}, status=status.HTTP_200_OK)


class WorkspaceScopedViewSet(viewsets.ModelViewSet):
    permission_classes = [RequireWorkspacePermission.for_permission("members.view")]

    def get_permissions(self):
        permission_map = {"create": "members.update", "update": "members.update", "partial_update": "members.update", "destroy": "members.update"}
        permission_code = permission_map.get(self.action, "members.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        return self.model.objects.filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        ).distinct()

    def perform_create(self, serializer):
        serializer.save(workspace=current_workspace(self.request))


class MemberCategoryViewSet(WorkspaceScopedViewSet):
    model = MemberCategory
    serializer_class = MemberCategorySerializer


class MemberTagViewSet(WorkspaceScopedViewSet):
    model = MemberTag
    serializer_class = MemberTagSerializer


class MemberGroupViewSet(WorkspaceScopedViewSet):
    model = MemberGroup
    serializer_class = MemberGroupSerializer


class MemberCustomFieldDefinitionViewSet(WorkspaceScopedViewSet):
    model = MemberCustomFieldDefinition
    serializer_class = MemberCustomFieldDefinitionSerializer

    def get_permissions(self):
        permission_map = {"create": "members.manage_custom_fields", "update": "members.manage_custom_fields", "partial_update": "members.manage_custom_fields", "destroy": "members.manage_custom_fields"}
        permission_code = permission_map.get(self.action, "members.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]


class MembershipSettingsViewSet(viewsets.GenericViewSet):
    serializer_class = MembershipSettingsSerializer

    def get_permissions(self):
        permission_map = {"update": "members.onboarding.manage", "partial_update": "members.onboarding.manage"}
        permission_code = permission_map.get(self.action, "members.applications.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def list(self, request):
        settings = get_membership_settings(current_workspace(request))
        return Response(self.get_serializer(settings).data)

    def partial_update(self, request, pk=None):
        settings = get_membership_settings(current_workspace(request))
        serializer = self.get_serializer(settings, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def update(self, request, pk=None):
        return self.partial_update(request, pk)


class MembershipApplicationViewSet(viewsets.ModelViewSet):
    serializer_class = MembershipApplicationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "email", "phone"]
    ordering_fields = ["submitted_at", "reviewed_at", "status", "created_at"]
    ordering = ["-submitted_at"]

    def get_permissions(self):
        permission_map = {
            "create": "members.applications.review",
            "update": "members.applications.review",
            "partial_update": "members.applications.review",
            "review": "members.applications.review",
            "approve": "members.applications.approve",
            "reject": "members.applications.reject",
            "cancel": "members.applications.review",
            "summary": "members.applications.view",
        }
        permission_code = permission_map.get(self.action, "members.applications.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        queryset = MembershipApplication.objects.select_related("workspace", "member", "linked_user", "reviewed_by").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        status_filter = self.request.query_params.get("status")
        source_filter = self.request.query_params.get("source")
        date_from = self.request.query_params.get("date_from")
        date_to = self.request.query_params.get("date_to")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        if source_filter:
            queryset = queryset.filter(source=source_filter)
        if date_from:
            queryset = queryset.filter(submitted_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(submitted_at__date__lte=date_to)
        return queryset.distinct()

    def perform_create(self, serializer):
        create_membership_application(workspace=current_workspace(self.request), actor=self.request.user, source=MembershipApplication.Source.ADMIN, **serializer.validated_data)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = create_membership_application(workspace=current_workspace(request), actor=request.user, source=MembershipApplication.Source.ADMIN, **serializer.validated_data)
        return Response(self.get_serializer(application).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=["get"])
    def summary(self, request):
        queryset = self.get_queryset()
        payload = {
            "total": queryset.count(),
            "pending": queryset.filter(status=MembershipApplication.Status.PENDING).count(),
            "under_review": queryset.filter(status=MembershipApplication.Status.UNDER_REVIEW).count(),
            "approved": queryset.filter(status=MembershipApplication.Status.APPROVED).count(),
            "rejected": queryset.filter(status=MembershipApplication.Status.REJECTED).count(),
            "cancelled": queryset.filter(status=MembershipApplication.Status.CANCELLED).count(),
            "expired": queryset.filter(status=MembershipApplication.Status.EXPIRED).count(),
        }
        return Response(MembershipApplicationSummarySerializer(payload).data)

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        serializer = MembershipApplicationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        application = review_application(application=self.get_object(), actor=request.user, internal_note=serializer.validated_data.get("internal_note", ""))
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        serializer = MembershipApplicationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            application = approve_application(application=self.get_object(), actor=request.user, official_join_date=serializer.validated_data.get("official_join_date"))
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        serializer = MembershipApplicationActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            application = reject_application(
                application=self.get_object(),
                actor=request.user,
                rejection_reason=serializer.validated_data.get("rejection_reason", ""),
                internal_note=serializer.validated_data.get("internal_note", ""),
            )
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(application).data)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try:
            application = cancel_application(application=self.get_object(), actor=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(application).data)


class MemberInvitationViewSet(viewsets.ModelViewSet):
    serializer_class = MemberInvitationSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["first_name", "last_name", "email", "phone"]
    ordering_fields = ["created_at", "expires_at", "status"]
    ordering = ["-created_at"]

    def get_permissions(self):
        if self.action == "accept":
            return [AllowAny()]
        permission_map = {"create": "members.invitations.create", "cancel": "members.invitations.cancel", "resend": "members.invitations.resend"}
        permission_code = permission_map.get(self.action, "members.applications.view")
        return [RequireWorkspacePermission.for_permission(permission_code)()]

    def get_queryset(self):
        queryset = MemberInvitation.objects.select_related("workspace", "member", "invited_by", "accepted_by").filter(
            workspace__slug=self.request.headers.get("X-Workspace"),
            workspace__memberships__user=self.request.user,
            workspace__memberships__status="active",
        )
        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        return queryset.distinct()

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invitation, token, created = create_member_invitation(workspace=current_workspace(request), actor=request.user, **serializer.validated_data)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        response_serializer = self.get_serializer(invitation, context={"plain_token": token})
        return Response(response_serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)

    @action(detail=True, methods=["post"])
    def cancel(self, request, pk=None):
        try:
            invitation = cancel_invitation(invitation=self.get_object(), actor=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)

    @action(detail=True, methods=["post"])
    def resend(self, request, pk=None):
        try:
            invitation, token = resend_invitation(invitation=self.get_object(), actor=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation, context={"plain_token": token}).data)

    @action(detail=False, methods=["post"], permission_classes=[AllowAny])
    def accept(self, request):
        serializer = InvitationTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invitation = accept_invitation(token=serializer.validated_data["token"], user=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response(self.get_serializer(invitation).data)


class PublicMembershipViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    lookup_field = "slug"
    lookup_value_regex = "[-a-zA-Z0-9_]+"

    def _rate_limit(self, request, slug: str) -> bool:
        ip_address = request.META.get("REMOTE_ADDR", "unknown")
        key = f"membership-public:{slug}:{ip_address}"
        attempts = cache.get(key, 0) + 1
        cache.set(key, attempts, 60 * 60)
        return attempts <= 10

    def retrieve(self, request, slug=None):
        settings = get_object_or_404(MembershipSettings.objects.select_related("workspace"), workspace__slug=slug, workspace__status="active", membership_enabled=True, public_form_enabled=True)
        return Response(PublicMembershipSettingsSerializer(settings).data)

    @action(detail=False, methods=["post"], url_path="(?P<slug>[-a-zA-Z0-9_]+)/apply")
    def apply(self, request, slug=None):
        if not self._rate_limit(request, slug or ""):
            return Response({"detail": "Trop de demandes. Reessayez plus tard."}, status=status.HTTP_429_TOO_MANY_REQUESTS)
        settings = get_object_or_404(MembershipSettings.objects.select_related("workspace"), workspace__slug=slug, workspace__status="active", membership_enabled=True, public_form_enabled=True)
        serializer = PublicMembershipApplicationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        honeypot = request.data.get("website") or request.data.get("company")
        if honeypot:
            return Response({"detail": settings.confirmation_message}, status=status.HTTP_201_CREATED)
        application = create_membership_application(workspace=settings.workspace, actor=None, source=MembershipApplication.Source.PUBLIC_FORM, **serializer.validated_data)
        if application.expires_at and application.expires_at <= timezone.now():
            expire_application(application=application)
        return Response({"id": application.id, "status": application.status, "message": settings.confirmation_message}, status=status.HTTP_201_CREATED)


class PublicInvitationViewSet(viewsets.ViewSet):
    permission_classes = [AllowAny]
    lookup_field = "token"
    lookup_value_regex = "[-a-zA-Z0-9_]+"

    def retrieve(self, request, token=None):
        invitation = get_invitation_by_token(token or "")
        if not invitation:
            return Response({"detail": "Invitation invalide."}, status=status.HTTP_404_NOT_FOUND)
        if invitation.expires_at <= timezone.now() and invitation.status == MemberInvitation.Status.PENDING:
            invitation.status = MemberInvitation.Status.EXPIRED
            invitation.save(update_fields=["status", "updated_at"])
        payload = {
            "association": invitation.workspace.name,
            "invitee_name": str(invitation),
            "invited_by_name": str(invitation.invited_by) if invitation.invited_by else "",
            "message": invitation.message,
            "status": invitation.status,
            "expires_at": invitation.expires_at,
        }
        return Response(PublicInvitationSerializer(payload).data)

    @action(detail=False, methods=["post"], url_path="accept")
    def accept_public(self, request):
        serializer = InvitationTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invitation = accept_invitation(token=serializer.validated_data["token"], user=request.user)
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": invitation.status, "member": invitation.member_id})

    @action(detail=False, methods=["post"], url_path="decline")
    def decline_public(self, request):
        serializer = InvitationTokenSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            invitation = decline_invitation(token=serializer.validated_data["token"])
        except ValueError as exc:
            return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return Response({"status": invitation.status})


class SelfMemberProfileView(views.APIView):
    def get_member(self, request):
        workspace = current_workspace(request)
        member = self_member_for_user(workspace=workspace, user=request.user)
        if not member:
            return workspace, None
        return workspace, member

    def get(self, request):
        _workspace, member = self.get_member(request)
        if not member:
            return Response({"detail": "Aucun profil membre lie a ce compte dans ce workspace."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SelfMemberProfileSerializer(member).data)

    def patch(self, request):
        _workspace, member = self.get_member(request)
        if not member:
            return Response({"detail": "Aucun profil membre lie a ce compte dans ce workspace."}, status=status.HTTP_404_NOT_FOUND)
        serializer = SelfMemberProfileSerializer(member, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_self_member_profile(member=member, actor=request.user, **serializer.validated_data)
        return Response(SelfMemberProfileSerializer(updated).data)


class SelfMemberDashboardView(views.APIView):
    def get(self, request):
        workspace = current_workspace(request)
        member = self_member_for_user(workspace=workspace, user=request.user)
        if not member:
            return Response({"detail": "Aucun profil membre lie a ce compte dans ce workspace."}, status=status.HTTP_404_NOT_FOUND)
        return Response(SelfMemberDashboardSerializer(member_dashboard(workspace=workspace, member=member)).data)
