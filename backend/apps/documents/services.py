import csv
import hashlib
import mimetypes
from io import StringIO
from pathlib import PurePath

from django.conf import settings
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.utils import timezone

from apps.audit_logs.models import AuditLog
from apps.workspaces.models import Workspace
from .models import (
    Document,
    DocumentAccessLog,
    DocumentActivity,
    DocumentApproval,
    DocumentFavorite,
    DocumentFolder,
    DocumentShare,
    DocumentShareLink,
    DocumentTag,
    DocumentVersion,
)
from .statuses import ApprovalStatus, DocumentActivityAction, DocumentCategory, DocumentSensitivity, DocumentStatus


ALLOWED_DOCUMENT_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
    ".csv",
    ".txt",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

ALLOWED_DOCUMENT_MIME_TYPES = {
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/csv",
    "text/plain",
    "image/jpeg",
    "image/png",
    "image/webp",
}

ROOT_FOLDERS = [
    "Administration",
    "Finances",
    "Membres",
    "Cotisations",
    "Projets",
    "Evenements",
    "Rapports",
    "Juridique",
    "Communication",
    "Archives",
]


def max_document_size() -> int:
    return int(getattr(settings, "MAX_DOCUMENT_SIZE", 25 * 1024 * 1024))


def normalized_extension(filename: str) -> str:
    if not filename or PurePath(filename).name != filename or ".." in filename:
        raise ValueError("Nom de fichier invalide.")
    if "." not in filename:
        raise ValueError("Extension de fichier requise.")
    return "." + filename.rsplit(".", 1)[-1].lower()


def sniff_mime_type(filename: str, browser_mime_type: str = "") -> str:
    guessed, _encoding = mimetypes.guess_type(filename)
    mime_type = guessed or browser_mime_type or ""
    if mime_type == "text/comma-separated-values":
        mime_type = "text/csv"
    return mime_type


def file_checksum(file_obj) -> str:
    digest = hashlib.sha256()
    position = file_obj.tell() if hasattr(file_obj, "tell") else None
    for chunk in file_obj.chunks() if hasattr(file_obj, "chunks") else [file_obj.read()]:
        digest.update(chunk)
    if position is not None and hasattr(file_obj, "seek"):
        file_obj.seek(position)
    return digest.hexdigest()


def validate_document_file(file_obj) -> dict:
    size = getattr(file_obj, "size", 0) or 0
    original_filename = PurePath(getattr(file_obj, "name", "")).name
    extension = normalized_extension(original_filename)
    browser_mime_type = getattr(file_obj, "content_type", "") or ""
    mime_type = sniff_mime_type(original_filename, browser_mime_type)
    if size > max_document_size():
        raise ValueError("Le fichier depasse la taille maximale autorisee.")
    if extension not in ALLOWED_DOCUMENT_EXTENSIONS:
        raise ValueError("Extension de fichier non autorisee.")
    if mime_type not in ALLOWED_DOCUMENT_MIME_TYPES:
        raise ValueError("Type MIME non autorise.")
    if browser_mime_type and browser_mime_type not in ALLOWED_DOCUMENT_MIME_TYPES:
        raise ValueError("Type MIME navigateur non autorise.")
    return {
        "file_type": extension.lstrip("."),
        "mime_type": mime_type,
        "size": size,
        "checksum": file_checksum(file_obj),
        "original_filename": original_filename,
    }


def log_document_activity(*, workspace, actor, action: str, document=None, folder=None, metadata: dict | None = None) -> DocumentActivity:
    payload = metadata or {}
    activity = DocumentActivity.objects.create(workspace=workspace, document=document, folder=folder, actor=actor, action=action, metadata=payload)
    AuditLog.objects.create(
        workspace=workspace,
        actor=actor,
        action=action,
        resource="document" if document else "document_folder",
        resource_id=str(document.id if document else folder.id if folder else ""),
        metadata=payload,
    )
    return activity


@transaction.atomic
def ensure_default_folders(workspace: Workspace, actor=None) -> list[DocumentFolder]:
    folders = []
    for name in ROOT_FOLDERS:
        folder, created = DocumentFolder.objects.get_or_create(workspace=workspace, parent=None, name=name, defaults={"created_by": actor})
        if created:
            log_document_activity(workspace=workspace, actor=actor, action=DocumentActivityAction.CREATED, folder=folder, metadata={"folder": name})
        folders.append(folder)
    return folders


def validate_workspace_links(workspace: Workspace, **links) -> None:
    for field, item in links.items():
        if item and item.workspace_id != workspace.id:
            raise ValueError(f"{field} appartient a un autre workspace.")


@transaction.atomic
def create_folder(*, workspace: Workspace, actor, **data) -> DocumentFolder:
    validate_workspace_links(workspace, parent=data.get("parent"))
    folder = DocumentFolder.objects.create(workspace=workspace, created_by=actor, **data)
    log_document_activity(workspace=workspace, actor=actor, action=DocumentActivityAction.CREATED, folder=folder)
    return folder


@transaction.atomic
def create_document(*, workspace: Workspace, actor, tags: list[str] | None = None, file=None, **data) -> Document:
    validate_workspace_links(
        workspace,
        folder=data.get("folder"),
        project=data.get("project"),
        event=data.get("event"),
        financial_transaction=data.get("financial_transaction"),
        payment=data.get("payment"),
        member=data.get("member"),
    )
    file_meta = validate_document_file(file) if file else {"file_type": data.get("file_type", "unknown"), "mime_type": data.get("mime_type", ""), "size": 0, "checksum": "", "original_filename": ""}
    document = Document.objects.create(workspace=workspace, uploaded_by=actor, file=file, **file_meta, **data)
    if tags:
        set_document_tags(document=document, tags=tags)
    if file:
        version = DocumentVersion.objects.create(workspace=workspace, document=document, version_number=1, file=file, uploaded_by=actor, change_note="Version initiale", **file_meta)
        document.current_version = version.version_number
        document.save(update_fields=["current_version", "updated_at"])
    log_document_activity(workspace=workspace, actor=actor, action=DocumentActivityAction.CREATED, document=document)
    return document


def set_document_tags(*, document: Document, tags: list[str]) -> None:
    tag_objects = []
    for name in tags:
        normalized = str(name).strip()[:80]
        if normalized:
            tag, _created = DocumentTag.objects.get_or_create(workspace=document.workspace, name=normalized)
            tag_objects.append(tag)
    document.tags.set(tag_objects)


@transaction.atomic
def update_document(*, document: Document, actor, tags: list[str] | None = None, **data) -> Document:
    document = Document.objects.select_for_update().get(id=document.id)
    validate_workspace_links(
        document.workspace,
        folder=data.get("folder"),
        project=data.get("project"),
        event=data.get("event"),
        financial_transaction=data.get("financial_transaction"),
        payment=data.get("payment"),
        member=data.get("member"),
    )
    for field, value in data.items():
        setattr(document, field, value)
    document.save()
    if tags is not None:
        set_document_tags(document=document, tags=tags)
    log_document_activity(workspace=document.workspace, actor=actor, action=DocumentActivityAction.UPDATED, document=document)
    return document


@transaction.atomic
def move_document(*, document: Document, actor, folder: DocumentFolder | None) -> Document:
    if folder and folder.workspace_id != document.workspace_id:
        raise ValueError("Le dossier cible appartient a un autre workspace.")
    previous = document.folder_id
    document.folder = folder
    document.save(update_fields=["folder", "updated_at"])
    log_document_activity(workspace=document.workspace, actor=actor, action=DocumentActivityAction.UPDATED, document=document, metadata={"from_folder": previous, "to_folder": folder.id if folder else None})
    return document


@transaction.atomic
def add_document_version(*, document: Document, actor, file, change_note: str = "") -> DocumentVersion:
    document = Document.objects.select_for_update().get(id=document.id)
    file_meta = validate_document_file(file)
    version_number = document.current_version + 1
    version = DocumentVersion.objects.create(workspace=document.workspace, document=document, version_number=version_number, file=file, uploaded_by=actor, change_note=change_note, **file_meta)
    for field, value in {**file_meta, "file": file, "current_version": version_number}.items():
        setattr(document, field, value)
    document.save(update_fields=["file", "file_type", "mime_type", "size", "checksum", "original_filename", "current_version", "updated_at"])
    log_document_activity(workspace=document.workspace, actor=actor, action=DocumentActivityAction.VERSION_CREATED, document=document, metadata={"version": version_number})
    return version


@transaction.atomic
def restore_document_version(*, document: Document, version: DocumentVersion, actor, change_note: str = "") -> DocumentVersion:
    document = Document.objects.select_for_update().get(id=document.id)
    if version.document_id != document.id:
        raise ValueError("Cette version n'appartient pas au document.")
    new_version_number = document.current_version + 1
    new_version = DocumentVersion.objects.create(
        workspace=document.workspace,
        document=document,
        version_number=new_version_number,
        file=version.file,
        original_filename=version.original_filename,
        file_type=version.file_type,
        mime_type=version.mime_type,
        size=version.size,
        checksum=version.checksum,
        change_note=change_note or f"Restauration de la version {version.version_number}",
        uploaded_by=actor,
        restored_from=version,
    )
    document.file = version.file
    document.original_filename = version.original_filename
    document.file_type = version.file_type
    document.mime_type = version.mime_type
    document.size = version.size
    document.checksum = version.checksum
    document.current_version = new_version_number
    document.save(update_fields=["file", "original_filename", "file_type", "mime_type", "size", "checksum", "current_version", "updated_at"])
    log_document_activity(workspace=document.workspace, actor=actor, action=DocumentActivityAction.VERSION_RESTORED, document=document, metadata={"from_version": version.version_number, "new_version": new_version_number})
    return new_version


@transaction.atomic
def archive_document(*, document: Document, actor) -> Document:
    document = Document.objects.select_for_update().get(id=document.id)
    document.mark_archived()
    document.save(update_fields=["status", "archived_at", "updated_at"])
    log_document_activity(workspace=document.workspace, actor=actor, action=DocumentActivityAction.ARCHIVED, document=document)
    return document


@transaction.atomic
def restore_document(*, document: Document, actor) -> Document:
    document = Document.objects.select_for_update().get(id=document.id)
    if document.status == DocumentStatus.TRASH:
        document.folder = document.previous_folder
        document.previous_folder = None
    document.status = DocumentStatus.ACTIVE
    document.archived_at = None
    document.deleted_at = None
    document.save(update_fields=["folder", "previous_folder", "status", "archived_at", "deleted_at", "updated_at"])
    log_document_activity(workspace=document.workspace, actor=actor, action=DocumentActivityAction.RESTORED, document=document)
    return document


@transaction.atomic
def trash_document(*, document: Document, actor) -> Document:
    document = Document.objects.select_for_update().get(id=document.id)
    document.previous_folder = document.folder
    document.status = DocumentStatus.TRASH
    document.deleted_at = timezone.now()
    document.save(update_fields=["previous_folder", "status", "deleted_at", "updated_at"])
    log_document_activity(workspace=document.workspace, actor=actor, action=DocumentActivityAction.DELETED, document=document)
    return document


@transaction.atomic
def permanently_delete_document(*, document: Document, actor) -> None:
    if document.financial_transaction_id:
        raise ValueError("Un document financier ne peut etre supprime definitivement que via la permission documents.permanent_delete.")
    log_document_activity(workspace=document.workspace, actor=actor, action=DocumentActivityAction.PERMANENTLY_DELETED, document=document)
    document.delete()


def visible_documents(workspace: Workspace, include_sensitive: bool = False):
    queryset = Document.objects.select_related("folder", "uploaded_by", "project", "event", "financial_transaction", "member").prefetch_related("tags").filter(workspace=workspace)
    if not include_sensitive:
        queryset = queryset.exclude(sensitivity=DocumentSensitivity.SENSITIVE)
    return queryset


def search_documents(*, workspace: Workspace, filters: dict, include_sensitive: bool = False):
    queryset = visible_documents(workspace, include_sensitive=include_sensitive)
    q = filters.get("q") or filters.get("search")
    if q:
        queryset = queryset.filter(Q(name__icontains=q) | Q(description__icontains=q) | Q(file_type__icontains=q) | Q(uploaded_by__email__icontains=q) | Q(folder__name__icontains=q) | Q(tags__name__icontains=q)).distinct()
    for key, field in {"category": "category", "folder": "folder_id", "type": "file_type", "author": "uploaded_by_id", "project": "project_id", "event": "event_id", "status": "status", "visibility": "visibility"}.items():
        if filters.get(key):
            queryset = queryset.filter(**{field: filters[key]})
    if filters.get("date_from"):
        queryset = queryset.filter(created_at__date__gte=filters["date_from"])
    if filters.get("date_to"):
        queryset = queryset.filter(created_at__date__lte=filters["date_to"])
    return queryset


def document_analytics(*, workspace: Workspace, include_sensitive: bool = False) -> dict:
    documents = visible_documents(workspace, include_sensitive=include_sensitive)
    active = documents.exclude(status__in=[DocumentStatus.ARCHIVED, DocumentStatus.TRASH])
    used = documents.aggregate(total=Sum("size"))["total"] or 0
    quota = int(getattr(settings, "DOCUMENT_STORAGE_QUOTA", 10 * 1024 * 1024 * 1024))
    categories = list(documents.values("category").annotate(count=Count("id"), size=Sum("size")).order_by("category"))
    by_type = list(documents.values("file_type").annotate(count=Count("id"), size=Sum("size")).order_by("file_type"))
    recent_cutoff = timezone.now() - timezone.timedelta(days=7)
    return {
        "total_documents": documents.count(),
        "active_documents": active.count(),
        "recent_documents": documents.filter(created_at__gte=recent_cutoff).count(),
        "shared_documents": documents.filter(Q(shares__isnull=False) | Q(share_links__is_active=True)).distinct().count(),
        "archived_documents": documents.filter(status=DocumentStatus.ARCHIVED).count(),
        "pending_documents": documents.filter(status=DocumentStatus.PENDING).count(),
        "favorite_documents": DocumentFavorite.objects.filter(workspace=workspace).count(),
        "sensitive_documents": Document.objects.filter(workspace=workspace, sensitivity=DocumentSensitivity.SENSITIVE).count(),
        "total_size": used,
        "storage_usage": {"used": used, "available": max(quota - used, 0), "quota": quota, "percentage": round((used / quota) * 100, 2) if quota else 0},
        "documents_by_category": categories,
        "documents_by_type": by_type,
        "recent_items": list(documents.order_by("-updated_at").values("id", "name", "file_type", "category", "status", "updated_at")[:8]),
        "approval_items": DocumentApproval.objects.filter(workspace=workspace, status=ApprovalStatus.PENDING).count(),
    }


def record_access(*, document: Document, actor, action: str) -> None:
    DocumentAccessLog.objects.create(workspace=document.workspace, document=document, actor=actor, action=action)
    log_document_activity(workspace=document.workspace, actor=actor, action=action, document=document)


def export_document_metadata_csv(*, workspace: Workspace) -> str:
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "name", "file_type", "category", "status", "visibility", "size", "created_at", "updated_at"])
    for document in Document.objects.filter(workspace=workspace).iterator():
        writer.writerow([document.id, document.name, document.file_type, document.category, document.status, document.visibility, document.size, document.created_at.isoformat(), document.updated_at.isoformat()])
    return output.getvalue()
