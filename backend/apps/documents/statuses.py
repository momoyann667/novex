from django.db import models


class DocumentCategory(models.TextChoices):
    ADMINISTRATIVE = "administrative", "Administratif"
    FINANCIAL = "financial", "Financier"
    MEMBERS = "members", "Membres"
    CONTRIBUTIONS = "contributions", "Cotisations"
    PROJECT = "project", "Projet"
    EVENT = "event", "Evenement"
    LEGAL = "legal", "Juridique"
    REPORT = "report", "Rapport"
    COMMUNICATION = "communication", "Communication"
    OTHER = "other", "Autre"


class DocumentStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    PENDING = "pending", "En attente"
    ACTIVE = "active", "Actif"
    APPROVED = "approved", "Approuve"
    REJECTED = "rejected", "Rejete"
    ARCHIVED = "archived", "Archive"
    TRASH = "trash", "Corbeille"


class DocumentVisibility(models.TextChoices):
    PRIVATE = "private", "Prive"
    MEMBERS = "members", "Membres"
    TEAM = "team", "Equipe"
    WORKSPACE = "workspace", "Workspace"
    SHARED = "shared", "Partage"


class DocumentSensitivity(models.TextChoices):
    NORMAL = "normal", "Normal"
    SENSITIVE = "sensitive", "Sensible"


class ShareSubjectType(models.TextChoices):
    MEMBER = "member", "Membre"
    ROLE = "role", "Role"
    TEAM = "team", "Equipe"


class DocumentActivityAction(models.TextChoices):
    CREATED = "document.created", "Document cree"
    UPDATED = "document.updated", "Document modifie"
    DOWNLOADED = "document.downloaded", "Document telecharge"
    SHARED = "document.shared", "Document partage"
    UNSHARED = "document.unshared", "Document de-partage"
    ARCHIVED = "document.archived", "Document archive"
    RESTORED = "document.restored", "Document restaure"
    DELETED = "document.deleted", "Document supprime"
    PERMANENTLY_DELETED = "document.permanently_deleted", "Document supprime definitivement"
    VERSION_CREATED = "document.version_created", "Version creee"
    VERSION_RESTORED = "document.version_restored", "Version restauree"
    APPROVED = "document.approved", "Document approuve"
    REJECTED = "document.rejected", "Document rejete"


class ApprovalStatus(models.TextChoices):
    DRAFT = "draft", "Brouillon"
    PENDING = "pending", "En attente"
    APPROVED = "approved", "Approuve"
    REJECTED = "rejected", "Rejete"
