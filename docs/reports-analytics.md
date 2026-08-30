# Rapports & Analytics

Le module Rapports & Analytics consolide les donnees existantes de NOVEX sans devenir une source de verite parallele.

## Architecture

- `apps.analytics` expose les endpoints de lecture sous `/api/v1/analytics/`.
- `apps.reports` stocke les dashboards personnalises, widgets, rapports sauvegardes, partages, planifications et demandes d'export.
- Les calculs reutilisent les services existants: Finance, Contributions, Budgets, Projects, Events et Documents.

## Endpoints Analytics

- `GET /api/v1/analytics/overview/`
- `GET /api/v1/analytics/finance/`
- `GET /api/v1/analytics/members/`
- `GET /api/v1/analytics/contributions/`
- `GET /api/v1/analytics/projects/`
- `GET /api/v1/analytics/events/`
- `GET /api/v1/analytics/documents/`
- `GET /api/v1/analytics/performance/`
- `GET /api/v1/analytics/alerts/`
- `GET /api/v1/analytics/annual/`

Chaque endpoint accepte `period`, `date_from`, `date_to` et utilise `X-Workspace`.

## Endpoints Reports

- `GET|POST /api/v1/reports/dashboards/`
- `GET|POST /api/v1/reports/saved/`
- `GET|POST /api/v1/reports/saved/:id/shares/`
- `GET|POST /api/v1/reports/scheduled/`
- `POST /api/v1/reports/export/`
- `GET|POST /api/v1/reports/exports/`
- `GET /api/v1/reports/exports/:id/`

## Formules

- Resultat net = recettes validees - depenses validees.
- Taux de recouvrement = montant encaisse / montant attendu x 100, avec 0 si attendu vaut 0.
- Taux de presence = participants presents / participants x 100, avec 0 si aucun participant.
- Utilisation budget = depense validee / budget total x 100.
- Score financier = 25% respect budget + 35% recouvrement + 40% resultat.
- Score cotisations = 75% recouvrement + 25% retards.
- Score projets = 50% progression + 50% respect delais.
- Score evenements = 70% presence + 30% resultat financier.

## RBAC

Permissions attendues:

- `reports.view`
- `reports.finance`
- `reports.members`
- `reports.contributions`
- `reports.projects`
- `reports.events`
- `reports.documents`
- `reports.export`
- `reports.share`
- `reports.schedule`
- `reports.manage`

## Exports

Les exports PDF/XLSX/CSV sont modelises via `ReportExportRequest` avec statuts `pending`, `processing`, `completed`, `failed`.

L'implementation actuelle prepare un payload leger et compatible avec un traitement Celery futur. Elle evite d'exporter des donnees hors permissions et conserve l'audit de chaque demande.

## Performance

Les agregations sont scoppes par workspace et utilisent `Sum`, `Count`, `Avg`, `TruncMonth`, `select_related`, `prefetch_related` et les indexes deja presents dans les modules metier.
