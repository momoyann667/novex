# NOVEX - Prompt 10 - Module Evenements + Calendrier

Date : 2026-08-29

## 1. Audit du code existant

- Architecture Django/DRF multi-apps deja en place.
- Modules `members`, `projects`, `payments`, `contributions` disponibles.
- `Project` existe et peut etre reference par un evenement.
- Le module Finance complet n'existe pas encore.
- Le shell association contient deja une entree Evenements, enrichie avec metadonnees permission/plan.

## 2. Fichiers crees

- `backend/apps/events/__init__.py`
- `backend/apps/events/apps.py`
- `backend/apps/events/models.py`
- `backend/apps/events/serializers.py`
- `backend/apps/events/services.py`
- `backend/apps/events/statuses.py`
- `backend/apps/events/urls.py`
- `backend/apps/events/views.py`
- `backend/tests/test_event_services.py`
- `docs/events.md`
- `frontend/src/features/events/event-status.ts`
- `frontend/src/features/events/event-form.tsx`
- `frontend/src/features/events/events-view.tsx`
- `frontend/src/features/events/event-detail-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/events/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/events/[eventId]/page.tsx`

## 3. Fichiers modifies

- `backend/config/settings/base.py`
- `backend/apps/api/urls.py`
- `backend/apps/dashboard/services.py`
- `docs/api.md`
- `frontend/src/components/layout/association-shell.tsx`

## 4. Modeles Django

- `Event`
- `EventParticipant`
- `EventExpenseAllocation`
- `EventRevenueAllocation`
- `EventDocument`
- `EventActivity`

## 5. Migrations

Migrations non generees dans cet environnement. A generer avec `python backend/manage.py makemigrations events` apres installation complete des dependances.

## 6. Endpoints API

- `GET/POST /api/v1/events/`
- `GET/PATCH/DELETE /api/v1/events/:id/`
- `GET /api/v1/events/overview/`
- `GET /api/v1/events/calendar/?start=:date&end=:date`
- `GET /api/v1/events/:id/stats/`
- `GET/POST /api/v1/events/:id/participants/`
- `POST /api/v1/events/:id/rsvp/`
- `POST /api/v1/events/:id/attendance/`
- `GET/POST /api/v1/events/:id/expenses/`
- `GET/POST /api/v1/events/:id/revenues/`
- `GET/POST /api/v1/events/:id/documents/`
- `GET /api/v1/events/:id/activity/`
- `GET /api/v1/events/:id/report/`

## 7. Permissions

- `events.view`
- `events.create`
- `events.update`
- `events.delete`
- `events.manage_participants`
- `events.manage_attendance`
- `events.manage_budget`
- `events.manage_documents`
- `events.generate_reports`

Les permissions sont appliquees par action dans `EventViewSet`.

## 8. KPI

Workspace :

- evenements a venir ;
- evenements du mois ;
- termines ;
- annules ;
- participants prevus ;
- taux moyen de participation ;
- budget total ;
- depenses ;
- recettes.

Evenement :

- participants ;
- confirmes ;
- presents ;
- absents ;
- taux de presence ;
- budget ;
- depenses ;
- recettes ;
- restant ;
- resultat ;
- marge.

## 9. Integrations

- Projet associe via `Event.project`.
- Finance preparee via allocations depenses/recettes.
- Documents rattaches via `EventDocument`.
- Notifications et rappels prepares via `reminder_offsets` et Celery-ready.
- Calendrier global alimente par les evenements sur une periode.

## 10. Tests executes

- `python -m compileall backend`
- `python backend/manage.py check`
- `pytest backend`
- `npm run typecheck`

## 11. Resultats des tests

- Compile backend : OK.
- Django check : OK.
- Pytest : 1 passed, 4 skipped.
- Typecheck frontend : bloque, `tsc` absent car les dependances Node ne sont pas installees localement.

## 12. Problemes rencontres

- `pytest-django` n'est pas installe localement, donc les tests Django riches sont sautes.
- Le module Finance complet n'existe pas encore.
- La generation lourde de rapport et les notifications Celery restent a brancher.

## 13. Decisions techniques

- Les dates utilisent des `DateTimeField` timezone-aware.
- Le calendrier impose une fenetre `start/end` et accepte `YYYY-MM-DD` ou datetime ISO.
- La recurrence est stockee comme regle simple, sans generation massive d'occurrences.
- Le QR Code presence reste une extension documentee pour eviter une implementation fragile.

## 14. Ce qui reste a faire

- Generer les migrations.
- Installer les dependances et executer la suite Django complete.
- Brancher les pages Next aux endpoints avec TanStack Query.
- Ajouter les vraies integrations Finance `Expense` et `Revenue`.
- Ajouter les workers Celery notifications/rapports.
- Ajouter les tests frontend.

## 15. Prochaine etape recommandee

Installer les dependances backend/frontend, generer les migrations, puis connecter les formulaires et listes Evenements aux endpoints REST.
