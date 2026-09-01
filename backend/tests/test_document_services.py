import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone

pytest.importorskip("pytest_django")

from apps.documents.models import Document, DocumentFavorite
from apps.documents.services import (
    add_document_version,
    archive_document,
    create_document,
    ensure_default_folders,
    restore_document,
    restore_document_version,
    search_documents,
    trash_document,
    validate_document_file,
)
from apps.documents.statuses import DocumentCategory, DocumentStatus
from apps.finance.models import FinancialCategory, FinancialTransaction
from apps.finance.statuses import FinancialCategoryKind, FinancialTransactionType
from apps.projects.models import Project
from apps.workspaces.models import Role, Workspace, WorkspaceMembership
from apps.users.models import User


@pytest.fixture
def owner(db):
    return User.objects.create_user(username="owner", email="owner@example.com", password="secret")


@pytest.fixture
def workspace(owner):
    role = Role.objects.create(code="OWNER", label="Owner", is_system=True)
    workspace = Workspace.objects.create(name="Association A", slug="assoc-a", organization_type=Workspace.OrganizationType.ASSOCIATION, owner=owner)
    WorkspaceMembership.objects.create(workspace=workspace, user=owner, role=role, status=WorkspaceMembership.Status.ACTIVE)
    return workspace


def upload(name="pv.pdf", content=b"%PDF-1.4", content_type="application/pdf"):
    return SimpleUploadedFile(name, content, content_type=content_type)


@pytest.mark.django_db
def test_default_folders_are_idempotent(workspace, owner):
    first = ensure_default_folders(workspace, actor=owner)
    second = ensure_default_folders(workspace, actor=owner)

    assert len(first) == 10
    assert len(second) == 10
    assert workspace.document_folders.count() == 10


@pytest.mark.django_db
def test_document_versioning_and_restore_preserves_history(workspace, owner):
    document = create_document(workspace=workspace, actor=owner, name="PV AG", category=DocumentCategory.ADMINISTRATIVE, file=upload("pv-v1.pdf"))
    add_document_version(document=document, actor=owner, file=upload("pv-v2.pdf", b"%PDF-2"), change_note="Corrections")
    version_one = document.versions.get(version_number=1)
    restored = restore_document_version(document=document, version=version_one, actor=owner)

    document.refresh_from_db()
    assert document.current_version == 3
    assert restored.restored_from_id == version_one.id
    assert document.versions.count() == 3


@pytest.mark.django_db
def test_search_and_workspace_isolation(workspace, owner):
    other_owner = User.objects.create_user(username="other", email="other@example.com", password="secret")
    other = Workspace.objects.create(name="Association B", slug="assoc-b", organization_type=Workspace.OrganizationType.ASSOCIATION, owner=other_owner)
    create_document(workspace=workspace, actor=owner, name="Facture ciment", category=DocumentCategory.FINANCIAL, file=upload("facture.pdf"))
    create_document(workspace=other, actor=other_owner, name="Facture cachee", category=DocumentCategory.FINANCIAL, file=upload("hidden.pdf"))

    results = search_documents(workspace=workspace, filters={"q": "Facture"})

    assert list(results.values_list("name", flat=True)) == ["Facture ciment"]


@pytest.mark.django_db
def test_trash_archive_restore_and_favorite(workspace, owner):
    folder = ensure_default_folders(workspace, actor=owner)[0]
    document = create_document(workspace=workspace, actor=owner, name="Contrat", folder=folder, file=upload("contrat.pdf"))

    archive_document(document=document, actor=owner)
    document.refresh_from_db()
    assert document.status == DocumentStatus.ARCHIVED

    trash_document(document=document, actor=owner)
    document.refresh_from_db()
    assert document.status == DocumentStatus.TRASH
    assert document.previous_folder_id == folder.id

    restore_document(document=document, actor=owner)
    document.refresh_from_db()
    DocumentFavorite.objects.create(workspace=workspace, document=document, user=owner)
    assert document.status == DocumentStatus.ACTIVE
    assert document.folder_id == folder.id
    assert document.favorites.count() == 1


@pytest.mark.django_db
def test_financial_project_relations_are_workspace_checked(workspace, owner):
    category = FinancialCategory.objects.create(workspace=workspace, kind=FinancialCategoryKind.EXPENSE_CATEGORY, name="Materiel")
    transaction = FinancialTransaction.objects.create(
        workspace=workspace,
        transaction_type=FinancialTransactionType.EXPENSE,
        amount=350000,
        category=category,
        description="Ciment",
        reference="EXP-001",
    )
    project = Project.objects.create(workspace=workspace, name="Centre communautaire", owner=None)

    document = create_document(workspace=workspace, actor=owner, name="Facture ciment", category=DocumentCategory.FINANCIAL, financial_transaction=transaction, project=project, file=upload("facture.pdf"))

    assert document.financial_transaction_id == transaction.id
    assert transaction.ged_documents.get().id == document.id
    assert project.ged_documents.get().id == document.id


def test_upload_validation_blocks_dangerous_names():
    with pytest.raises(ValueError):
        validate_document_file(upload("../payload.exe", b"bad", "application/octet-stream"))


def test_upload_validation_blocks_mime_mismatch():
    with pytest.raises(ValueError):
        validate_document_file(upload("scan.pdf", b"bad", "application/octet-stream"))
