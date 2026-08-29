# Module Cotisations

Le module Cotisations est le socle metier du recouvrement membre dans NOVEX.

## Architecture

- `ContributionCampaign` definit une campagne de cotisation.
- `Contribution` represente l'obligation individuelle d'un membre.
- `ContributionCategoryAmount` permet des montants differencies par categorie.
- `ReminderRule` prepare les relances.
- `Payment` reste l'abstraction de paiement existante pour les paiements manuels.

## Types et periodicites

Les valeurs sont centralisees dans `apps.contributions.statuses`.

Types :

- `MEMBERSHIP`
- `MONTHLY`
- `QUARTERLY`
- `YEARLY`
- `SPECIAL`
- `EVENT`
- `PROJECT`
- `OTHER`

Periodicites :

- `ONE_TIME`
- `MONTHLY`
- `QUARTERLY`
- `YEARLY`
- `CUSTOM`

## Statuts

- `PENDING`
- `PARTIALLY_PAID`
- `PAID`
- `OVERDUE`
- `CANCELLED`
- `WAIVED`

## Ciblage

Une campagne peut viser :

- tous les membres actifs ;
- une categorie ;
- une selection de membres ;
- un segment stocke en JSON pour extension future.

## Finance

Tous les montants sont stockes en `DecimalField`. Le reste a payer est calcule :

```text
amount_due - amount_paid - waived_amount
```

Les paiements manuels passent par `Payment` avec provider `manual`, idempotency key et metadata de justificatif.

## Audit

Actions journalisees :

- `contribution_campaign.created`
- `contribution_campaign.updated`
- `contribution_campaign.activated`
- `contribution_campaign.cancelled`
- `contributions.generated`
- `contribution.updated`
- `contribution.cancelled`
- `contribution.waived`
- `contribution.manual_payment_added`
- `contribution.status_changed`

## API

- `GET/POST /api/v1/contributions/`
- `GET/PATCH/DELETE /api/v1/contributions/:id/`
- `GET /api/v1/contributions/dashboard/`
- `POST /api/v1/contributions/:id/payments/`
- `POST /api/v1/contributions/:id/waive/`
- `POST /api/v1/contributions/:id/cancel/`
- `GET/POST /api/v1/contributions/campaigns/`
- `POST /api/v1/contributions/campaigns/:id/activate/`
- `POST /api/v1/contributions/campaigns/:id/generate/`

## Multi-tenancy

Tous les querysets filtrent par `X-Workspace`, membership actif et `workspace_id`. Les relations `campaign`, `member`, `target_category` et `target_members` sont limitees au workspace courant dans les serializers.
