# NOVEX - Prompt 09 - Module Projets

Date : 2026-08-29

## Fichiers crees

- `backend/apps/projects/__init__.py`
- `backend/apps/projects/apps.py`
- `backend/apps/projects/models.py`
- `backend/apps/projects/serializers.py`
- `backend/apps/projects/services.py`
- `backend/apps/projects/statuses.py`
- `backend/apps/projects/urls.py`
- `backend/apps/projects/views.py`
- `backend/tests/test_project_services.py`
- `docs/projects.md`
- `frontend/src/features/projects/project-status.ts`
- `frontend/src/features/projects/project-form.tsx`
- `frontend/src/features/projects/projects-view.tsx`
- `frontend/src/features/projects/project-detail-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/projects/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/projects/[projectId]/page.tsx`

## Fichiers modifies

- `backend/config/settings/base.py`
- `backend/apps/api/urls.py`
- `backend/apps/dashboard/services.py`
- `docs/api.md`
- `frontend/src/components/layout/association-shell.tsx`

## Modeles crees

- `Project`
- `ProjectBudgetCategory`
- `ProjectExpenseAllocation`
- `ProjectDocument`
- `ProjectActivity`

## Endpoints

- `GET /api/v1/projects/`
- `POST /api/v1/projects/`
- `GET /api/v1/projects/:id/`
- `PATCH /api/v1/projects/:id/`
- `DELETE /api/v1/projects/:id/`
- `GET /api/v1/projects/stats/`
- `GET/POST /api/v1/projects/:id/budget-categories/`
- `GET/POST /api/v1/projects/:id/expenses/`
- `GET/POST /api/v1/projects/:id/documents/`
- `GET /api/v1/projects/:id/activity/`
- `GET /api/v1/projects/:id/reports/`

## Permissions

- `projects.view`
- `projects.create`
- `projects.update`
- `projects.delete`
- `projects.manage_budget`
- `projects.manage_documents`
- `projects.view_reports`

Ces permissions sont mappees par action dans `ProjectViewSet`.

Le menu frontend contient maintenant les metadonnees `permission` et `plan` pour l'entree Projets. Le filtrage visuel final devra etre branche au contexte session/abonnement quand celui-ci sera disponible cote frontend.

## KPI

- total projets
- projets actifs
- projets termines
- projets en retard
- budget total
- depenses totales
- budget restant
- avancement moyen

Le dashboard global NOVEX utilise maintenant les vrais compteurs Projets.

## Tests

Tests ajoutes :

- creation projet ;
- modification et changement de statut ;
- calcul budget ;
- association depense/projet via allocation ;
- isolation workspace ;
- responsable hors workspace ;
- progression invalide.

Verification executee :

- `python -m compileall backend`
- `python backend/manage.py check`
- `pytest backend` : 1 passed, 3 skipped.

Les tests Django ajoutes sont sautes localement car `pytest-django` n'est pas installe dans l'environnement Python actif.

## Problemes rencontres

- Le module Finance complet n'existe pas encore. L'integration depenses est donc preparee via `ProjectExpenseAllocation`, qui servira de liaison vers le futur modele `Expense` sans creer une comptabilite parallele.
- Les migrations Django ne sont pas generees dans cet environnement.
- Le typecheck frontend depend de l'installation des dependances Node.

## Prochaine etape recommandee

Installer les dependances de developpement, generer les migrations Django, puis connecter les pages Projets aux endpoints avec TanStack Query et formulaires de creation/modification persistants.
