# NOVEX Prompt 15 - Recettes, depenses et grand livre financier

## Audit du systeme existant

Le projet contenait deja cotisations, paiements, recus, justificatifs de paiement, historique financier initial, audit logs, workspaces et RBAC. Le module Finance a ete cree separement pour ne pas dupliquer `Payment` ou `Receipt`.

## Architecture financiere

`apps.finance` porte le grand livre. `apps.payments` reste responsable des paiements et synchronise les paiements reussis vers Finance de facon idempotente.

## Models

- `FinancialTransaction`
- `FinancialCategory`
- `FinancialSettings`
- `FiscalPeriod`
- `CostCenter`
- `FinancialTransactionDocument`

## Migrations

- `backend/apps/finance/migrations/0001_initial.py`

## APIs

- `/api/v1/finance/dashboard/`
- `/api/v1/finance/analytics/`
- `/api/v1/finance/settings/`
- `/api/v1/finance/transactions/`
- `/api/v1/finance/income/`
- `/api/v1/finance/expenses/`
- `/api/v1/finance/categories/`
- `/api/v1/finance/cost-centers/`
- `/api/v1/finance/periods/`

## Services

Creation recette/depense, categories par defaut, dashboard, analytics, alertes, validation, annulation, cloture et synchronisation `Payment SUCCESS`.

## Categories

Categories par defaut adaptees aux associations ivoiriennes, personnalisables et archivables.

## Recettes

Sources manuelles, dons, subventions, ventes, billetterie, sponsors et cotisations synchronisees.

## Depenses

Fournisseur, mode de paiement, projet, evenement, centre de cout, justificatif et validation selon seuil.

## Journal financier

Transactions avec entree/sortie, categorie, reference, source et filtres.

## Validation

Les grosses depenses passent en `PENDING`. Une depense exigeant justificatif ne peut pas etre validee sans document.

## Cloture

`FiscalPeriod.close` calcule total recettes, total depenses, solde et nombre de transactions, puis verrouille la periode.

## Justificatifs

`FinancialTransactionDocument` stocke les fichiers hors PostgreSQL avec validation taille, extension et MIME.

## Analytics

Solde, recettes, depenses, flux net, croissance, ratio depenses/recettes, repartitions, series et alertes.

## Permissions

Permissions Finance preparees : `finance.view`, `finance.create_income`, `finance.create_expense`, `finance.update`, `finance.validate_expense`, `finance.cancel`, `finance.manage_categories`, `finance.close_period`, `finance.export`, `finance.view_reports`.

## AuditLog

Journalisation : `income.created`, `expense.created`, `expense.validated`, `expense.cancelled`, `category.created`, `category.archived`, `fiscal_period.closed`, `finance.payment_synced`.

## Multi-tenancy

Tous les querysets API filtrent par workspace actif; les services valident les relations workspace avant ecriture.

## PWA

Pages Finance ajoutees dans l'app shell sans ajout de cache sensible.

## Tests

Tests ajoutes pour recette, depense, solde, annulation, synchronisation paiement, justificatif requis et cloture.

## Resultats des tests

`compileall` et `manage.py check` passent. Les tests Django restent sautes localement tant que `pytest-django` n'est pas installe.

## Fichiers crees

Module `backend/apps/finance`, pages `frontend/src/features/finance`, routes `/app/[workspace]/finance/*`, documentation et rapport.

## Fichiers modifies

Settings, API urls, payment services, navigation, docs API.

## Problemes rencontres

PostgreSQL local refuse l'authentification pendant `makemigrations`, sans bloquer la generation des migrations. `tsc` manque dans `node_modules`.

## Decisions techniques

Module Finance dedie, synchronisation idempotente par `source_payment`, pas de suppression physique, cloture bloquante, categories archivables.

## Prochaine etape

Prompt 16 : Budgets et controle budgetaire.
