# NOVEX Prompt 20 - Rapports & Analytics

## Audit initial

Les modules Finance, Contributions, Members, Projects, Events, Budgets, Documents, Dashboard et AuditLog ont ete inspectes. Les services reutilises sont `finance_dashboard`, `finance_totals`, `category_breakdown`, `contribution_stats`, `budget_dashboard`, `workspace_project_stats`, `workspace_event_stats` et `document_analytics`.

## Architecture Analytics

Ajout de `apps.analytics` pour les endpoints de pilotage et `apps.reports` pour les rapports sauvegardes, widgets, partages, planifications et exports.

## Models

Ajout de `AnalyticsDashboard`, `AnalyticsWidget`, `SavedReport`, `SavedReportShare`, `ScheduledReport` et `ReportExportRequest`.

## Services

Ajout de consolidation par periode, comparaison periode precedente, score de performance, alertes et generation de payload export.

## Aggregations

Utilisation de `Sum`, `Count`, `Avg`, `Q`, `TruncMonth`, filtres dates et scopes workspace.

## KPI

KPI globaux: solde, recettes, depenses, resultat, budgets, recouvrement, membres actifs, cotisations, projets, evenements et documents.

## Finance Analytics

Recettes, depenses, resultat, solde, budget, ecart budgetaire, repartitions et cash flow.

## Members Analytics

Total, actifs, nouveaux, sortis, suspendus, croissance, retention et repartition par statut.

## Contributions Analytics

Attendu, encaisse, impayes, taux de recouvrement, montant moyen, membres a jour et retards.

## Projects Analytics

Totaux, actifs, termines, retards, budget, depenses, progression moyenne et projets a risque.

## Events Analytics

Nombre, participants, presence, taux de presence, budget, depenses, recettes, resultat et tops.

## Documents Analytics

Reutilisation du module Documents: volumes, categories, stockage, recents, archives, validations.

## Performance Scores

Formules explicites: finance, cotisations, projets, evenements et score global.

## Alerts

Moteur simple: recouvrement bas, depenses en hausse, projets en retard, faible participation.

## Saved Reports

CRUD `SavedReport` avec filtres et configuration JSON.

## Scheduled Reports

`ScheduledReport` prepare les frequences hebdomadaire, mensuelle et trimestrielle.

## PDF Export

Payload professionnel prepare pour rendu PDF asynchrone: workspace, periode, KPI, sections et date de generation.

## Excel Export

Payload structure en sections: resume, finances, cotisations, membres, projets, evenements, documents.

## CSV Export

CSV prepare pour donnees tabulaires et metadonnees, sans contenu binaire.

## Celery

Le modele d'export et les statuts sont prets pour delegation Celery. Aucun worker supplementaire n'a ete cree dans ce prompt.

## Cache

Redis existe dans la configuration. La couche actuelle garde les calculs temps reel et documente les points pouvant etre caches.

## API

Ajout `/api/v1/analytics/*` et `/api/v1/reports/*`.

## RBAC

Endpoints proteges par `reports.*`.

## Audit

Journalisation: `report.created`, `report.updated`, `report.deleted`, `report.shared`, `report.export_requested`, `report.export_completed`, `report.export_failed`, `report.scheduled`.

## Security

Toutes les requetes sont scoppes par `X-Workspace` et permissions. Les donnees finance restent derriere `reports.finance`.

## Multi-tenancy

Toutes les agregations filtrent par workspace.

## PWA

Pages responsive sous `/app/[workspace]/reports`.

## Responsive

Dashboard dense desktop, grilles adaptatives, tables scrollables et KPI prioritaires sur mobile.

## Performance

Indexes sur rapports, exports, widgets et partages. Requetes principales basees sur agregations SQL.

## Tests

Tests de service ajoutes pour finance, cotisations, membres, projets, evenements, scores et isolation workspace.

## Resultats des tests

- `python -m compileall backend` : OK.
- `python backend/manage.py check --settings=config.settings.test` : OK.
- `python backend/manage.py makemigrations --check --dry-run --settings=config.settings.test` : OK, aucun changement detecte.
- `python backend/manage.py migrate --settings=config.settings.test --noinput` : OK, migration `reports.0001_initial` appliquee.
- Runtime Analytics avec `migrate --run-syncdb` sur SQLite memoire : OK, `overview_analytics` retourne un empty state valide.
- `pytest backend` : 1 passed, 8 skipped. Les tests Django de service sont skips car `pytest-django` n'est pas installe dans l'environnement local.
- `npm --workspace frontend run typecheck` : bloque, `tsc` n'est pas installe/reconnu localement.

## Fichiers crees

Voir commit Prompt 20.

## Fichiers modifiés

Configuration Django, API v1, documentation et frontend Reports.

## Problemes rencontres

Les dependances locales peuvent limiter certains checks (`pytest-django`, `tsc`).

## Dette technique

Ajouter rendu reel PDF/XLSX, jobs Celery, cache Redis avec invalidation fine, connecteur notification et tests de charge massifs.

## Decisions techniques

Separer lecture analytics et persistance reports, reutiliser les services existants, garder les scores transparents.

## Prochaine etape

PROMPT 21 - Module Notifications & Communication.
