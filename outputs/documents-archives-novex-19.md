# NOVEX Prompt 19 - Documents & Archives

## Audit initial

Le projet disposait deja de `FileField` dans Finance, Payments, Projects et Events, d'un modele `Workspace`, d'un RBAC par `Permission`/`RolePermission`, d'un `AuditLog` global et de conventions API DRF paginees. Aucun module GED central n'existait encore.

## Architecture GED

Ajout de `apps.documents`, module transversal relie a Workspace, Project, Event, FinancialTransaction, Payment et Member. Les pieces jointes metier existantes ne sont pas remplacees.

## Models

Ajout de `Document`, `DocumentFolder`, `DocumentTag`, `DocumentVersion`, `DocumentShare`, `DocumentShareLink`, `DocumentFavorite`, `DocumentAccessLog`, `DocumentActivity` et `DocumentApproval`.

## Migrations

Migration initiale `backend/apps/documents/migrations/0001_initial.py`.

## Storage

Stockage base sur le mecanisme Django existant `FileField`. Les chemins sont generes cote serveur avec UUID.

## Upload

Validation backend: extension, MIME deduit, MIME navigateur, taille, nom, liens workspace.

## Folders

Dossiers racine idempotents: Administration, Finances, Membres, Cotisations, Projets, Evenements, Rapports, Juridique, Communication, Archives.

## Documents

CRUD pagine, filtres, recherche, statuts, visibilite, sensibilite, metadata, retention et liens metier.

## Versions

Historique non destructif avec restauration par creation d'une nouvelle version logique.

## Sharing

Partage vers membre, role ou equipe. Liens securises optionnels avec expiration, mot de passe futur et limite de telechargements.

## Permissions

RBAC attendu: `documents.view`, `documents.create`, `documents.update`, `documents.download`, `documents.share`, `documents.manage_versions`, `documents.archive`, `documents.restore`, `documents.delete`, `documents.permanent_delete`, `documents.manage_permissions`, `documents.approve`, `documents.export`.

## Archives

Archivage logique, conservation des versions, relations et audit.

## Trash

Suppression logique vers corbeille avec restauration du dossier precedent.

## Approvals

Workflow simple prepare: draft, pending, approved, rejected, approver, deadline, comment et level.

## Project integration

`Document.project` relie la GED aux projets.

## Event integration

`Document.event` relie la GED aux evenements.

## Finance integration

`Document.financial_transaction` permet d'ouvrir un justificatif depuis une depense et de retrouver la transaction depuis le document.

## Analytics

Endpoint `analytics` pour volumes, categories, types, stockage, recents, favoris, archives, sensibles et validations.

## Notifications

Les evenements metier sont normalises pour alimenter le futur systeme de notifications.

## Audit

Chaque action importante ecrit `DocumentActivity` et `AuditLog`.

## Security

Pas d'URL publique par defaut, endpoint download controle, validation de fichiers, protection path traversal, documents sensibles exclus des vues generales par defaut.

## Multi-tenancy

Tous les querysets et services filtrent ou valident le workspace.

## PWA

Pages Next responsive: documents, dashboard, upload mobile et detail.

## UX/UI

Ajout de KPI, onglets, dossiers, recherche, filtres, table, grille, upload zone, file d'attente, preview et panneaux detail.

## Performance

Pagination serveur DRF, indexes workspace/statut/categorie/dossier/type de lien et agregations SQL.

## Tests

Tests services pour dossiers idempotents, versioning, restauration, recherche, isolation workspace, corbeille, favoris, relations finance/projet et validation upload.

## Resultats des tests

- `python -m compileall backend` : OK.
- `python backend/manage.py check --settings=config.settings.test` : OK.
- `python backend/manage.py makemigrations --check --dry-run --settings=config.settings.test` : OK, aucun changement detecte.
- `python backend/manage.py migrate --settings=config.settings.test --noinput` : OK, migration `documents.0001_initial` appliquee.
- `pytest backend` : 1 passed, 7 skipped. Les tests Django de service sont skips car `pytest-django` n'est pas installe dans l'environnement local.
- `npm --workspace frontend run typecheck` : bloque, `tsc` n'est pas installe/reconnu localement.

## Fichiers crees

Voir commit Git du Prompt 19.

## Fichiers modifies

Configuration Django, API v1, service Workspace, frontend Documents et documentation.

## Problemes rencontres

Les dependances locales peuvent limiter certains checks (`pytest-django`, `tsc`) selon l'installation de l'environnement.

## Dette technique

Ajouter thumbnails, antivirus, OCR, signature electronique qualifiee, recherche plein texte et permissions fines par objet.

## Decisions techniques

Conserver `FileField`, eviter une duplication des modules existants, utiliser une GED centrale liee aux ressources metier.

## Prochaine etape

PROMPT 20 - Module Rapports & Analytics.
