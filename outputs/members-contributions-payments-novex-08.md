# NOVEX - Prompt 08/10 - Membres + Cotisations + Paiements

Date : 2026-08-29

## Membres

Modeles ajoutes ou enrichis :

- `MemberCategory`
- `Member`

Le modele `Member` contient maintenant :

- workspace ;
- linked_user optionnel ;
- membership_number unique par workspace ;
- first_name ;
- last_name ;
- email ;
- phone ;
- gender ;
- date_of_birth ;
- address ;
- city ;
- occupation ;
- photo ;
- join_date ;
- status ;
- category ;
- notes ;
- timestamps.

Services :

- generation serveur du numero membre ;
- creation avec audit log ;
- archivage avec audit log.

API :

- `GET /api/v1/members/`
- `POST /api/v1/members/`
- `GET/PATCH /api/v1/members/:id/`
- `POST /api/v1/members/:id/archive/`
- `GET/POST /api/v1/members/categories/`

UI :

- page `/app/[workspace]/members`
- KPI membres ;
- recherche ;
- filtres ;
- table desktop ;
- empty state mobile-friendly.

## Cotisations

Modeles crees :

- `ContributionCampaign`
- `ContributionCategoryAmount`
- `Contribution`
- `ReminderRule`

Logique :

- campagne avec montant, frequence, periode, due date, categorie cible ;
- montants par categorie prepares ;
- generation des cotisations dues pour membres actifs ;
- paiement partiel via `amount_paid` et `remaining_amount` ;
- statut recalcule : due, paid, partially_paid, overdue ;
- stats de recouvrement pour dashboard.

API :

- `GET /api/v1/contributions/`
- `GET/POST /api/v1/contributions/campaigns/`
- `POST /api/v1/contributions/campaigns/:id/generate/`
- `GET/POST /api/v1/contributions/reminders/`

UI :

- page `/app/[workspace]/contributions`
- KPI attendus/collectes/restants/taux ;
- section evolution ;
- widget retards ;
- actions campagne et relance.

## Paiements

Architecture creee :

- `Payment`
- `Receipt`
- `PaymentWebhookEvent`
- `PaymentProvider` protocol
- `ManualPaymentProvider`

Paiement manuel :

- idempotency key obligatoire ;
- paiement reussi cree cote serveur ;
- mise a jour de cotisation associee ;
- generation de recu ;
- audit log.

Paiement en ligne :

- architecture provider preparee ;
- webhook endpoint prepare ;
- event idempotent par `provider + event_id` ;
- aucune simulation de paiement reussi depuis frontend.

API :

- `GET /api/v1/payments/`
- `POST /api/v1/payments/manual/`
- `POST /api/v1/payments/webhooks/:provider/`
- `GET /api/v1/payments/receipts/`

UI :

- page `/app/[workspace]/payments`
- KPI paiements ;
- message securite paiement en ligne ;
- empty state.

## Webhooks

Gestion preparee :

- endpoint provider ;
- event id requis ;
- signature presente tracee ;
- stockage idempotent ;
- reponse `202 Accepted`.

La validation cryptographique exacte dependra du fournisseur choisi plus tard.

## Recus

Un `Receipt` est cree apres paiement manuel reussi.

Reference :

```text
NVX-YYYYMM-000001
```

Le PDF, le partage et le QR code de verification publique sont prepares par le modele mais pas encore generes.

## Permissions

Permissions attendues :

- `members.view`
- `members.create`
- `contributions.view`
- `contributions.create`
- `payments.view`
- `payments.create`

Le backend continue d'utiliser `RequireWorkspacePermission` avec le header workspace. Les actions financieres restent serveur-first.

Les routes d'ecriture utilisent des permissions dediees par action :

- creation membre : `members.create` ;
- modification categorie membre : `members.update` ;
- archivage membre : `members.archive` ;
- creation/generation cotisation : `contributions.create` ;
- regles de relance : `contributions.manage` ;
- paiement manuel : `payments.create` ;
- lecture recus/paiements : `payments.view`.

Note securite : l'attribution exacte des permissions `payments.create` et `payments.refund` aux roles existants doit etre validee explicitement avant activation, car ces permissions ont un impact financier sensible.

## Plans

Architecture compatible :

- START : membres, cotisations et paiements manuels seulement ;
- PRO : paiement en ligne, relances avancees, recus avances, analytics avancees.

Les entitlements en ligne devront etre bloques cote backend avant integration provider.

## Dashboard

Le dashboard consomme maintenant :

- total membres ;
- membres actifs ;
- cotisations attendues ;
- cotisations collectees ;
- restant ;
- taux de recouvrement ;
- membres a jour ;
- membres en retard ;
- paiements reussis comme recettes.

Les depenses restent a zero tant que le module Finance n'est pas implemente.

## Tests

Tests ajoutes :

- generation de cotisations pour membres actifs ;
- paiement manuel idempotent ;
- mise a jour paiement partiel ;
- webhook event idempotent.

Verification executee :

- `python -m compileall backend`
- `python backend/manage.py check`
- `pytest backend` : 1 passed, 2 skipped.
- `npm run typecheck` : bloque localement, `tsc` absent car les dependances frontend ne sont pas installees.

Tests non executes :

- tests frontend ;
- build Next.js.

Raison : les tests Django de services sont presents mais sautes localement parce que `pytest-django` n'est pas installe dans l'environnement Python actif. Le typecheck frontend doit s'executer apres installation des dependances Node.

## Securite

Protections :

- `workspace` obligatoire sur les donnees ;
- contraintes uniques workspace ;
- montants en Decimal ;
- idempotence paiement ;
- idempotence webhook ;
- audit log actions sensibles ;
- recu cree uniquement apres paiement serveur ;
- aucune confiance envers un statut frontend.

## Fichiers

Backend :

- `backend/apps/members/models.py`
- `backend/apps/members/services.py`
- `backend/apps/members/serializers.py`
- `backend/apps/members/views.py`
- `backend/apps/members/urls.py`
- `backend/apps/contributions/*`
- `backend/apps/payments/*`
- `backend/apps/dashboard/services.py`
- `backend/apps/api/urls.py`
- `backend/config/settings/base.py`
- `backend/conftest.py`
- `backend/tests/test_contribution_payment_services.py`

Frontend :

- `frontend/src/features/members/members-view.tsx`
- `frontend/src/features/contributions/contributions-view.tsx`
- `frontend/src/features/payments/payments-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/members/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/contributions/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/payments/page.tsx`
- `frontend/src/components/layout/association-shell.tsx`

Docs :

- `docs/members-contributions-payments.md`
- `docs/api.md`

## Dependances

Aucune nouvelle dependance ajoutee.

## Points restants

- Generer les migrations Django quand les dependances seront installees.
- Brancher les pages frontend aux APIs avec TanStack Query.
- Ajouter import CSV/Excel asynchrone via Celery.
- Ajouter vrais providers Mobile Money/carte/agregateur.
- Implementer validation signature provider.
- Generer PDF de recu et QR code verification.
- Ajouter entitlements START/PRO sur endpoints paiement en ligne.
- Ajouter tests pytest complets et E2E.
