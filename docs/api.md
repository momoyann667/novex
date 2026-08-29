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
