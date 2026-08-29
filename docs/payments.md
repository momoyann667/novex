# Paiements NOVEX

Le module paiements fournit le socle pour encaisser les cotisations en ligne sans lier le coeur metier a un fournisseur unique.

## Statuts

Les statuts sont centralises dans `apps.payments.statuses.PaymentStatus` :

- `PENDING`
- `PROCESSING`
- `SUCCESS`
- `FAILED`
- `CANCELLED`
- `EXPIRED`
- `REFUNDED`
- `PARTIALLY_REFUNDED`

Les transitions autorisees sont explicites dans `ALLOWED_PAYMENT_TRANSITIONS`. Un paiement ne peut crediter une cotisation que via une transition backend controlee vers `SUCCESS`.

## Providers

`apps.payments.providers.PaymentProvider` definit l'interface :

- `initialize_payment`
- `validate_webhook`
- `extract_transaction`

Le provider actuel est `env_hmac`, un adaptateur generique de developpement. Il ne stocke aucune donnee carte, PIN, CVV ou secret frontend. Les webhooks sont acceptes uniquement si `NOVEX_PAYMENT_WEBHOOK_SECRET` est configure cote serveur et si `X-Provider-Signature` correspond a un HMAC SHA256 du JSON canonique du payload.

Variables attendues :

```text
NOVEX_PAYMENT_WEBHOOK_SECRET=
```

Sans secret, les initialisations restent possibles pour tester le flux interne, mais aucun webhook ne peut confirmer un paiement.

## API

`POST /api/v1/payments/initialize/`

Initialise un paiement de cotisation. Le backend verifie le workspace, la cotisation, le membre, le montant positif et `amount <= contribution.remaining_amount`. L'idempotence est portee par `idempotency_key`.

`POST /api/v1/payments/webhooks/{provider}/`

Rejoue l'evenement provider de maniere idempotente avec `X-Provider-Event-ID` et `X-Provider-Signature`. Le backend retrouve le paiement par reference verifiee, controle montant/devise, applique la machine d'etat et met a jour la cotisation dans une transaction atomique avec verrouillage.

`GET /api/v1/payments/result/?reference=...`

Retourne le statut persiste du paiement. La page retour ne se fie jamais aux parametres frontend.

`POST /api/v1/payments/{id}/refund/`

Prepare le remboursement complet ou partiel. Aucun remboursement provider reel n'est execute tant qu'un connecteur compatible n'est pas branche.

## Audit

Chaque changement metier cree un `PaymentEvent` et un `AuditLog`. Les metadata sont expurgees des cles contenant `secret`.

## Recus

Un paiement confirme genere un `Receipt` idempotent. Le numero metier suit la convention `NVX-YYYY-000001`, est produit cote backend, puis un PDF A4 est stocke via `FileField` hors base de donnees.

Endpoints :

```text
GET  /api/v1/receipts/
GET  /api/v1/receipts/:id/
GET  /api/v1/receipts/:id/download/
POST /api/v1/receipts/:id/send/
```

Le telechargement passe par une vue authentifiee avec verification du workspace. Une URL directe de stockage ne doit pas etre consideree publique; pour S3, brancher des URLs signees a expiration dans le service de stockage.

## Justificatifs

Les justificatifs de paiement manuel sont portes par `PaymentDocument`.

Types :

```text
RECEIPT
PROOF_OF_PAYMENT
BANK_TRANSFER
MOBILE_MONEY_PROOF
OTHER
```

Validations upload :

- taille maximale 10 Mo ;
- extensions `.pdf`, `.jpg`, `.jpeg`, `.png`, `.webp` ;
- MIME types `application/pdf`, `image/jpeg`, `image/png`, `image/webp` ;
- permission et workspace controles par l'API.

Le champ `scan_status` prepare l'integration antivirus. Tant qu'aucun scanner n'est configure, la valeur reste `NOT_CONFIGURED`.

## Historique financier

`GET /api/v1/finance/history/` expose le journal association extensible : cotisations, paiements, remboursements et ajustements. Les filtres disponibles sont `date_from`, `date_to`, `member`, `reference` et `status`.

`GET /api/v1/members/:id/financial-history/` donne l'historique financier d'un membre avec `Total cotisations`, `Total paye`, `Reste a payer`, nombre de paiements, retards et dernier paiement.

## Rapprochement et ajustements

`Payment.reconciliation_status` prepare le rapprochement avec contribution puis transaction bancaire future :

```text
UNMATCHED
MATCHED
REVIEW_REQUIRED
```

`FinancialAdjustment` prepare les corrections futures. La creation est auditee via `financial_adjustment.created` et valide explicitement que payment, contribution et membre appartiennent au workspace courant.
