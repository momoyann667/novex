# Variables d'environnement

Voir `.env.example`.

Variables critiques :

- `DJANGO_SECRET_KEY`
- `DATABASE_URL`
- `REDIS_URL`
- `DJANGO_ALLOWED_HOSTS`
- `DJANGO_CORS_ALLOWED_ORIGINS`
- `NEXT_PUBLIC_API_BASE_URL`
- `S3_ENDPOINT_URL`
- `S3_BUCKET_NAME`
- `S3_ACCESS_KEY_ID`
- `S3_SECRET_ACCESS_KEY`
- `SENTRY_DSN`

Production :

- `DJANGO_DEBUG=False`
- HTTPS obligatoire
- cookies secure
- CORS restreint
- HSTS actif

Ne jamais stocker de secret dans le code source.
