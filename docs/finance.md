# Finance NOVEX

Le module Finance couvre les recettes, depenses, categories, centres de cout, transactions, periodes comptables et analytics.

## Architecture

`apps.finance` est separe de `apps.payments` pour eviter les doublons :

- `Payment` confirme les cotisations et genere recu/trace.
- `FinancialTransaction` alimente le grand livre.
- `FinancialCategory` classe les recettes et depenses.
- `FiscalPeriod` verrouille les periodes cloturees.
- `FinancialSettings` porte les regles workspace.

Un `Payment SUCCESS` cree une seule transaction financiere via `sync_payment_to_finance`, grace au lien unique `source_payment`.

## Categories par defaut

Recettes : Cotisations, Dons, Subventions, Sponsors, Ventes, Billetterie, Prestations, Autres.

Depenses : Transport, Communication, Fournitures, Location, Evenements, Projets, Prestations, Maintenance, Administration, Autres.

Les categories peuvent etre archivees avec `is_active = false`, jamais supprimees physiquement lorsqu'elles structurent l'historique.

## Transactions

Types :

```text
INCOME
EXPENSE
```

Statuts :

```text
DRAFT
PENDING
VALIDATED
CANCELLED
```

Sources :

```text
MANUAL
CONTRIBUTION
PAYMENT
DONATION
EVENT
PROJECT
OTHER
```

Le solde inclut uniquement les transactions `VALIDATED`.

## Validation des depenses

`FinancialSettings.expense_validation_threshold` controle le passage automatique en `PENDING`.

`FinancialSettings.require_expense_receipt` impose un justificatif avant validation.

## Cloture

Une periode `CLOSED` bloque les modifications directes sur les transactions de la periode. Les corrections futures devront passer par ajustement.

## Permissions

Permissions preparees :

- `finance.view`
- `finance.create_income`
- `finance.create_expense`
- `finance.update`
- `finance.validate_expense`
- `finance.cancel`
- `finance.manage_categories`
- `finance.close_period`
- `finance.export`
- `finance.view_reports`

## PWA et securite

Les pages Finance sont integrees dans l'app shell. Aucune donnee financiere sensible n'est ajoutee au cache offline.
