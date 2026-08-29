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
