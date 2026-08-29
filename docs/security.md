# Securite

## Priorites

- Authentification serveur.
- RBAC par workspace.
- Separation Association / NOVEX ADMIN.
- Protection IDOR.
- Validation serveur.
- Rate limiting sur endpoints sensibles.
- Logs sans secrets.
- Webhooks paiement verifies et idempotents.

## Regles multi-tenant

Toute table metier doit contenir un lien vers `Workspace`.

Mauvais :

```text
Member.objects.all()
```

Correct :

```text
Member.objects.filter(workspace=current_workspace)
```

## Admin

Les roles association ne donnent jamais acces a `/admin`. L'admin doit utiliser un role interne de plateforme.
