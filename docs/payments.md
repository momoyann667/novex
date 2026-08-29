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
