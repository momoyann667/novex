# NOVEX Prompt 14 - Recus, justificatifs et historique financier

## Architecture

Le module paiements devient la source de preuve financiere : `Payment` confirme, `Receipt` prouve, `PaymentDocument` justifie, `PaymentEvent` trace et `FinancialAdjustment` prepare les corrections auditables.

## Models

- `Receipt` enrichi avec `receipt_number`, `member`, `contribution`, `amount`, `currency`, `status`, `storage_key`, `pdf_url`, timestamps.
- `PaymentDocument` pour les justificatifs.
- `FinancialAdjustment` pour les corrections futures.
- `Payment` ajoute rapprochement et champs de remboursement.

## Migrations

- `backend/apps/payments/migrations/0002_financialadjustment_paymentdocument_and_more.py`

## APIs

- `/api/v1/receipts/`
- `/api/v1/receipts/:id/download/`
- `/api/v1/receipts/:id/send/`
- `/api/v1/payments/:id/documents/`
- `/api/v1/finance/history/`
- `/api/v1/finance/adjustments/`
- `/api/v1/members/:id/financial-history/`

## Services

Generation idempotente de recus, PDF, upload justificatif valide, suppression auditee, journal financier, historique membre, remboursement trace et rapprochement prepare.

## Generation PDF

PDF A4 genere cote backend sans dependance externe additionnelle. Le contenu couvre association, membre, paiement et cotisation.

## Stockage

Les fichiers sont stockes via `FileField`, hors PostgreSQL. `storage_key` et `pdf_url` preparent un stockage S3 avec URL signee.

## Recus

Le numero suit `NVX-YYYY-000001`, genere cote backend depuis le paiement. Un webhook rejoue ne cree pas plusieurs recus.

## Justificatifs

Types centralises : `RECEIPT`, `PROOF_OF_PAYMENT`, `BANK_TRANSFER`, `MOBILE_MONEY_PROOF`, `OTHER`.

## Historique

Journal association et historique membre disponibles avec filtres de base et calcul du `Reste a payer`.

## AuditLog

Evenements ajoutes : `receipt.created`, `receipt.generated`, `receipt.downloaded`, `receipt.sent`, `payment_document.uploaded`, `payment_document.deleted`, `financial_adjustment.created`, `payment.refund_requested`, `payment.refunded`.

## Permissions

Permissions prevues : `receipts.view`, `receipts.download`, `receipts.send`, `payment_documents.view`, `payment_documents.upload`, `payment_documents.delete`, `financial_history.view`, `financial_adjustments.manage`.

## Securite

Verification workspace sur toutes les lectures/ecritures, validation MIME/extension/taille des justificatifs, pas de cache sensible PWA ajoute, pas de secret dans les metadata.

## PWA

Pages ajoutees dans l'app shell. Les webhooks, initialisations et donnees sensibles ne sont pas ajoutes au cache offline.

## Tests

Tests ajoutes pour recu idempotent, webhook avec recu unique, justificatif, historique membre et isolation workspace.

## Resultats

Backend compile et `manage.py check` passent. Les tests Django restent sautes dans l'environnement local car `pytest-django` n'est pas installe.

## Fichiers crees

- `backend/apps/payments/migrations/0002_financialadjustment_paymentdocument_and_more.py`
- `backend/apps/payments/receipt_urls.py`
- `backend/apps/payments/finance_urls.py`
- `frontend/src/features/payments/financial-history-view.tsx`
- `frontend/src/features/members/member-financial-history-view.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/finance/history/page.tsx`
- `frontend/src/app/(workspace)/app/[workspace]/members/[memberId]/financial-history/page.tsx`

## Fichiers modifies

Modeles, services, serializers, views, urls, docs API, navigation et tests payments.

## Problemes rencontres

PostgreSQL local refuse l'authentification lors de `makemigrations`, mais les fichiers de migration sont bien generes. `pytest-django` et `tsc` ne sont pas installes localement.

## Prochaine etape

Prompt 15 : Module recettes et depenses - grand livre financier de l'association.
