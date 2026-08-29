# NOVEX - Prompt 11 - Module Cotisations, socle metier complet

Date : 2026-08-29

## Architecture

Le module Cotisations existant a ete enrichi sans creer de module parallele. Il couvre maintenant campagne, ciblage, obligations individuelles, paiements partiels manuels, exonération, KPI, audit et historique via `Payment`.

## Models

Modeles modifies :

- `ContributionCampaign`
- `Contribution`

Ajouts principaux :

- types de cotisations ;
- periodicites ;
- modes de ciblage ;
- description campagne ;
- membres cibles ;
- segment cible JSON ;
- `waived_amount` ;
- `paid_at` ;
- `waived_at` ;
- `waiver_reason` ;
- indexes `workspace/campaign/status/due_date/created_at`.

Nouveau fichier de constantes :

- `backend/apps/contributions/statuses.py`

## Migrations

Migration generee :

```text
backend/apps/contributions/migrations/0001_initial.py
```

Django a signale que PostgreSQL local n'etait pas accessible pour verifier l'historique de migration, mais le fichier a bien ete cree.

## API

Endpoints ajoutes ou enrichis :

- `GET/POST /api/v1/contributions/`
- `GET/PATCH/DELETE /api/v1/contributions/:id/`
- `GET /api/v1/contributions/dashboard/`
- `GET /api/v1/contributions/:id/stats/`
- `POST /api/v1/contributions/:id/cancel/`
- `POST /api/v1/contributions/:id/waive/`
- `GET/POST /api/v1/contributions/:id/payments/`
- `GET/POST /api/v1/contributions/campaigns/`
- `PATCH /api/v1/contributions/campaigns/:id/`
- `POST /api/v1/contributions/campaigns/:id/activate/`
- `POST /api/v1/contributions/campaigns/:id/cancel/`
- `POST /api/v1/contributions/campaigns/:id/generate/`
- `GET /api/v1/contributions/campaigns/:id/members/`
- `GET /api/v1/contributions/campaigns/:id/stats/`

## Frontend

Pages et composants :

- `frontend/src/features/contributions/contribution-status.ts`
- `frontend/src/features/contributions/contribution-campaign-form.tsx`
- `frontend/src/features/contributions/contributions-view.tsx`
- `frontend/src/features/contributions/contribution-detail-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/contributions/[contributionId]/page.tsx`
- section Cotisations enrichie dans la fiche membre.

## Permissions

Permissions appliquees cote backend :

- `contributions.view`
- `contributions.create`
- `contributions.update`
- `contributions.cancel`
- `contributions.manage`
- `contributions.record_payment`
- `contributions.waive`
- `contributions.view_reports`

## KPI

Endpoint `GET /api/v1/contributions/dashboard/` :

- `total_expected`
- `total_collected`
- `total_remaining`
- `collection_rate`
- `members_paid`
- `members_partial`
- `members_overdue`
- `members_unpaid`
- `waived`
- `active_campaigns`
- `upcoming_due`

## Finance

Calcul fiable en `Decimal` :

```text
remaining = amount_due - amount_paid - waived_amount
```

Les paiements manuels de cotisation utilisent l'abstraction `Payment` existante avec :

- provider `manual` ;
- idempotency key ;
- `payment_method` ;
- metadata `document_reference`.

## Multi-tenancy

Protection assuree par :

- filtrage queryset sur `workspace__slug` et membership actif ;
- `workspace_id` present sur campagnes et contributions ;
- serializers limitant `campaign`, `member`, `target_category`, `target_members` au workspace courant ;
- contraintes uniques par campagne/membre.

## Tests

Tests ajoutes ou enrichis :

- generation de contributions ;
- paiement manuel idempotent ;
- paiements partiels ;
- paiement complet ;
- calcul exact `25 000`, `10 000`, `15 000` ;
- calcul exact `100 000 - 33 333 = 66 667` ;
- exonération et audit log.

Resultats locaux :

- `python -m compileall backend` : OK ;
- `python backend/manage.py check` : OK ;
- `pytest backend` : 1 passed, 4 skipped.
- `python backend/manage.py makemigrations contributions` : migration creee, avertissement connexion PostgreSQL locale.

Les tests Django riches sont sautes localement parce que `pytest-django` n'est pas installe dans l'environnement Python actif.

## Problemes

- Pas de module Finance complet encore disponible.
- Pas de systeme Notifications complet encore disponible.
- Typecheck frontend bloque tant que les dependances Node ne sont pas installees.
- PostgreSQL local refuse la connexion `novex`, donc l'application effective de la migration n'a pas ete testee.

## Prochaine etape

Prompt 12 doit construire le module Paiements hors ligne et en ligne autour de l'abstraction `Payment` existante : providers, Mobile Money/carte, webhooks signes, reconciliation, recus PDF/QR, et statuts de paiement serveur-first.
