# Membres, Cotisations et Paiements

## Principes

- `User` designe un compte NOVEX.
- `Member` designe une personne membre d'une organisation.
- Les deux concepts restent separes.
- Toutes les donnees sont reliees a `Workspace`.
- Les montants utilisent `DecimalField`, jamais `float`.
- Les paiements en ligne doivent etre confirmes par webhook serveur.

## Membres

Modele :

- `MemberCategory`
- `Member`

`membership_number` est unique par workspace et genere cote serveur si absent.

Statuts :

- active
- pending
- suspended
- resigned
- excluded
- deceased
- former
- archived

API :

```text
GET    /api/v1/members/
POST   /api/v1/members/
GET    /api/v1/members/:id/
PATCH  /api/v1/members/:id/
POST   /api/v1/members/:id/archive/
GET    /api/v1/members/categories/
POST   /api/v1/members/categories/
```

Recherche :

- prenom ;
- nom ;
- telephone ;
- email ;
- numero membre.

## Cotisations

Modeles :

- `ContributionCampaign`
- `ContributionCategoryAmount`
- `Contribution`
- `ReminderRule`

Frequences :

- once
- monthly
- quarterly
- semiannual
- annual
- custom

Statuts cotisation :

- due
- pending
- paid
- partially_paid
- overdue
- cancelled

API :

```text
GET  /api/v1/contributions/
GET  /api/v1/contributions/campaigns/
POST /api/v1/contributions/campaigns/
POST /api/v1/contributions/campaigns/:id/generate/
GET  /api/v1/contributions/reminders/
POST /api/v1/contributions/reminders/
```

## Paiements

Modeles :

- `Payment`
- `Receipt`
- `PaymentWebhookEvent`

Statuts paiement :

- initiated
- pending
- successful
- failed
- cancelled
- refunded

Paiement manuel :

```text
POST /api/v1/payments/manual/
```

La requete doit fournir une `idempotency_key`. Une meme cle pour un workspace ne peut pas comptabiliser deux fois le paiement.

Webhooks :

```text
POST /api/v1/payments/webhooks/:provider/
```

Chaque evenement provider est stocke avec une contrainte unique `provider + event_id`.

## Plans

- START : gestion membres/cotisations, paiement en ligne non disponible.
- PRO : paiement en ligne, relances avancees, recus avances, analytics avancees.

Les entitlements doivent etre verifies cote backend avant toute integration fournisseur.

## Dashboard

Le dashboard consomme maintenant :

- total membres ;
- membres actifs ;
- cotisations attendues ;
- cotisations collectees ;
- restant ;
- taux de recouvrement ;
- membres a jour ;
- membres en retard ;
- paiements reussis comme recettes.

Les depenses restent a zero tant que le module Finance n'existe pas.
