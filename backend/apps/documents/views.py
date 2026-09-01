from django.http import FileResponse, Http404, HttpResponse
from django.utils import timezone
from rest_framework import decorators, filters, response, status, viewsets
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.views import APIView

from common.permissions.workspace import RequireWorkspacePermission
from .models import Document, DocumentApproval, DocumentFavorite, DocumentFolder, DocumentShare, DocumentShareLink, DocumentTag, DocumentVersion
from .serializers import (
    DocumentActivitySerializer,
    DocumentApprovalSerializer,
    DocumentFolderSerializer,
    DocumentSerializer,
    DocumentShareLinkSerializer,
    DocumentShareSerializer,
    DocumentTagSerializer,
    DocumentVersionSerializer,
)
from .services import (
    add_document_version,
    archive_document,
    create_document,
    create_folder,
    document_analytics,
    ensure_default_folders,
    export_document_metadata_csv,
    move_document,
    permanently_delete_document,
    record_access,
    restore_document,
    restore_document_version,
    search_documents,
    trash_document,
    update_document,
)
from .statuses import ApprovalStatus, DocumentActivityAction, DocumentStatus


def current_workspace(request):
    return request.user.workspace_memberships.get(workspace__slug=request.headers.get("X-Workspace"), status="active").workspace


class DocumentAnalyticsView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("documents.view")]

    def get(self, request):
        return response.Response(document_analytics(workspace=current_workspace(request), include_sensitive=False))


class DocumentSearchView(APIView):
    permission_classes = [RequireWorkspacePermission.for_permission("documents.view")]

    def get(self, request):
        queryset = search_documents(workspace=current_workspace(request), filters=request.query_params, include_sensitive=False)
        page = self.paginate_queryset(queryset.order_by("-updated_at"))
        serializer = DocumentSerializer(page, many=True, context={"request": request, "workspace": current_workspace(request)})
        return self.get_paginated_response(serializer.data)

    def paginate_queryset(self, queryset):
        from common.pagination import NovexPagination

        self.paginator = NovexPagination()
        return self.paginator.paginate_queryset(queryset, self.request, view=self)

    def get_paginated_response(self, data):
        return self.paginator.get_paginated_response(data)


class DocumentFolderViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentFolderSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("documents.view")]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "updated_at"]

    def get_permissions(self):
        permission_map = {"create": "documents.create", "update": "documents.update", "partial_update": "documents.update", "destroy": "documents.delete", "archive": "documents.archive"}
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "documents.view"))()]

    def get_queryset(self):
        workspace = self.request.headers.get("X-Workspace")
        return DocumentFolder.objects.filter(workspace__slug=workspace, workspace__memberships__user=self.request.user, workspace__memberships__status="active").order_by("parent_id", "name")

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def list(self, request, *args, **kwargs):
        ensure_default_folders(current_workspace(request), actor=request.user)
        return super().list(request, *args, **kwargs)

    def perform_create(self, serializer):
        serializer.instance = create_folder(workspace=current_workspace(self.request), actor=self.request.user, **serializer.validated_data)

    def perform_destroy(self, instance):
        instance.is_archived = True
        instance.save(update_fields=["is_archived", "updated_at"])

    @decorators.action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        folder = self.get_object()
        folder.is_archived = True
        folder.save(update_fields=["is_archived", "updated_at"])
        return response.Response(self.get_serializer(folder).data)


class DocumentTagViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentTagSerializer
    permission_classes = [RequireWorkspacePermission.for_permission("documents.view")]

    def get_permissions(self):
        if self.action in {"create", "update", "partial_update", "destroy"}:
            return [RequireWorkspacePermission.for_permission("documents.update")()]
        return [RequireWorkspacePermission.for_permission("documents.view")()]

    def get_queryset(self):
        return DocumentTag.objects.filter(workspace__slug=self.request.headers.get("X-Workspace"), workspace__memberships__user=self.request.user, workspace__memberships__status="active").order_by("name")

    def perform_create(self, serializer):
        serializer.save(workspace=current_workspace(self.request))


class DocumentViewSet(viewsets.ModelViewSet):
    serializer_class = DocumentSerializer
    parser_classes = [MultiPartParser, FormParser]
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ["name", "description", "file_type", "folder__name", "uploaded_by__email", "tags__name"]
    ordering_fields = ["name", "created_at", "updated_at", "size", "file_type"]

    def get_permissions(self):
        permission_map = {
            "create": "documents.create",
            "update": "documents.update",
            "partial_update": "documents.update",
            "destroy": "documents.delete",
            "download": "documents.download",
            "preview": "documents.view",
            "archive": "documents.archive",
            "restore": "documents.restore",
            "versions": "documents.manage_versions",
            "restore_version": "documents.manage_versions",
            "shares": "documents.share",
            "share_links": "documents.share",
            "favorite": "documents.view",
            "unfavorite": "documents.view",
            "approvals": "documents.approve",
            "approve": "documents.approve",
            "reject": "documents.approve",
            "permanent_delete": "documents.permanent_delete",
            "export": "documents.export",
        }
        return [RequireWorkspacePermission.for_permission(permission_map.get(self.action, "documents.view"))()]

    def get_queryset(self):
        filters_payload = self.request.query_params
        include_sensitive = self.request.query_params.get("include_sensitive") == "true"
        queryset = search_documents(workspace=current_workspace(self.request), filters=filters_payload, include_sensitive=include_sensitive)
        if self.request.query_params.get("view") == "trash":
            queryset = queryset.filter(status=DocumentStatus.TRASH)
        elif self.request.query_params.get("view") == "archives":
            queryset = queryset.filter(status=DocumentStatus.ARCHIVED)
        elif self.request.query_params.get("view") == "favorites":
            queryset = queryset.filter(favorites__user=self.request.user)
        else:
            queryset = queryset.exclude(status=DocumentStatus.TRASH)
        return queryset

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context["workspace"] = current_workspace(self.request)
        return context

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        tags = serializer.validated_data.pop("tags", [])
        try:
            document = create_document(workspace=current_workspace(request), actor=request.user, tags=tags, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(document).data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        document = self.get_object()
        serializer = self.get_serializer(document, data=request.data, partial=kwargs.get("partial", False))
        serializer.is_valid(raise_exception=True)
        tags = serializer.validated_data.pop("tags", None)
        try:
            document = update_document(document=document, actor=request.user, tags=tags, **serializer.validated_data)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(document).data)

    def destroy(self, request, *args, **kwargs):
        return response.Response(self.get_serializer(trash_document(document=self.get_object(), actor=request.user)).data)

    @decorators.action(detail=True, methods=["get"])
    def download(self, request, pk=None):
        document = self.get_object()
        if not document.file:
            raise Http404("Fichier introuvable.")
        record_access(document=document, actor=request.user, action=DocumentActivityAction.DOWNLOADED)
        return FileResponse(document.file.open("rb"), as_attachment=True, filename=document.original_filename or document.name)

    @decorators.action(detail=True, methods=["get"])
    def preview(self, request, pk=None):
        document = self.get_object()
        if not document.file or document.status in {DocumentStatus.TRASH, DocumentStatus.ARCHIVED}:
            raise Http404("Apercu indisponible.")
        if document.mime_type not in {"application/pdf", "image/jpeg", "image/png", "image/webp", "text/plain", "text/csv"}:
            return response.Response({"message": "Apercu non disponible pour ce format."}, status=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE)
        record_access(document=document, actor=request.user, action=DocumentActivityAction.DOWNLOADED)
        return FileResponse(document.file.open("rb"), as_attachment=False, filename=document.original_filename or document.name, content_type=document.mime_type)

    @decorators.action(detail=True, methods=["post"])
    def archive(self, request, pk=None):
        return response.Response(self.get_serializer(archive_document(document=self.get_object(), actor=request.user)).data)

    @decorators.action(detail=True, methods=["post"])
    def restore(self, request, pk=None):
        return response.Response(self.get_serializer(restore_document(document=self.get_object(), actor=request.user)).data)

    @decorators.action(detail=True, methods=["post"], url_path="move")
    def move(self, request, pk=None):
        folder = None
        if request.data.get("folder"):
            folder = DocumentFolder.objects.get(id=request.data["folder"], workspace=current_workspace(request))
        try:
            document = move_document(document=self.get_object(), actor=request.user, folder=folder)
        except ValueError as exc:
            return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
        return response.Response(self.get_serializer(document).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def versions(self, request, pk=None):
        document = self.get_object()
        if request.method == "POST":
            serializer = DocumentVersionSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            try:
                version = add_document_version(document=document, actor=request.user, file=serializer.validated_data["file"], change_note=serializer.validated_data.get("change_note", ""))
            except ValueError as exc:
                return response.Response({"message": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
            return response.Response(DocumentVersionSerializer(version).data, status=status.HTTP_201_CREATED)
        return response.Response(DocumentVersionSerializer(document.versions.order_by("-version_number"), many=True).data)

    @decorators.action(detail=True, methods=["post"], url_path=r"versions/(?P<version_id>[^/.]+)/restore")
    def restore_version(self, request, pk=None, version_id=None):
        document = self.get_object()
        version = DocumentVersion.objects.get(document=document, id=version_id)
        new_version = restore_document_version(document=document, version=version, actor=request.user, change_note=request.data.get("change_note", ""))
        return response.Response(DocumentVersionSerializer(new_version).data)

    @decorators.action(detail=True, methods=["get", "post"])
    def shares(self, request, pk=None):
        document = self.get_object()
        if request.method == "POST":
            serializer = DocumentShareSerializer(data=request.data, context=self.get_serializer_context())
            serializer.is_valid(raise_exception=True)
            share = serializer.save(workspace=document.workspace, document=document, created_by=request.user)
            record_access(document=document, actor=request.user, action=DocumentActivityAction.SHARED)
            return response.Response(DocumentShareSerializer(share).data, status=status.HTTP_201_CREATED)
        return response.Response(DocumentShareSerializer(document.shares.all(), many=True).data)

    @decorators.action(detail=True, methods=["get", "post"], url_path="share-links")
    def share_links(self, request, pk=None):
        document = self.get_object()
        if request.method == "POST":
            serializer = DocumentShareLinkSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            link = serializer.save(workspace=document.workspace, document=document, created_by=request.user)
            record_access(document=document, actor=request.user, action=DocumentActivityAction.SHARED)
            return response.Response(DocumentShareLinkSerializer(link).data, status=status.HTTP_201_CREATED)
        return response.Response(DocumentShareLinkSerializer(document.share_links.all(), many=True).data)

    @decorators.action(detail=True, methods=["post"])
    def favorite(self, request, pk=None):
        document = self.get_object()
        DocumentFavorite.objects.get_or_create(workspace=document.workspace, document=document, user=request.user)
        return response.Response({"favorite": True})

    @decorators.action(detail=True, methods=["delete"])
    def unfavorite(self, request, pk=None):
        DocumentFavorite.objects.filter(document=self.get_object(), user=request.user).delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    @decorators.action(detail=True, methods=["get", "post"])
    def approvals(self, request, pk=None):
        document = self.get_object()
        if request.method == "POST":
            serializer = DocumentApprovalSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            approval = serializer.save(workspace=document.workspace, document=document)
            document.status = DocumentStatus.PENDING
            document.save(update_fields=["status", "updated_at"])
            return response.Response(DocumentApprovalSerializer(approval).data, status=status.HTTP_201_CREATED)
        return response.Response(DocumentApprovalSerializer(document.approvals.order_by("level", "created_at"), many=True).data)

    @decorators.action(detail=True, methods=["post"])
    def approve(self, request, pk=None):
        document = self.get_object()
        approval = document.approvals.filter(approver=request.user, status=ApprovalStatus.PENDING).order_by("level").first()
        if approval:
            approval.status = ApprovalStatus.APPROVED
            approval.comment = request.data.get("comment", approval.comment)
            approval.decided_at = timezone.now()
            approval.save(update_fields=["status", "comment", "decided_at"])
        document.status = DocumentStatus.APPROVED
        document.save(update_fields=["status", "updated_at"])
        record_access(document=document, actor=request.user, action=DocumentActivityAction.APPROVED)
        return response.Response(self.get_serializer(document).data)

    @decorators.action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        document = self.get_object()
        approval = document.approvals.filter(approver=request.user, status=ApprovalStatus.PENDING).order_by("level").first()
        if approval:
            approval.status = ApprovalStatus.REJECTED
            approval.comment = request.data.get("comment", approval.comment)
            approval.decided_at = timezone.now()
            approval.save(update_fields=["status", "comment", "decided_at"])
        document.status = DocumentStatus.REJECTED
        document.save(update_fields=["status", "updated_at"])
        record_access(document=document, actor=request.user, action=DocumentActivityAction.REJECTED)
        return response.Response(self.get_serializer(document).data)

    @decorators.action(detail=False, methods=["get"])
    def export(self, request):
        csv_payload = export_document_metadata_csv(workspace=current_workspace(request))
        return HttpResponse(csv_payload, content_type="text/csv", headers={"Content-Disposition": 'attachment; filename="documents.csv"'})

    @decorators.action(detail=True, methods=["delete"], url_path="permanent-delete")
    def permanent_delete(self, request, pk=None):
        document = self.get_object()
        record_access(document=document, actor=request.user, action=DocumentActivityAction.PERMANENTLY_DELETED)
        document.delete()
        return response.Response(status=status.HTTP_204_NO_CONTENT)

    @decorators.action(detail=True, methods=["get"])
    def activity(self, request, pk=None):
        return response.Response(DocumentActivitySerializer(self.get_object().activities.order_by("-created_at")[:100], many=True).data)
