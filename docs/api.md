# API NOVEX

Base path :

```text
/api/v1
```

Documentation OpenAPI :

```text
/api/schema/
/api/docs/
```

Endpoints initiaux :

```text
POST /api/v1/auth/register/
GET  /api/v1/workspaces/
POST /api/v1/workspaces/
GET  /api/v1/workspaces/:slug/
GET  /api/v1/members/
POST /api/v1/members/
GET  /api/v1/dashboard/overview/
GET  /api/v1/contributions/
POST /api/v1/contributions/
GET  /api/v1/contributions/:id/
PATCH /api/v1/contributions/:id/
DELETE /api/v1/contributions/:id/
GET  /api/v1/contributions/dashboard/
GET  /api/v1/contributions/analytics/
GET  /api/v1/contributions/overdue/
GET  /api/v1/contributions/upcoming/
GET  /api/v1/contributions/members-summary/
GET  /api/v1/contributions/recovery/
PATCH /api/v1/contributions/recovery/
POST /api/v1/contributions/bulk-reminder-preview/
GET  /api/v1/contributions/:id/stats/
POST /api/v1/contributions/:id/cancel/
POST /api/v1/contributions/:id/waive/
GET  /api/v1/contributions/:id/payments/
POST /api/v1/contributions/:id/payments/
GET  /api/v1/contributions/:id/reminder-preview/
POST /api/v1/contributions/:id/send-reminder/
POST /api/v1/contributions/campaigns/
PATCH /api/v1/contributions/campaigns/:id/
POST /api/v1/contributions/campaigns/:id/activate/
POST /api/v1/contributions/campaigns/:id/cancel/
POST /api/v1/contributions/campaigns/:id/generate/
GET  /api/v1/contributions/campaigns/:id/members/
GET  /api/v1/contributions/campaigns/:id/stats/
GET  /api/v1/contributions/reminder-history/
GET  /api/v1/contributions/exports/
POST /api/v1/contributions/exports/
GET  /api/v1/payments/
GET  /api/v1/payments/:id/
GET  /api/v1/payments/dashboard/
GET  /api/v1/payments/result/?reference=:reference
POST /api/v1/payments/initialize/
POST /api/v1/payments/manual/
POST /api/v1/payments/:id/refund/
GET  /api/v1/payments/:id/documents/
POST /api/v1/payments/:id/documents/
DELETE /api/v1/payments/:id/documents/:document_id/
POST /api/v1/payments/webhooks/:provider/
GET  /api/v1/receipts/
GET  /api/v1/receipts/:id/
GET  /api/v1/receipts/:id/download/
POST /api/v1/receipts/:id/send/
GET  /api/v1/finance/history/
GET  /api/v1/finance/dashboard/
GET  /api/v1/finance/analytics/
GET  /api/v1/finance/settings/
PATCH /api/v1/finance/settings/
GET  /api/v1/finance/transactions/
POST /api/v1/finance/transactions/
GET  /api/v1/finance/transactions/:id/
PATCH /api/v1/finance/transactions/:id/
DELETE /api/v1/finance/transactions/:id/
POST /api/v1/finance/transactions/:id/validate/
POST /api/v1/finance/transactions/:id/cancel/
GET  /api/v1/finance/transactions/:id/documents/
POST /api/v1/finance/transactions/:id/documents/
GET  /api/v1/finance/income/
POST /api/v1/finance/income/
GET  /api/v1/finance/expenses/
POST /api/v1/finance/expenses/
POST /api/v1/finance/expenses/:id/validate/
POST /api/v1/finance/expenses/:id/cancel/
GET  /api/v1/finance/categories/
POST /api/v1/finance/categories/
POST /api/v1/finance/categories/:id/archive/
GET  /api/v1/finance/cost-centers/
POST /api/v1/finance/cost-centers/
GET  /api/v1/finance/periods/
POST /api/v1/finance/periods/
POST /api/v1/finance/periods/:id/close/
GET  /api/v1/members/:id/financial-history/
GET  /api/v1/projects/
POST /api/v1/projects/
GET  /api/v1/projects/:id/
PATCH /api/v1/projects/:id/
DELETE /api/v1/projects/:id/
GET  /api/v1/projects/stats/
GET  /api/v1/projects/:id/budget-categories/
POST /api/v1/projects/:id/budget-categories/
GET  /api/v1/projects/:id/expenses/
POST /api/v1/projects/:id/expenses/
GET  /api/v1/projects/:id/documents/
POST /api/v1/projects/:id/documents/
GET  /api/v1/projects/:id/activity/
GET  /api/v1/projects/:id/reports/
GET  /api/v1/events/
POST /api/v1/events/
GET  /api/v1/events/:id/
PATCH /api/v1/events/:id/
DELETE /api/v1/events/:id/
GET  /api/v1/events/overview/
GET  /api/v1/events/calendar/?start=:date&end=:date
GET  /api/v1/events/:id/stats/
GET  /api/v1/events/:id/participants/
POST /api/v1/events/:id/participants/
POST /api/v1/events/:id/rsvp/
POST /api/v1/events/:id/attendance/
GET  /api/v1/events/:id/expenses/
POST /api/v1/events/:id/expenses/
GET  /api/v1/events/:id/revenues/
POST /api/v1/events/:id/revenues/
GET  /api/v1/events/:id/documents/
POST /api/v1/events/:id/documents/
GET  /api/v1/events/:id/activity/
GET  /api/v1/events/:id/report/
```

Les endpoints workspace doivent recevoir un contexte workspace fiable, puis le backend doit verifier le membership actif. Le frontend ne prouve jamais seul l'autorisation.
## Budgets

- `GET /api/v1/budgets/dashboard/` - KPI globaux: budget total, engage, consomme, restant, taux, risques, depassements et depenses non budgetisees.
- `GET|PATCH /api/v1/budgets/settings/` - configuration des seuils et de la regle `allow_over_budget_expense`.
- `GET|POST /api/v1/budgets/` - liste et creation des budgets.
- `GET|PATCH /api/v1/budgets/{id}/` - detail et modification.
- `POST /api/v1/budgets/{id}/activate/` - activation apres controle des lignes.
- `POST /api/v1/budgets/{id}/close/` - cloture, sans nouvelle depense affectable.
- `POST /api/v1/budgets/{id}/archive/` - archivage d'un budget cloture.
- `GET|POST /api/v1/budgets/{id}/lines/` - lecture et ajout des lignes budgetaires.
- `PATCH|DELETE /api/v1/budgets/{id}/lines/{line_id}/` - mise a jour ou archivage/suppression securisee.
- `POST /api/v1/budgets/{id}/assign-expense/` - affectation ou reaffectation manuelle d'une depense.
- `GET /api/v1/budgets/{id}/analytics/` - planned, committed, actual, remaining, consumption_rate, variance, series et transactions.
- `GET /api/v1/budgets/{id}/export/` - payload exportable PDF/XLSX/CSV.
- `GET /api/v1/budgets/alerts/` - alertes filtrees par statut, budget, date et severite.

## Projets operationnels

- `GET|POST /api/v1/projects/` - liste et creation des projets.
- `GET|PATCH /api/v1/projects/{id}/` - detail et modification.
- `POST /api/v1/projects/{id}/activate/` - passage en projet actif.
- `POST /api/v1/projects/{id}/pause/` - mise en pause.
- `POST /api/v1/projects/{id}/complete/` - cloture operationnelle.
- `POST /api/v1/projects/{id}/archive/` - archivage sans suppression des donnees.
- `GET /api/v1/projects/stats/` - dashboard portfolio.
- `GET /api/v1/projects/{id}/analytics/` - progression, budget, taches, milestones, risques.
- `GET|POST /api/v1/projects/{id}/members/` - equipe projet.
- `PATCH|DELETE /api/v1/projects/{id}/members/{member_id}/` - mise a jour ou retrait logique d'un membre projet.
- `GET|POST /api/v1/projects/{id}/tasks/` - taches projet pour kanban/liste/calendrier.
- `PATCH /api/v1/projects/{id}/tasks/{task_id}/` - transition ou edition d'une tache.
- `POST /api/v1/projects/{id}/tasks/{task_id}/complete/` - terminer une tache.
- `GET|POST /api/v1/projects/{id}/objectives/` - objectifs et KPI projet.
- `PATCH /api/v1/projects/{id}/objectives/{objective_id}/` - mise a jour d'objectif.
- `GET|POST /api/v1/projects/{id}/milestones/` - jalons.
- `PATCH /api/v1/projects/{id}/milestones/{milestone_id}/` - mise a jour d'un jalon.
- `GET|POST /api/v1/projects/{id}/comments/` - commentaires et mentions preparees.
- `GET /api/v1/projects/{id}/activity/` - timeline operationnelle.
- `GET /api/v1/projects/{id}/report/` - rapport consolide.
- `POST /api/v1/projects/{id}/report/export/` - preparation export PDF/XLSX via Celery.

## Evenements

- `GET|POST /api/v1/events/` - liste et creation des evenements.
- `GET|PATCH /api/v1/events/{id}/` - detail et modification.
- `POST /api/v1/events/{id}/cancel/` - annulation auditee.
- `POST /api/v1/events/{id}/complete/` - cloture evenement.
- `GET /api/v1/events/overview/` - dashboard evenements.
- `GET /api/v1/events/calendar/?start=&end=` - calendrier global NOVEX.
- `GET /api/v1/events/{id}/analytics/` - participants, presence, capacity, finance, feedback.
- `GET|POST /api/v1/events/{id}/participants/` - invitations et participants.
- `POST /api/v1/events/{id}/register/` - inscription PWA avec waitlist si complet.
- `POST /api/v1/events/{id}/unregister/` - annulation d'inscription avec controle deadline.
- `PATCH /api/v1/events/{id}/participants/{participant_id}/` - mise a jour participant.
- `GET|POST /api/v1/events/{id}/attendance/` - liste et mise a jour de presence.
- `POST /api/v1/events/{id}/checkin/` - check-in QR participant.
- `POST /api/v1/events/{id}/attendance/manual/` - presence manuelle auditee.
- `GET|POST /api/v1/events/{id}/organizers/` - equipe organisatrice.
- `GET|POST /api/v1/events/{id}/tickets/` - types de tickets.
- `POST /api/v1/events/{id}/tickets/orders/` - commande ticket, prete pour Payments.
- `GET /api/v1/events/{id}/tickets/{ticket_id}/` - detail ticket.
- `POST /api/v1/events/{id}/tickets/{ticket_id}/checkin/` - validation ticket anti-double scan.
- `GET|POST /api/v1/events/{id}/sponsors/` - sponsors.
- `GET|POST /api/v1/events/{id}/schedule/` - programme.
- `GET|POST /api/v1/events/{id}/speakers/` - intervenants.
- `GET|POST /api/v1/events/{id}/feedback/` - evaluations et satisfaction.
- `GET|POST /api/v1/events/{id}/announcements/` - annonces et canaux prepares.
- `GET /api/v1/events/{id}/report/` - rapport evenement.
- `POST /api/v1/events/{id}/report/export/` - preparation export PDF/XLSX via Celery.

## Documents & Archives

- `GET|POST /api/v1/documents/` - liste paginee, recherche, filtres et creation de documents GED.
- `GET|PATCH|DELETE /api/v1/documents/{id}/` - detail, modification et suppression logique vers corbeille.
- `GET /api/v1/documents/{id}/download/` - telechargement controle par workspace, visibilite et permission.
- `POST /api/v1/documents/{id}/archive/` - archivage logique.
- `POST /api/v1/documents/{id}/restore/` - restauration depuis archive ou corbeille.
- `POST /api/v1/documents/{id}/move/` - deplacement vers un dossier du meme workspace.
- `GET|POST /api/v1/documents/{id}/versions/` - historique et nouvelle version.
- `POST /api/v1/documents/{id}/versions/{version_id}/restore/` - restauration non destructive d'une ancienne version.
- `GET|POST /api/v1/documents/{id}/shares/` - partages membre, role ou equipe.
- `GET|POST /api/v1/documents/{id}/share-links/` - liens securises optionnels.
- `POST /api/v1/documents/{id}/favorite/` - ajout favori.
- `DELETE /api/v1/documents/{id}/unfavorite/` - retrait favori.
- `GET|POST /api/v1/documents/{id}/approvals/` - demandes de validation.
- `POST /api/v1/documents/{id}/approve/` - approbation.
- `POST /api/v1/documents/{id}/reject/` - rejet.
- `GET /api/v1/documents/search/` - recherche documentaire paginee.
- `GET /api/v1/documents/analytics/` - KPI, stockage, categories, types, recents et validations.
- `GET /api/v1/documents/export/` - export CSV des metadonnees.
- `GET|POST /api/v1/documents/folders/` - dossiers documentaires.
- `GET|POST /api/v1/documents/tags/` - tags documentaires.

## Rapports & Analytics

- `GET /api/v1/analytics/overview/` - dashboard global: finances, membres, cotisations, projets, evenements, documents, performance et alertes.
- `GET /api/v1/analytics/finance/` - recettes, depenses, resultat, budget, cash flow et repartitions.
- `GET /api/v1/analytics/members/` - total, actifs, nouveaux, sortis, croissance et retention.
- `GET /api/v1/analytics/contributions/` - attendu, encaisse, impayes, recouvrement et retards.
- `GET /api/v1/analytics/projects/` - projets, budget, depenses, progression et risques.
- `GET /api/v1/analytics/events/` - evenements, participants, presence, budget, recettes et depenses.
- `GET /api/v1/analytics/documents/` - volumes documentaires, stockage et validations.
- `GET /api/v1/analytics/performance/` - scores de sante et formules.
- `GET /api/v1/analytics/alerts/` - alertes analytics consolidees.
- `GET /api/v1/analytics/annual/` - rapport annuel consolide.
- `GET|POST /api/v1/reports/dashboards/` - dashboards personnalisables et widgets.
- `GET|POST /api/v1/reports/saved/` - rapports sauvegardes.
- `GET|POST /api/v1/reports/saved/{id}/shares/` - partage de rapport.
- `GET|POST /api/v1/reports/scheduled/` - rapports programmes.
- `POST /api/v1/reports/export/` - demande d'export.
- `GET|POST /api/v1/reports/exports/` - liste et creation d'exports.
