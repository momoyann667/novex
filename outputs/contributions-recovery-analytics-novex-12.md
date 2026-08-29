# NOVEX - Prompt 12 - Suivi, recouvrement et analytics des cotisations

Date : 2026-08-29

## 1. Audit du Prompt 11

Le Prompt 11 avait deja pose campagnes, obligations individuelles, paiements manuels, exonerations, statuts centralises et dashboard simple. Le Prompt 12 ajoute la couche pilotage sans recreer le module.

## 2. Fichiers crees

- `backend/apps/contributions/migrations/0002_contributionrecoverysettings_and_more.py`
- `frontend/src/features/contributions/contribution-members-view.tsx`
- `frontend/src/features/contributions/contribution-recovery-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/contributions/members/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/contributions/recovery/page.tsx`
- `outputs/contributions-recovery-analytics-novex-12.md`

## 3. Fichiers modifies

- `backend/apps/contributions/models.py`
- `backend/apps/contributions/serializers.py`
- `backend/apps/contributions/services.py`
- `backend/apps/contributions/statuses.py`
- `backend/apps/contributions/urls.py`
- `backend/apps/contributions/views.py`
- `backend/tests/test_contribution_payment_services.py`
- `docs/api.md`
- `docs/contributions.md`
- `frontend/src/features/contributions/contributions-view.tsx`

## 4. Modeles

- `ContributionRecoverySettings` : objectif de recouvrement par workspace.
- `ContributionReminder` : historique et file de relances.
- `ContributionExportRequest` : demandes d'export CSV/Excel/PDF, Celery-ready.

## 5. API

- `GET /api/v1/contributions/analytics/`
- `GET /api/v1/contributions/overdue/`
- `GET /api/v1/contributions/upcoming/`
- `GET /api/v1/contributions/members-summary/`
- `GET/PATCH /api/v1/contributions/recovery/`
- `POST /api/v1/contributions/bulk-reminder-preview/`
- `GET /api/v1/contributions/:id/reminder-preview/`
- `POST /api/v1/contributions/:id/send-reminder/`
- `GET /api/v1/contributions/reminder-history/`
- `GET/POST /api/v1/contributions/exports/`

## 6. Services

- `contribution_analytics`
- `collection_series`
- `overdue_queryset`
- `overdue_segments`
- `top_unpaid_members`
- `upcoming_due`
- `member_recovery_summary`
- `campaign_performance`
- `type_performance`
- `render_reminder_template`
- `create_manual_reminder`
- `bulk_reminder_preview`
- `create_export_request`
- `cache_key_for_contribution_analytics`

## 7. Taches Celery

Les modeles et exports sont Celery-ready, mais aucune tache worker concrete n'est lancee dans ce prompt. Les canaux externes restent en file pour eviter de simuler un fournisseur absent.

## 8. Analytics

Analytics disponibles : comparaison periode courante vs precedente, courbe attendu/collecte, segmentation des retards, top impayes, prochaines echeances, performance par campagne et par type.

## 9. KPI

Total attendu, total collecte, reste, taux de recouvrement, membres a jour, paiements partiels, retardataires, non payes, echeances semaine/mois, montant en retard, taux de retard.

## 10. Permissions

Les endpoints utilisent `contributions.view`, `contributions.manage` et `contributions.view_reports` selon la sensibilite.

## 11. AuditLog

Actions ajoutees : `reminder.created`, `reminder.sent`, `contribution.export_requested`.

## 12. Cache

Cle preparee : `workspace:{workspace_id}:contributions:analytics:{period}:{range}`. Redis n'est pas active dans ce prompt pour eviter des invalidations prematurées.

## 13. Tests

Tests ajoutes : recouvrement `100000/80000 = 80%`, jours de retard, preview relance en masse, prochaines echeances, relance manuelle, export request.

## 14. Resultats des tests

- `python -m compileall backend` : OK.
- `python backend/manage.py check` : OK.
- `pytest backend` : 1 passed, 4 skipped.
- `python backend/manage.py makemigrations contributions --check --dry-run` : no changes detected, avertissement connexion PostgreSQL locale.
- `npm run typecheck` : bloque localement car `tsc` n'est pas installe.

Les tests Django riches restent sautes localement car `pytest-django` n'est pas installe.

## 15. Problemes rencontres

- PostgreSQL local refuse la connexion utilisateur `novex`.
- Pas de fournisseur Email/SMS/WhatsApp connecte.
- Pas de module Notifications complet.
- Pas de dependances Node installees pour typecheck frontend.

## 16. Decisions techniques

- Exports volumineux modelises par `ContributionExportRequest`.
- Relance en masse avec preview obligatoire.
- Statut global membre calcule, non stocke.
- Analytics workspace-scoped sans chargement brut inutile.

## 17. Prochaine etape

Prompt 13 : architecture et integration du paiement des cotisations NOVEX, avec transactions, webhooks signes, idempotence, statuts serveur-first, reconciliation et moyens de paiement adaptes au contexte ivoirien.
