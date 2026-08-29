# NOVEX - Prompt maitre - Rapport de socle technique

Date : 2026-08-29

## 1. Audit initial

Avant cette etape, le workspace contenait uniquement les livrables statiques des prompts 01 a 06 dans `outputs/`. Aucun repository applicatif, framework, backend, frontend, base de donnees, tests ou Docker n'etait present.

## 2. Architecture finale

Un monorepo NOVEX a ete cree :

- `frontend/` : Next.js + TypeScript + Tailwind.
- `backend/` : Django + Django REST Framework.
- `infra/` : Nginx.
- `docs/` : documentation technique.
- `.github/workflows/` : CI.

## 3. Stack

- Next.js `^16.3.3`
- React `^19.1.0`
- TypeScript `^5.7.3`
- Tailwind CSS `^3.4.17`
- TanStack Query `^5.85.0`
- React Hook Form `^7.62.0`
- Zod `^3.25.0`
- Lucide React `^0.468.0`
- Django `>=6.1,<6.2`
- Django REST Framework `>=3.18,<3.19`
- Python `>=3.12`
- PostgreSQL 16
- Redis 7
- Celery 5.5
- Nginx 1.27

## 4. Frontend

Architecture creee :

- `frontend/src/app`
- `frontend/src/components/ui`
- `frontend/src/components/layout`
- `frontend/src/features/auth`
- `frontend/src/lib/api`
- `frontend/src/lib/query`
- `frontend/public`

Routes posees :

- `/`
- `/auth/login`
- `/auth/register`
- `/app/[workspace]/dashboard`
- `/admin`

## 5. Backend

Architecture creee :

- `backend/config/settings`
- `backend/apps/users`
- `backend/apps/workspaces`
- `backend/apps/members`
- `backend/apps/subscriptions`
- `backend/apps/audit_logs`
- `backend/common`

API versionnee :

- `/api/v1/auth/`
- `/api/v1/workspaces/`
- `/api/v1/members/`
- `/api/v1/subscriptions/`

## 6. Database

Modeles initiaux :

- `User`
- `Profile`
- `Workspace`
- `Role`
- `Permission`
- `RolePermission`
- `WorkspaceMembership`
- `OrganizationProfile`
- `Member`
- `Plan`
- `Subscription`
- `AuditLog`

PostgreSQL est la reference de developpement et production. SQLite n'est utilise que dans les settings de test.

## 7. Multi-tenancy

La strategie retenue est :

```text
shared database + shared schema + workspace_id
```

Les donnees metier comme `Member` sont scopees par `workspace`. Les permissions DRF de fondation imposent un membership actif.

## 8. Authentication

Une base d'inscription DRF est creee :

- validation serveur ;
- hash mot de passe par Django ;
- consentement conditions ;
- creation Profile.

La strategie complete access/refresh token reste a brancher dans le prochain passage d'implementation auth.

## 9. Authorization

RBAC initial :

- roles par workspace ;
- permissions explicites ;
- `RequireWorkspacePermission` ;
- separation future de NOVEX ADMIN par role plateforme.

## 10. PWA

Fichiers PWA dans `frontend/public` :

- `manifest.webmanifest`
- `sw.js`
- icones SVG 192/512/maskable

Strategie : cache assets/app shell, pas de cache API automatique.

## 11. Redis / Celery

Configuration :

- `REDIS_URL`
- `CELERY_BROKER_URL`
- `CELERY_RESULT_BACKEND`
- `backend/config/celery.py`
- services `celery` et `celery-beat` dans Docker Compose.

## 12. Storage

Variables S3-compatible preparees dans `.env.example`. L'integration stockage reelle sera branchee au module documents.

## 13. Docker

Services :

- `postgres`
- `redis`
- `backend`
- `celery`
- `celery-beat`
- `frontend`
- `nginx`

## 14. Tests

Tests crees :

- placeholder backend multi-tenant.

Tests non executes :

- dependances non installees dans cet environnement.
- pas de lockfiles generes.

## 15. CI/CD

GitHub Actions cree :

- typecheck frontend ;
- lint frontend ;
- build frontend ;
- ruff backend ;
- pytest backend ;
- PostgreSQL et Redis en services CI.

## 16. Securite

Mesures posees :

- `.env.example` sans secrets reels ;
- `.gitignore` protege secrets/env ;
- secure headers Next.js ;
- settings Django production avec cookies secure/HSTS selon DEBUG ;
- CORS restreint par env ;
- pagination max 100 ;
- permissions workspace ;
- API non cachee par service worker ;
- request id middleware ;
- documentation securite.

## 17. Documentation

Fichiers crees :

- `README.md`
- `docs/architecture.md`
- `docs/environment.md`
- `docs/api.md`
- `docs/security.md`
- `docs/pwa.md`
- `docs/deployment.md`

## 18. Problemes

- Les dependances n'ont pas ete installees, donc aucun build/test reel n'a ete execute.
- Les migrations Django initiales devront etre generees avec `python manage.py makemigrations`.
- Le bouton UI utilise une primitive Radix compatible shadcn/ui.
- L'auth JWT/refresh token reste a finaliser.

## 19. Decisions techniques

- Monorepo pour garder frontend/backend/docs/infra synchronises.
- Next.js App Router pour `/auth`, `/app`, `/admin`.
- Django/DRF comme source de verite metier.
- PostgreSQL pour integrite relationnelle.
- Redis/Celery pour taches asynchrones.
- PWA prudente : pas de cache des donnees sensibles.
- Shared schema multi-tenant pour demarrer sans complexite excessive.

## 20. Prochaine etape

1. Installer les dependances et generer les lockfiles.
2. Generer et verifier les migrations Django.
3. Remplacer auth session/token placeholder par JWT access + refresh token cookie secure.
4. Seeder roles, permissions et plans.
5. Ajouter tests IDOR reels.
6. Integrer shadcn/ui completement via composants generes.
7. Brancher service worker registration cote frontend.
8. Ajouter modules Dashboard et Membres progressivement.
