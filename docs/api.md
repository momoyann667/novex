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
POST /api/v1/contributions/campaigns/
POST /api/v1/contributions/campaigns/:id/generate/
GET  /api/v1/payments/
POST /api/v1/payments/manual/
POST /api/v1/payments/webhooks/:provider/
```

Les endpoints workspace doivent recevoir un contexte workspace fiable, puis le backend doit verifier le membership actif. Le frontend ne prouve jamais seul l'autorisation.
