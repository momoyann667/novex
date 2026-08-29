# NOVEX - Prompt 07/10 - Dashboard Association + KPI + Analytics

Date : 2026-08-29

## Dashboard

Le dashboard Association a ete transforme en centre de pilotage modulaire.

Widgets crees :

- `DashboardHeader`
- `KpiCard`
- `ProgressRing`
- `EmptyDashboard`
- `FinancialOverview`
- `ContributionOverview`
- `DashboardSecondaryWidgets`
- `DashboardView`

Sections disponibles :

- header avec periode, date, actualiser, export, action ;
- KPI finance ;
- KPI membres ;
- evolution financiere ;
- suivi des cotisations ;
- projets ;
- prochains evenements ;
- alertes ;
- activite recente ;
- documents recents ;
- insights NOVEX ;
- derniere mise a jour.

## KPI

Metriques exposees par le contrat dashboard :

- solde actuel ;
- recettes ;
- depenses ;
- flux net ;
- cotisations collectees ;
- objectif cotisations ;
- restant a collecter ;
- taux de recouvrement ;
- membres total ;
- membres actifs ;
- taux actifs ;
- nouveaux membres ;
- membres a jour ;
- projets total ;
- projets actifs ;
- projets a risque ;
- projets en retard ;
- evenements a venir ;
- documents recents.

Les chiffres finance/projets/evenements/documents restent a zero tant que les modules metier correspondants ne sont pas implementes. Aucune fausse donnee persistante n'a ete ajoutee.

## API

Endpoint cree :

```text
GET /api/v1/dashboard/overview/
```

Contexte requis :

```text
X-Workspace: <workspace-slug>
```

Le endpoint est protege par `RequireWorkspacePermission.for_permission("workspace.view")`.

## Backend

Fichiers backend crees :

- `backend/apps/dashboard/__init__.py`
- `backend/apps/dashboard/apps.py`
- `backend/apps/dashboard/services.py`
- `backend/apps/dashboard/views.py`
- `backend/apps/dashboard/urls.py`
- `backend/tests/test_dashboard_services.py`

Fichiers backend modifies :

- `backend/config/settings/base.py`
- `backend/apps/api/urls.py`

Calculs et agregations :

- total membres ;
- membres actifs ;
- taux de membres actifs ;
- finance masquee si permissions insuffisantes ;
- empty state si aucun membre.

## Performance

Choix effectues :

- endpoint agrege `dashboard/overview` ;
- pas de multiplication d'endpoints au chargement initial ;
- agregations Django `Count` avec filtres ;
- donnees futures prevues sous `series` pour brancher graphiques sans changer le contrat ;
- cache futur a isoler par workspace, periode, filtres et permissions.

## Permissions

La finance est masquee si l'utilisateur n'a aucune permission finance/cotisations/recettes/depenses.

Roles cibles :

- Owner/Admin : vue complete ;
- President : vue strategique ;
- Treasurer : finance et cotisations ;
- Secretary : membres, evenements, documents ;
- Project Manager : projets ;
- Member : vue limitee.

Le backend reste la source d'autorisation.

## Responsive

Desktop :

- grilles KPI en quatre colonnes ;
- section finance + cotisations en grille large ;
- widgets secondaires en trois colonnes.

Tablet :

- grilles en deux colonnes.

Mobile :

- empilement vertical ;
- empty state prioritaire ;
- actions compactes ;
- cards lisibles.

## PWA

Le dashboard vit dans l'App Shell Association existant. Il est compatible avec le mode installe et ne met pas en cache de donnees sensibles par lui-meme.

## Tests

Tests ajoutes :

- `test_dashboard_overview_scopes_members_to_workspace`
- `test_dashboard_masks_finance_without_permission`

Verifications executees :

- compilation syntaxique Python via `python -m compileall backend`.

Tests non executes :

- pytest reel ;
- typecheck frontend ;
- build frontend.

Raison : les dependances du projet n'ont pas encore ete installees dans l'environnement.

## Fichiers frontend crees/modifies

Crees :

- `frontend/src/features/dashboard/types.ts`
- `frontend/src/features/dashboard/data.ts`
- `frontend/src/features/dashboard/dashboard-header.tsx`
- `frontend/src/features/dashboard/kpi-card.tsx`
- `frontend/src/features/dashboard/progress-ring.tsx`
- `frontend/src/features/dashboard/empty-dashboard.tsx`
- `frontend/src/features/dashboard/financial-overview.tsx`
- `frontend/src/features/dashboard/contribution-overview.tsx`
- `frontend/src/features/dashboard/dashboard-secondary-widgets.tsx`
- `frontend/src/features/dashboard/dashboard-view.tsx`

Modifie :

- `frontend/src/app/(workspace)/app/[workspace]/dashboard/page.tsx`

## Documentation

Crees/modifies :

- `docs/dashboard.md`
- `docs/api.md`

## Points restant a traiter

- Brancher le dashboard frontend au endpoint API avec session auth reelle.
- Ajouter les vrais modules finance, cotisations, projets, evenements, documents et rapports.
- Remplacer les placeholders graphiques par des charts accessibles lorsque les donnees existent.
- Ajouter exports PDF/CSV.
- Ajouter analytics temps reel via invalidation TanStack Query, SSE ou WebSocket.
- Ajouter tests frontend responsives et E2E.
