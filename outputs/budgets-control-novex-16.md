# NOVEX - Prompt 16 - Budgets & controle budgetaire

## 1. Audit du code existant

Le socle finance dispose deja de `FinancialTransaction`, `FinancialCategory`, projets, evenements, audit et dashboard. Le module budgets reutilise ces objets et ne cree pas de second systeme de depenses.

## 2. Architecture Budgets

Creation de `apps.budgets` avec settings, budgets, lignes, affectations, alertes, activites et services metier.

## 3. Models crees/modifies

Crees: `BudgetSettings`, `Budget`, `BudgetLine`, `BudgetAssignment`, `BudgetAlert`, `BudgetActivity`.
Modifie: serializer/service finance pour accepter une `budget_line` optionnelle sur les depenses.

## 4. Migrations

`0001_initial` cree les tables et indexes. Les codes `budgets.*` sont references par les vues et documentes pour provisioning RBAC explicite.

## 5. API

Endpoints REST ajoutes sous `/api/v1/budgets/`: CRUD budget, activation, cloture, archivage, lignes, affectation depense, analytics, alertes, settings et export payload.

## 6. Services

Calculs centralises dans `apps.budgets.services`: previsionnel, engage, realise, restant, variance, taux, depassement, dashboard, affectation et alertes.

## 7. Analytics

Analytics par budget avec resume, lignes, transactions liees, evolution mensuelle et repartition par categorie.

## 8. Alertes

Seuils configurables 50/75/90/100. Canaux prepares: in-app, email, WhatsApp, SMS.

## 9. RBAC

Permissions: view, create, update, activate, close, archive, assign_expense, reassign_expense, manage_alerts, export. Les droits ne sont pas auto-attribues aux roles pour eviter une elevation de privileges dans les workspaces existants.

## 10. AuditLog

Actions journalisees: creation, mise a jour, activation, cloture, archivage, lignes, affectations, reaffectations et alertes.

## 11. Multi-tenancy

Toutes les requetes filtrent par `X-Workspace`, membership actif et workspace des ressources reliees.

## 12. UX/UI

Ajout du menu Budgets, dashboard KPI, cards, progress bars, tableau previsionnel/realise, detail budget et creation guidee.

## 13. PWA

Pages Next.js integrees au shell workspace et responsives pour desktop/mobile.

## 14. Performance

Indexes sur workspace, budget, category, project, event, status, dates. Usage de `select_related`, `prefetch_related` et aggregations.

## 15. Tests

Tests ajoutes pour calculs, depassement, zero division, recette ignoree, annulation, blocage hors budget et depense non budgetisee.

## 16. Resultats des tests

- `python -m compileall backend`: OK
- `python backend/manage.py check --settings=config.settings.test`: OK
- `python backend/manage.py makemigrations --check --dry-run --settings=config.settings.test`: OK
- `python backend/manage.py migrate --settings=config.settings.test --noinput`: OK
- `pytest backend`: 1 passed, 6 skipped (`pytest-django` absent localement)
- `npm --workspace frontend run typecheck`: bloque car `tsc` n'est pas installe dans `frontend/node_modules`

## 17. Fichiers crees

- `backend/apps/budgets/*`
- `backend/tests/test_budget_services.py`
- `frontend/src/features/budgets/*`
- `frontend/src/app/(workspace)/app/[workspace]/budgets/*`
- `docs/budgets.md`

## 18. Fichiers modifies

- `backend/config/settings/base.py`
- `backend/apps/api/urls.py`
- `backend/apps/finance/services.py`
- `backend/apps/finance/serializers.py`
- `frontend/src/components/layout/association-shell.tsx`

## 19. Problemes rencontres

L'attribution automatique des permissions aux roles existants a ete refusee par la revue de securite. Leur creation/affectation doit rester explicite dans le flux d'administration RBAC du projet.

## 20. Dette technique eventuelle

Les exports PDF/XLSX/CSV retournent un payload pret a exporter; la generation de fichiers lourds pourra etre deplacee dans Celery.

## 21. Prochaine etape

Prompt 17: module Projets complet avec budgets, taches, equipe, depenses, documents, evenements, avancement et rapports.
