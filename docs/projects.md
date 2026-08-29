# Module Projets

Le module Projets permet de planifier, budgetiser et suivre les projets d'un workspace association.

## Modeles

- `Project` : fiche projet, statut, priorite, responsable, dates, budget, progression.
- `ProjectBudgetCategory` : lignes budgetaires par projet.
- `ProjectExpenseAllocation` : liaison entre un projet et une depense. Cette table sert de passerelle tant que le module Finance complet n'est pas encore present.
- `ProjectDocument` : documents rattaches au projet, stockables via le backend media/S3-compatible.
- `ProjectActivity` : activite projet exploitable pour l'onglet Activite.

## Statuts

Les statuts sont centralises dans `apps.projects.statuses.ProjectStatus` :

- `DRAFT`
- `PLANNED`
- `ACTIVE`
- `ON_HOLD`
- `COMPLETED`
- `CANCELLED`

## Permissions

- `projects.view`
- `projects.create`
- `projects.update`
- `projects.delete`
- `projects.manage_budget`
- `projects.manage_documents`
- `projects.view_reports`

Les permissions sont appliquees par action dans le viewset backend.

## KPI

`workspace_project_stats` expose :

- `total_projects`
- `active_projects`
- `completed_projects`
- `delayed_projects`
- `total_budget`
- `total_expenses`
- `remaining_budget`
- `average_progress`

## Isolation workspace

Toutes les requetes filtrent par `X-Workspace`, membership actif et `workspace_id`. Les responsables utilisateur ou membre sont valides contre le meme workspace.
