# Architecture NOVEX

## Decision principale

NOVEX est construit comme un monorepo :

```text
Next.js frontend
Django REST backend
PostgreSQL
Redis
Celery
Nginx
```

Le frontend consomme l'API REST versionnee `/api/v1`. La logique metier, les permissions, les abonnements, les paiements et l'isolation multi-tenant restent cote backend.

## Multi-tenant

Strategie initiale :

```text
Shared database
Shared schema
workspace_id sur les tables metier
```

Chaque requete workspace doit verifier :

1. utilisateur authentifie ;
2. membership actif ;
3. role ;
4. permissions ;
5. abonnement ;
6. acces a la ressource.

## Separation des surfaces

```text
/auth/*     Authentification
/app/*      Workspace Association, mobile-first/PWA
/admin/*    NOVEX ADMIN, desktop-first
/api/v1/*   Backend REST
```

## Donnees sensibles

Les donnees financieres ne sont pas cachees automatiquement dans la PWA. Les endpoints API restent network-only jusqu'a l'existence d'une strategie offline chiffree, scoping workspace et synchronisation fiable.
