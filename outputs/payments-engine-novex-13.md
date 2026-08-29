# NOVEX Prompt 13 - Payment Engine

Travail realise :

- Abstraction provider `PaymentProvider` avec initialisation, validation webhook et extraction transaction.
- Statuts et methodes centralises dans `apps.payments.statuses`.
- Modele `Payment` enrichi : reference, provider, methode, checkout URL, frais provider/NOVEX, net amount, transaction provider et metadata.
- Journal `PaymentEvent` pour initialisation, processing, success, failure, cancellation, refund et webhooks.
- API `initialize`, `result`, `dashboard`, `refund` et webhook generique.
- Webhook idempotent avec signature HMAC serveur via `NOVEX_PAYMENT_WEBHOOK_SECRET`.
- Mise a jour atomique des cotisations avec `select_for_update` et blocage du surpaiement.
- UI paiements : dashboard, initialisation rapide, filtres, table history, detail et page resultat.
- Tests backend : idempotence, surpaiement, webhook signe, signature invalide.

Important :

- Aucun vrai fournisseur de paiement n'est connecte.
- Aucun secret ou donnees carte/PIN/CVV n'est stocke ou expose au frontend.
- Sans `NOVEX_PAYMENT_WEBHOOK_SECRET`, aucun webhook ne peut valider un paiement.
