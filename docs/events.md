# Module Evenements et Calendrier

Le module Evenements gere les evenements d'un workspace et alimente le calendrier NOVEX.

## Architecture

- `Event` : fiche evenement, type, statut, dates timezone-aware, lieu, responsable, capacite, budget, recurrence, projet associe.
- `EventParticipant` : participant rattache a un membre, RSVP et presence.
- `EventExpenseAllocation` : liaison vers une depense Finance future.
- `EventRevenueAllocation` : liaison vers une recette Finance future.
- `EventDocument` : documents rattaches a l'evenement.
- `EventActivity` : journal d'activite evenement.

## Calendrier

Le calendrier consomme `GET /api/v1/events/calendar/?start=:date&end=:date`. Les bornes acceptent `YYYY-MM-DD` ou un datetime ISO.

Il charge uniquement la periode demandee, jamais tout l'historique du workspace. Les indexes `workspace + start_at/end_at` sont prevus pour PostgreSQL.

## Types et statuts

Les valeurs sont centralisees dans `apps.events.statuses`.

Types :

- `MEETING`
- `GENERAL_ASSEMBLY`
- `TRAINING`
- `CONFERENCE`
- `CEREMONY`
- `FUNDRAISING`
- `COMMUNITY`
- `SPORT`
- `CULTURAL`
- `OTHER`

Statuts :

- `DRAFT`
- `PLANNED`
- `ONGOING`
- `COMPLETED`
- `CANCELLED`
- `POSTPONED`

## Permissions

- `events.view`
- `events.create`
- `events.update`
- `events.delete`
- `events.manage_participants`
- `events.manage_attendance`
- `events.manage_budget`
- `events.manage_documents`
- `events.generate_reports`

## Finance

Le module ne cree pas un systeme financier parallele. Les allocations `EventExpenseAllocation` et `EventRevenueAllocation` preparent le lien vers les futurs modeles Finance `Expense` et `Revenue`.

## Notifications

Les rappels sont representes par `reminder_offsets` en minutes. Les valeurs par defaut sont centralisees et pretes pour Celery.

## QR Code

La presence par QR Code est documentee comme extension future. Aucun scan fragile n'est implemente tant que l'identite membre, les tokens et la verification publique ne sont pas finalises.
# Module evenements

Le module evenements gere informations, planning, organisateurs, participants, inscriptions, presences, tickets, budget, recettes, depenses, documents, projet associe, communications, feedback et rapport.

## Architecture

- `Event`: code serveur `EVT-YYYY-NNN`, type, statut, visibilite, timezone, lieu, inscription, owner, projet et budget.
- `EventParticipant`: membre existant ou participant externe prepare, statut, QR et presence.
- `EventOrganizer`: equipe organisatrice avec roles locaux.
- `EventTicketType`, `TicketOrder`, `EventTicket`: billetterie prete pour Payments, QR ticket et check-in anti-double scan.
- `EventSponsor`: sponsors et contributions preparees pour Finance.
- `EventScheduleItem`, `EventSpeaker`: programme et intervenants.
- `EventFeedback`: note, satisfaction et commentaire.
- `EventAnnouncement`: annonces in-app/email/WhatsApp/SMS selon integrations disponibles.

## Finance, budgets et projets

Les recettes et depenses evenement sont lues depuis `FinancialTransaction.event` et les allocations historiques. Les budgets evenement restent portes par `apps.budgets` via `Budget.scope_type=EVENT`. Les evenements restent lies a `Project` par la FK existante.

## Calculs

- Presence: presents / confirmes, avec zero protege.
- Remplissage: inscrits / capacite, avec capacite nulle protegee.
- Finance: recettes, depenses, resultat, budget restant et taux de consommation.
- Rapport: resume, participants, presence, programme, budget, resultats, documents et satisfaction.

## Securite

Toutes les vues passent par `RequireWorkspacePermission` et filtrent via `X-Workspace` + membership actif. Les liens membre/projet/ressource verifient le workspace.
