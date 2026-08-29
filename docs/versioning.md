# Versioning NOVEX

## Objectif

Ce document definit le workflow Git/GitHub recommande pour NOVEX.

## Branches

- `main` : branche stable, toujours deployable.
- `develop` : integration des prochaines fonctionnalites.
- `feature/<nom>` : nouvelle fonctionnalite.
- `fix/<nom>` : correction non urgente.
- `hotfix/<nom>` : correction urgente depuis `main`.

## Premier raccordement GitHub

Depuis la racine du projet :

```bash
git status
git add .
git commit -m "chore: initialize NOVEX technical foundation"
git remote add origin https://github.com/<owner>/<repo>.git
git push -u origin main
git checkout -b develop
git push -u origin develop
```

Remplacer `<owner>/<repo>` par le depot GitHub reel.

## Convention de commits

Utiliser Conventional Commits :

```text
feat: add workspace switcher
fix: prevent cross-workspace member access
chore: configure docker services
docs: document PWA strategy
test: add IDOR coverage
refactor: extract workspace permission guard
```

## Pull requests

Chaque PR doit indiquer :

- objectif ;
- fichiers principaux ;
- risques ;
- tests executes ;
- impact multi-tenant ;
- impact securite ;
- screenshots si UI.

## Protections recommandees sur GitHub

Configurer sur `main` :

- pull request obligatoire ;
- CI obligatoire ;
- interdiction de push direct ;
- au moins une review ;
- conversation resolution obligatoire ;
- protection contre la suppression de branche.

Configurer sur `develop` :

- CI obligatoire ;
- PR obligatoire si plusieurs contributeurs.

## Tags et releases

Format :

```text
v0.1.0
v0.2.0
v1.0.0
```

Regle semver :

- MAJOR : rupture importante.
- MINOR : nouvelle fonctionnalite compatible.
- PATCH : correction.

## Checklist avant merge

- `npm run typecheck:frontend`
- `npm run lint:frontend`
- `npm run build:frontend`
- `npm run lint:backend`
- `npm run test:backend`
- migration Django verifiee si modele modifie ;
- pas de secret dans le diff ;
- routes workspace protegees cote backend ;
- pas de cache PWA de donnees sensibles.
