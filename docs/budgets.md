# Budgets & controle budgetaire

Le module Budgets ajoute une couche de pilotage budgetaire au-dessus du grand livre financier NOVEX. Les depenses restent des `FinancialTransaction` de type `EXPENSE`; une affectation unique `BudgetAssignment` relie la depense a une `BudgetLine`.

## Architecture

- `BudgetSettings`: configuration workspace, depenses hors budget, seuils et canaux d'alerte prepares.
- `Budget`: enveloppe budgetaire par association, projet ou evenement.
- `BudgetLine`: repartition par categorie financiere existante.
- `BudgetAssignment`: lien univoque depense -> budget line.
- `BudgetAlert`: alertes in-app/email, avec WhatsApp/SMS prepares.
- `BudgetActivity`: historique budgetaire auditable.

## Calculs

- Consomme: somme des depenses validees affectees au budget.
- Engage: montant engage manuel + depenses affectees en attente de validation.
- Restant: budget total - consomme - engage.
- Taux: consomme / budget total, avec retour `0` si le budget est nul.
- Depassement: consomme - budget total lorsque le resultat est positif.

Les valeurs critiques sont recalculees depuis les transactions afin de garder une source comptable fiable.

## API

- `GET /api/v1/budgets/dashboard/`
- `GET|PATCH /api/v1/budgets/settings/`
- `GET|POST /api/v1/budgets/`
- `GET|PATCH /api/v1/budgets/:id/`
- `POST /api/v1/budgets/:id/activate/`
- `POST /api/v1/budgets/:id/close/`
- `POST /api/v1/budgets/:id/archive/`
- `GET|POST /api/v1/budgets/:id/lines/`
- `PATCH|DELETE /api/v1/budgets/:id/lines/:line_id/`
- `POST /api/v1/budgets/:id/assign-expense/`
- `GET /api/v1/budgets/:id/analytics/`
- `GET /api/v1/budgets/:id/export/`
- `GET /api/v1/budgets/alerts/`

## Permissions

Les vues utilisent les codes `budgets.*`. Leur creation et leur attribution aux roles restent une decision d'administration afin d'eviter une elevation automatique de droits.
