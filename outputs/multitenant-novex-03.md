# NOVEX - Prompt 03/10 - Multi-Tenant + Workspaces + Organisations

Date : 2026-08-28

## Contexte reel

Le projet applicatif NOVEX n'est toujours pas present dans le workspace. Les seuls fichiers disponibles sont les livrables des prompts 01 et 02. Il n'existe donc pas de backend, frontend, ORM, routing, migration, auth ou tests dans lesquels integrer directement le systeme multi-tenant.

Pour avancer proprement sans inventer une fausse application, j'ai cree une fondation technique portable :

- schema SQL cible ;
- matrice roles, permissions, plans, limites et entitlements ;
- gardes serveur TypeScript de reference ;
- plan de tests multi-tenant ;
- present rapport.

## Architecture

Architecture cible mise en forme :

```text
User
  -> WorkspaceMember
  -> Workspace
  -> OrganizationProfile
  -> Donnees metier scopees par workspace_id

Workspace
  -> Subscription
  -> Plan

Workspace
  -> AuditLog
```

Principe critique :

- `Workspace` est l'unite d'isolation.
- `User` est un compte NOVEX.
- `Member` est une personne membre d'une association.
- `User` et `Member` restent separes.
- L'abonnement appartient au `Workspace`.
- NOVEX ADMIN utilise ses propres roles internes, independants des roles association.

## Modeles

Modeles proposes dans `novex-multitenant-schema.sql` :

- `users`
- `profiles`
- `workspaces`
- `workspace_members`
- `roles`
- `permissions`
- `role_permissions`
- `organization_profiles`
- `plans`
- `subscriptions`
- `workspace_invitations`
- `novex_admin_members`
- `audit_logs`
- `association_members` comme exemple minimal futur, scope par `workspace_id`

Le schema inclut les statuts demandes :

- Workspace : `active`, `suspended`, `archived`
- WorkspaceMember : `invited`, `active`, `suspended`, `removed`
- Invitation : `pending`, `accepted`, `expired`, `cancelled`
- Subscription : `trial`, `active`, `past_due`, `expired`, `suspended`, `cancelled`

## API

Aucune route applicative n'a ete modifiee, car aucune API n'existe dans le workspace.

Routes recommandees pour integration future :

```text
GET    /api/workspaces
POST   /api/workspaces
GET    /api/workspaces/:workspaceSlug
PATCH  /api/workspaces/:workspaceSlug

GET    /api/workspaces/:workspaceSlug/users
POST   /api/workspaces/:workspaceSlug/invitations
PATCH  /api/workspaces/:workspaceSlug/users/:userId/role
PATCH  /api/workspaces/:workspaceSlug/users/:userId/suspend
DELETE /api/workspaces/:workspaceSlug/users/:userId

POST   /api/invitations/:token/accept
POST   /api/invitations/:token/decline

GET    /api/workspaces/:workspaceSlug/audit-logs
GET    /api/workspaces/:workspaceSlug/subscription
```

Toutes les routes metier futures doivent resoudre le workspace autorise cote serveur avant toute requete data.

## Frontend

Aucun composant applicatif n'a ete modifie, car aucun frontend n'existe dans le workspace.

Composants recommandes pour integration future :

- `WorkspaceSwitcher`
- `CreateWorkspaceWizard`
- `InviteWorkspaceUserForm`
- `AcceptInvitationView`
- `WorkspaceUsersTable`
- `RoleSelect`
- `WorkspaceAccessDenied`
- `PlanLimitNotice`
- `FeatureLockedNotice`

Ils devront consommer le design system du prompt 02.

## Permissions

La matrice est fournie dans `novex-permissions.json`.

Roles association :

- `OWNER`
- `ADMIN`
- `PRESIDENT`
- `TREASURER`
- `SECRETARY`
- `PROJECT_MANAGER`
- `MEMBER`

Roles NOVEX ADMIN :

- `SUPER_ADMIN`
- `ADMIN`
- `SUPPORT`
- `FINANCE`
- `ANALYST`

Permissions principales couvertes :

- membres ;
- cotisations ;
- recettes ;
- depenses ;
- projets ;
- evenements ;
- documents ;
- rapports ;
- parametres ;
- utilisateurs workspace ;
- audit logs.

Entitlements prepares :

- `online_contributions`
- `advanced_reports`
- `ai_assistant`
- `advanced_analytics`
- `automations`
- `payment_integrations`

Plans prepares :

- `FREEMIUM` avec essai 14 jours ;
- `NOVEX_START` ;
- `NOVEX_PRO`.

## Securite

Protections posees comme fondation :

- resolution serveur obligatoire du membership via `requireWorkspaceAccess` ;
- refus des utilisateurs suspendus, supprimes ou non authentifies ;
- refus des `WorkspaceMember` suspendus, retires ou seulement invites ;
- permissions par workspace ;
- verification d'entitlements cote serveur ;
- cache keys scopees par workspace via `workspace:{workspaceId}:{key}` ;
- fonction `assertSameWorkspace` pour proteger les ressources chargees individuellement ;
- separation logique entre roles association et roles NOVEX ADMIN ;
- audit log pour actions sensibles.

Regle centrale d'implementation :

Le frontend peut transporter un slug ou un contexte UI, mais le backend doit toujours transformer ce contexte en `workspaceId` autorise depuis la session utilisateur. Les requetes metier ne doivent jamais utiliser un `workspace_id` brut fourni par le client comme preuve d'autorisation.

## Tests

Fichier cree :

- `novex-multitenant-test-plan.md`

Tests couverts :

- isolation Workspace A/B ;
- protection IDOR ;
- permissions Treasurer vs Owner ;
- invitation valide ;
- invitation expiree ;
- switch workspace ;
- trial Freemium 14 jours ;
- feature access Start vs Pro ;
- protection du dernier owner ;
- separation NOVEX ADMIN.

Tests executes :

- Aucun test automatise execute, car aucun projet applicatif ni runner de test n'est present.

## Migration

Aucune migration de donnees executee.

Raison :

- aucune base de donnees existante ;
- aucun ORM ;
- aucune donnee projet observable.

Quand le vrai projet sera fourni, la strategie de migration devra :

1. identifier les tables metier existantes ;
2. ajouter `workspace_id` sans suppression ;
3. backfiller les donnees existantes vers un workspace par defaut controle ;
4. ajouter les contraintes et index ;
5. activer les guards serveur ;
6. tester les scenarios IDOR avant production.

## Fichiers crees

- `outputs/novex-permissions.json`
- `outputs/novex-multitenant-schema.sql`
- `outputs/novex-multitenant-guards.ts`
- `outputs/novex-multitenant-test-plan.md`
- `outputs/multitenant-novex-03.md`

## Risques

### Critique

- La fondation n'est pas integree a une application reelle parce que le code source est absent.
- Les criteres d'acceptation interactifs ne peuvent pas etre executes sans backend, frontend, auth et base de donnees.

### Important

- Le schema SQL devra etre adapte a l'ORM reel.
- Les gardes TypeScript devront etre branches a la session/auth reelle.
- Les roles systeme devront etre seeds au moment de la creation du workspace.

### A surveiller

- Proteger le dernier OWNER doit etre fait transactionnellement.
- Les documents et rapports devront toujours verifier le workspace avant generation ou telechargement.
- Les caches doivent etre invalides au changement de workspace.

## Prochaine integration recommandee

Quand le code source NOVEX sera present :

1. identifier auth/session et ORM ;
2. creer les migrations multi-tenant ;
3. ajouter les seeds roles/permissions/plans ;
4. integrer `requireWorkspaceAccess` dans le middleware serveur ;
5. creer les routes workspace et invitation ;
6. creer le `WorkspaceSwitcher` avec invalidation cache ;
7. ajouter les tests IDOR et permissions avant tout module metier profond.
