# NOVEX - Prompt 17 - Module projets operationnel complet

## Audit du code existant

Le module projets existait deja avec `Project`, categories budgetaires, allocations, documents et activite. Les modules Workspace, Member, Finance, Budgets, Events et AuditLog etaient disponibles; le developpement les reutilise sans recreer de systeme parallele.

## Architecture du module Projects

Extension de `apps.projects` autour d'un projet operationnel relie a equipe, taches, objectifs, milestones, budget, finances, documents, evenements, commentaires, activite, analytics, risques et rapports.

## Models crees/modifies

`Project` est enrichi avec code, owner, parent, devise, visibilite, mode de progression et cloture. Ajouts: `ProjectMember`, `ProjectObjective`, `ProjectMilestone`, `ProjectTask`, `ProjectComment`, `ProjectAlert`.

## Migrations

Ajout de `backend/apps/projects/migrations/0001_initial.py` avec indexes workspace/status/owner/dates/project/assignee/due_date et contraintes d'unicite.

## Relations

Projet vers membres, finances, budgets projet, documents, evenements existants, taches, objectifs, milestones, commentaires et activites.

## API

Endpoints CRUD, transitions activate/pause/complete/archive, members, tasks, objectives, milestones, comments, activity, analytics, report et export.

## Services

Services metier pour generation `PRJ-YYYY-NNN`, transitions, equipe, taches, dependances, objectifs, milestones, commentaires, analytics, risque et rapport.

## Taches

Statuts TODO, IN_PROGRESS, BLOCKED, DONE, CANCELLED; completion auditee; detection du retard; dependances avec protection contre cycles.

## Milestones

Statuts PENDING, IN_PROGRESS, COMPLETED, DELAYED; completion datee; prise en compte dans progression et risque.

## Objectifs

Objectifs mesurables avec target/current/unit et progression protegee contre division par zero.

## Budgets

Connexion au module Budgets via budgets de scope PROJECT et consolidation dans analytics projet.

## Finance

Les depenses projet proviennent de `FinancialTransaction.project` validees, completees par les allocations historiques existantes.

## Documents

Le modele `ProjectDocument` existant reste utilise; pas de nouveau stockage cree.

## Evenements

Les evenements conservent leur FK `project` et alimentent la vision projet.

## Notifications

Alertes preparees: task_overdue, deadline_near, budget_near_limit, budget_exceeded, milestone_delayed.

## Analytics

Progress, budget, actual_expense, remaining_budget, funding_received, project_balance, task_count, completed_tasks, overdue_tasks, milestones, objectives et risques.

## Risk Engine

Score non IA base sur retard, budget, taches bloquees et milestones en retard avec niveaux LOW, MEDIUM, HIGH, CRITICAL.

## RBAC

Actions protegees par les permissions `projects.*`. Aucun role global supplementaire n'est cree.

## AuditLog

Journalisation des creations, mises a jour, transitions, membres, taches, objectifs, milestones, commentaires, depenses et alertes.

## Multi-tenancy

Les requetes filtrent par membership actif et `X-Workspace`; les services verifient les relations workspace.

## PWA

Pages Next.js integrees au shell existant: dashboard, creation, detail, tasks et report, avec priorisation mobile des KPI et actions rapides.

## UX/UI

Dashboard data-driven, KPI, portfolio, risques, cards projet, detail operationnel, kanban, rapport et actions.

## Performance

Indexes ajoutes et usage de `select_related`, `prefetch_related`, `aggregate`, `Count` et `Sum` dans les services.

## Tests

Tests ajoutes pour codes, statuts, equipe, objectifs, taches, dependances circulaires, finance+budget, risque, workspace et validations serializer.

## Resultats des tests

- `python -m compileall backend`: OK
- `python backend/manage.py check --settings=config.settings.test`: OK
- `python backend/manage.py makemigrations --check --dry-run --settings=config.settings.test`: OK
- `python backend/manage.py migrate --settings=config.settings.test --noinput`: OK
- `pytest backend`: 1 passed, 6 skipped (`pytest-django` absent localement)
- `npm --workspace frontend run typecheck`: bloque car `tsc` n'est pas installe dans `frontend/node_modules`

## Fichiers crees

- `backend/apps/projects/migrations/0001_initial.py`
- `frontend/src/features/projects/project-new-view.tsx`
- `frontend/src/features/projects/project-tasks-view.tsx`
- `frontend/src/features/projects/project-report-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/projects/new/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/projects/[projectId]/tasks/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/projects/[projectId]/report/page.tsx`

## Fichiers modifies

- `backend/apps/projects/models.py`
- `backend/apps/projects/statuses.py`
- `backend/apps/projects/services.py`
- `backend/apps/projects/serializers.py`
- `backend/apps/projects/views.py`
- `backend/tests/test_project_services.py`
- `docs/api.md`
- `docs/projects.md`
- `frontend/src/features/projects/projects-view.tsx`
- `frontend/src/features/projects/project-detail-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/projects/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/projects/[projectId]/page.tsx`

## Problemes rencontres

L'environnement local ne dispose pas de `pytest-django` ni de `tsc`, ce qui limite l'execution effective des tests Django et du typecheck frontend.

## Dette technique

Les exports rapport retournent une structure prete et un statut `queued`; la generation PDF/XLSX professionnelle doit etre branchee sur Celery et le moteur documentaire.

## Decisions techniques

Conserver le champ existant `budget` comme budget previsionnel pour compatibilite, expose aussi sous `planned_budget`. L'avancement automatique combine taches, objectifs et milestones, avec mode manuel documente par `progress_mode`.

## Prochaine etape

Prompt 18: module Evenements avec creation, planification, inscriptions, participants, budget, recettes, depenses, billetterie/cotisations eventuelles, presences et rapport d'evenement.
