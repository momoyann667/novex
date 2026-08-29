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
