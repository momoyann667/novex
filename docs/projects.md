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
# Module projets operationnel

Le module projets connecte planification, equipe, taches, objectifs, milestones, budget, finances, documents, evenements, activite et rapports.

## Socle metier

- `Project`: code serveur `PRJ-YYYY-NNN`, statut, priorite, visibilite, parent, owner membre, budget, devise, progression et cloture.
- `ProjectMember`: equipe projet avec roles locaux `PROJECT_MANAGER`, `MEMBER`, `FINANCE`, `OBSERVER`.
- `ProjectObjective`: objectifs mesurables avec cible, valeur actuelle, unite et progression.
- `ProjectMilestone`: jalons avec detection de retard.
- `ProjectTask`: taches kanban/liste/calendrier, assigne, milestone, dependances et blocage des cycles.
- `ProjectComment`: commentaires avec mentions preparees.
- `ProjectAlert`: alertes projet pour taches, deadline, budget et milestones.

## Integrations NOVEX

Les depenses projet sont consolidees depuis `FinancialTransaction.project` et les anciennes allocations projet. Les budgets projet restent geres par `apps.budgets` via `Budget.scope_type=PROJECT`.

## Calculs

- Avancement automatique: moyenne des taches terminees, objectifs et milestones.
- Budget consomme: depenses finance validees + allocations projet existantes.
- Risque: retard, budget superieur a 90%, taches bloquees et milestones en retard.
- Rapport: presentation, objectifs, analytics, budget, equipe, activite et formats d'export prepares.

## Permissions

Les vues utilisent `projects.view`, `projects.create`, `projects.update`, `projects.archive`, `projects.manage_members`, `projects.manage_tasks`, `projects.manage_budget`, `projects.manage_documents`, `projects.manage_objectives`, `projects.manage_reports` et `projects.export`.
