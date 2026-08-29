# NOVEX - Auth + Onboarding Route Blueprint

## Public

```text
GET  /                         Landing
GET  /auth/register            Creer mon compte
POST /api/auth/register
GET  /auth/verify-email        Verification email
POST /api/auth/resend-verification
GET  /auth/login               Se connecter a NOVEX
POST /api/auth/login
POST /api/auth/logout
GET  /auth/forgot-password
POST /api/auth/forgot-password
GET  /auth/reset-password
POST /api/auth/reset-password
GET  /invitation/:token        Invitation publique
```

## Authenticated

```text
GET  /onboarding
POST /api/onboarding/workspace
PATCH /api/onboarding/state
POST /api/invitations/:token/accept
POST /api/invitations/:token/decline
GET  /profile
PATCH /api/profile
POST /api/profile/change-password
GET  /app/:workspace/dashboard
```

## Workspace Settings

```text
GET   /app/:workspace/settings/profile
PATCH /api/workspaces/:workspace/profile
GET   /app/:workspace/settings/users
POST  /api/workspaces/:workspace/invitations
PATCH /api/workspaces/:workspace/users/:userId/role
PATCH /api/workspaces/:workspace/users/:userId/suspend
DELETE /api/workspaces/:workspace/users/:userId
```

## NOVEX Admin

```text
GET /admin
```

Access to `/admin` must use internal NOVEX admin roles, not association workspace roles.

## Route Guards

```text
Public route:
  allow anonymous.

Authenticated route:
  require valid session.
  if user has no workspace and route is not onboarding/profile/invitation:
    redirect /onboarding.

Workspace route:
  require valid session.
  resolve workspace by slug.
  require active WorkspaceMember.
  require permission for route.

NOVEX Admin route:
  require valid session.
  require active novex_admin_members row.
```

## Post-login Routing

```text
if pending invitation token:
  redirect invitation acceptance.
else if zero workspace:
  redirect /onboarding.
else if one workspace:
  redirect /app/:workspace/dashboard.
else if last workspace exists and still authorized:
  redirect /app/:lastWorkspace/dashboard.
else:
  redirect workspace selector.
```
