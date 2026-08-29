# NOVEX

NOVEX est un SaaS multi-tenant de gestion des associations, syndicats, ONG, mutuelles, cooperatives et organisations communautaires en Cote d'Ivoire et en Afrique francophone.

## Stack

- Frontend : Next.js, TypeScript strict, Tailwind CSS, composants style shadcn/ui, Lucide React.
- Backend : Django, Django REST Framework, API REST `/api/v1`.
- Database : PostgreSQL.
- Async/cache : Redis, Celery, Celery Beat.
- PWA : manifest, service worker, app shell mobile-first.
- Infrastructure : Docker Compose, Nginx reverse proxy.
- Qualite : ESLint, TypeScript, Ruff, pytest, GitHub Actions.

## Architecture

```text
frontend/   Next.js app router, PWA, Association workspace, NOVEX Admin
backend/    Django/DRF API, multi-tenant, RBAC, subscriptions, audit logs
infra/      Nginx
docs/       Documentation technique
outputs/    Livrables des prompts precedents
```

## Development

```bash
cp .env.example .env
docker compose up --build
```

Frontend : `http://localhost:3000`

Backend : `http://localhost:8000`

API docs : `http://localhost:8000/api/docs/`

## Tests

```bash
npm run typecheck:frontend
npm run lint:frontend
npm run test:backend
```

## Security

- Ne jamais committer de secrets.
- Le backend applique toujours l'isolation workspace et les permissions.
- Les donnees financieres ne doivent pas etre stockees en `float`.
- Les webhooks paiement devront etre verifies et idempotents.

## Documentation

Voir `docs/`.
