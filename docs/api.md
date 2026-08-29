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
```

Les endpoints workspace doivent recevoir un contexte workspace fiable, puis le backend doit verifier le membership actif. Le frontend ne prouve jamais seul l'autorisation.
