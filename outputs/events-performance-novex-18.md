# NOVEX - Prompt 18 - Module evenements, participants, budget & performance

## Audit initial

Le module Events existait avec evenement, participants simples, allocations recettes/depenses, documents, calendrier et activite. Les modules Workspace, Member, Project, Finance, Budgets, Payments et AuditLog sont reutilises.

## Architecture Events

Extension de `apps.events` pour couvrir planification, organisateurs, inscriptions, waitlist, attendance, QR, tickets, sponsors, programme, intervenants, feedback, annonces, analytics et rapports.

## Models

`Event` enrichi avec code, visibilite, timezone, type de lieu, adresse, online URL, inscription, deadline et owner. Ajouts: `ExternalParticipant`, `EventOrganizer`, `EventTicketType`, `TicketOrder`, `EventTicket`, `EventSponsor`, `EventScheduleItem`, `EventSpeaker`, `EventFeedback`, `EventAnnouncement`.

## Migrations

Ajout de `backend/apps/events/migrations/0001_initial.py` avec indexes workspace/date/statut/type/owner/project/participants/tickets.

## Participants

Participants lies aux membres existants, avec preparation participant externe, formulaire `registration_data`, statut et QR.

## Inscriptions

`register` verifie workspace, deadline et capacite. Si l'evenement est complet, le participant passe en `WAITLISTED`.

## Attendance

Check-in QR ou manuel, presence/absence auditee, taux de presence protege contre division par zero.

## QR / Tickets

QR participant `NOVEX EVENT`, tickets `NVX-TKT-*`, validation par `select_for_update` pour empecher la double utilisation.

## Payments

`TicketOrder` reference le modele `Payment`; le moteur de paiement existant reste la source d'encaissement.

## Finance

Recettes et depenses evenement consolidees depuis `FinancialTransaction.event` et allocations historiques.

## Budget

Budget evenement conserve dans `Event.budget` pour compatibilite et compatible avec `Budget.scope_type=EVENT`.

## Projects

Lien projet reutilise via `Event.project`.

## Documents

`EventDocument` reste le stockage evenement; pas de duplication GED.

## Notifications

Annonces et rappels prepares: invitation, inscription, rappel, changement horaire/lieu, annulation, ticket disponible.

## Calendar

Endpoint calendrier global `events/calendar` conserve et enrichi par les nouveaux statuts/types.

## Analytics

Participants, inscrits, confirmes, waitlist, presents, absents, taux de presence, capacite, remplissage, budget, depenses, recettes, resultat, satisfaction.

## Reports

Rapport evenement pret pour PDF/XLSX avec resume, participants, presence, programme, finance, documents, feedback et observations.

## RBAC

Permissions utilisees: events.view, create, update, cancel, manage_participants, manage_attendance, manage_tickets, manage_budget, manage_finance, manage_documents, manage_team, manage_feedback, export.

## AuditLog

Actions auditees: creation, update, cancellation, completion, participant registered/cancelled, checkin/checkout, ticket created/validated, organizer, expense/revenue, documents.

## Securite

Pas de `workspace_id` frontend comme source de verite. Les vues filtrent par `X-Workspace` et membership actif, les services valident les relations.

## Multi-tenancy

Les ressources evenement, tickets, participants, documents, finances, budgets et reports restent scopees par workspace.

## PWA

Pages Next.js ajoutees pour dashboard, creation, detail, check-in mobile et rapport.

## UX/UI

Dashboard data-dense avec KPI, calendrier, liste administrative, alertes, charts, detail, QR/check-in et rapport.

## Performance

Aggregations serveur, indexes, pagination DRF globale et filtrage serveur. Les listes massives ne sont pas chargees en un seul bloc cote frontend.

## Tests

Tests enrichis pour creation, annulation, dates, participants, waitlist, presence, tickets, finances et multi-tenant.

## Resultats des tests

- `python -m compileall backend`: OK
- `python backend/manage.py check --settings=config.settings.test`: OK
- `python backend/manage.py makemigrations --check --dry-run --settings=config.settings.test`: OK
- `python backend/manage.py migrate --settings=config.settings.test --noinput`: OK
- `pytest backend`: 1 passed, 6 skipped (`pytest-django` absent localement)
- `npm --workspace frontend run typecheck`: bloque car `tsc` n'est pas installe dans `frontend/node_modules`

## Fichiers crees

- `backend/apps/events/migrations/0001_initial.py`
- `frontend/src/features/events/event-new-view.tsx`
- `frontend/src/features/events/event-attendance-view.tsx`
- `frontend/src/features/events/event-report-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/events/new/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/events/[eventId]/attendance/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/events/[eventId]/report/page.tsx`

## Fichiers modifies

- `backend/apps/events/models.py`
- `backend/apps/events/statuses.py`
- `backend/apps/events/services.py`
- `backend/apps/events/serializers.py`
- `backend/apps/events/views.py`
- `backend/tests/test_event_services.py`
- `docs/api.md`
- `docs/events.md`
- `frontend/src/features/events/*`
- `frontend/src/app/(workspace)/app/[workspace]/events/*`

## Problemes rencontres

L'environnement local garde les memes limites: `pytest-django` absent et `tsc` absent dans `frontend/node_modules`.

## Dette technique

Generation QR bitmap, paiement ticket complet, exports PDF/XLSX et offline check-in doivent etre branches aux integrations dediees lors des prompts suivants.

## Decisions techniques

Conserver `title/start_at/end_at` pour compatibilite tout en exposant les alias metier. Les tickets et participants utilisent des QR textuels stables, prets pour generation graphique.

## Prochaine etape

Prompt 19: module Documents & Archives, GED associative complete.
