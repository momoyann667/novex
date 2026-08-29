# Deploiement

Architecture cible :

```text
Internet
  -> Nginx
    -> Next.js frontend
    -> Django API
  -> PostgreSQL
  -> Redis
  -> Celery workers
  -> S3-compatible storage
```

Environnements :

- development
- staging
- production

Production :

- secrets via environnement ;
- migrations Django controlees ;
- collecte assets statiques ;
- backup PostgreSQL ;
- monitoring erreurs ;
- health checks `/health/` et `/ready/`.
