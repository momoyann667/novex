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
- `GET /api/v1/contributions/analytics/`
- `GET /api/v1/contributions/overdue/`
- `GET /api/v1/contributions/upcoming/`
- `GET /api/v1/contributions/members-summary/`
- `GET/PATCH /api/v1/contributions/recovery/`
- `POST /api/v1/contributions/bulk-reminder-preview/`
- `POST /api/v1/contributions/:id/payments/`
- `GET /api/v1/contributions/:id/reminder-preview/`
- `POST /api/v1/contributions/:id/send-reminder/`
- `POST /api/v1/contributions/:id/waive/`
- `POST /api/v1/contributions/:id/cancel/`
- `GET/POST /api/v1/contributions/campaigns/`
- `POST /api/v1/contributions/campaigns/:id/activate/`
- `POST /api/v1/contributions/campaigns/:id/generate/`
- `GET /api/v1/contributions/reminder-history/`
- `GET/POST /api/v1/contributions/exports/`

## Suivi avance

`contribution_analytics` calcule cote backend :

- comparaison avec la periode precedente ;
- courbe attendu/collecte ;
- segmentation des retards ;
- top impayes ;
- prochaines echeances ;
- performance par campagne ;
- performance par type.

Le statut global membre suit la regle :

```text
une cotisation obligatoire en retard -> EN_RETARD
sinon reste = 0 -> A_JOUR
sinon montant paye > 0 -> PARTIEL
sinon NON_PAYE
```

## Relances

`ContributionReminder` conserve l'historique des relances. Seul le canal `IN_APP` est considere comme envoye localement ; les canaux `EMAIL`, `SMS`, `WHATSAPP` sont mis en file pour integration fournisseur future.

Les relances de masse passent par une preview obligatoire avant envoi effectif.

## Cache

Les KPI analytics peuvent etre caches avec une cle incluant toujours le workspace :

```text
workspace:{workspace_id}:contributions:analytics:{period}:{range}
```

Le cache Redis n'est pas active dans ce prompt car les donnees sont encore agregees directement et doivent rester simples a invalider.

## Multi-tenancy

Tous les querysets filtrent par `X-Workspace`, membership actif et `workspace_id`. Les relations `campaign`, `member`, `target_category` et `target_members` sont limitees au workspace courant dans les serializers.
