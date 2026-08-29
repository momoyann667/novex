# NOVEX - Audit 01/10

Date : 2026-08-28

## 1. Stack actuelle

Frontend : non identifiable. Aucun fichier applicatif n'est present dans le workspace fourni.

Backend : non identifiable. Aucun serveur, API, framework backend ou configuration runtime n'a ete trouve.

Database : non identifiable. Aucun schema, migration, ORM ou configuration base de donnees n'a ete trouve.

Auth : non identifiable. Aucun systeme d'authentification n'a ete trouve.

UI : non identifiable. Aucun composant UI, systeme CSS, theme ou design system n'a ete trouve.

PWA : inexistante dans le workspace audite. Aucun manifest, service worker ou configuration PWA n'a ete trouve.

Testing : inexistant dans le workspace audite. Aucun framework de tests ou script de test n'a ete trouve.

Deployment : non identifiable. Aucun Dockerfile, configuration CI/CD, hosting config ou script de deploiement n'a ete trouve.

## 2. Architecture actuelle

Le workspace audite est :

`C:\Users\habib\Documents\Codex\2026-08-28\files-mentioned-by-the-user-novex`

Structure constatee :

```text
files-mentioned-by-the-user-novex/
  outputs/
  work/
```

Il n'y a actuellement pas de depot Git, pas de code source, pas de fichier de configuration projet, pas de dependances, pas de backend, pas de frontend et pas de base de donnees dans le workspace fourni.

Une recherche dans `C:\Users\habib\Documents\Codex` n'a trouve aucun marqueur de projet courant : pas de `package.json`, pas de lockfile, pas de `.git`, pas de `prisma.schema`, pas de `pyproject.toml`, pas de `composer.json`, pas de `go.mod`.

Conclusion : l'audit technique d'un projet NOVEX existant ne peut pas etre effectue tant que le code source reel n'est pas present dans le workspace.

## 3. Problemes identifies

### CRITIQUE

- Code source absent : impossible d'auditer la structure, la securite, le routing, les API, la base de donnees, les composants UI, la PWA, les tests ou le deploiement.
- Stack non determinee : aucune decision technique existante ne peut etre confirmee ou conservee.
- Absence de depot Git : impossible de controler l'historique, les changements existants ou les regressions.

### IMPORTANT

- Aucun systeme multi-tenant observable : la separation Workspace / Association / permissions ne peut pas etre verifiee.
- Aucun modele de donnees observable : impossible de valider l'evolutivite vers les entites cible NOVEX.
- Aucun dispositif PWA observable : installabilite, cache, offline readiness et mise a jour service worker non verifies.
- Aucun test observable : impossible de mesurer les garanties actuelles.
- Aucun fichier d'environnement exemple observable : impossible de verifier la gestion des secrets et variables d'environnement.

### AMELIORATION

- Quand le projet sera disponible, documenter explicitement l'architecture dans un `README.md` ou un dossier `docs/`.
- Ajouter une checklist d'audit securite et multi-tenant avant toute implementation finance.
- Ajouter une base de design tokens avant le developpement du design system.

## 4. Architecture recommandee

L'architecture cible doit rester progressive et eviter une migration massive sans base existante.

### Separation des environnements

Deux surfaces doivent etre separees des le routing et les layouts :

```text
/app/...        Workspace Association, mobile-first et PWA
/admin/...      Back-office NOVEX, desktop-first et data-driven
```

Les deux environnements doivent avoir :

- layouts distincts ;
- navigation distincte ;
- permissions distinctes ;
- loaders/API scopes distincts ;
- controles serveur obligatoires.

### Multi-tenant

Modele conceptuel recommande :

```text
User
  -> WorkspaceMember
  -> Workspace
  -> Association
  -> Domain data
```

Regle centrale : toute ressource metier doit etre rattachee directement ou indirectement a un `workspace_id`. Les requetes serveur doivent filtrer par workspace autorise, jamais uniquement par un identifiant fourni par le frontend.

### Domaine fonctionnel progressif

Priorite de fondation :

1. `User`, `Profile`
2. `Workspace`, `WorkspaceMember`, `Role`, `Permission`
3. `Association`
4. `Plan`, `Subscription`
5. `AuditLog`

Ensuite seulement :

- membres ;
- cotisations ;
- recettes ;
- depenses ;
- documents ;
- projets ;
- evenements ;
- rapports ;
- IA.

### SaaS et plans

Plans cibles :

- `freemium` : essai automatique de 14 jours ;
- `novex_start` : gestion essentielle, sans paiement automatise des cotisations ;
- `novex_pro` : paiements, automatisations, analytics avances, IA avancee.

Le modele d'abonnement doit stocker au minimum :

- plan ;
- statut : `trial`, `active`, `past_due`, `expired`, `suspended`, `cancelled` ;
- date de debut ;
- date d'expiration ;
- date de fin effective si applicable ;
- workspace concerne ;
- source de paiement future.

### PWA

Fondation PWA progressive recommandee :

- `manifest.webmanifest` ;
- icones multi-tailles ;
- theme color et background color ;
- service worker limite au cache des assets statiques au depart ;
- detection online/offline ;
- strategie de mise a jour visible ;
- preparation future de background sync ;
- pas de cache agressif des donnees financieres sans strategie de coherence.

### Securite

Principes obligatoires :

- controle d'acces cote serveur ;
- validation des entrees ;
- filtrage systematique par workspace ;
- audit trail sur les operations financieres ;
- logs sans secrets ni donnees sensibles inutiles ;
- stockage de fichiers avec ownership et permissions ;
- defense XSS ;
- protection CSRF si sessions/cookies ;
- rate limiting sur auth et endpoints sensibles.

Audit trail cible :

```text
Utilisateur
Action
Date/heure
Workspace
Ressource
Ancienne valeur
Nouvelle valeur
Adresse IP / user agent si pertinent
```

### Performance

Principes recommandes :

- dashboards charges par blocs ;
- pagination des tableaux ;
- lazy loading des routes lourdes ;
- code splitting ;
- cache HTTP/API controle ;
- optimisation des images ;
- requetes agregees pour KPI ;
- virtualisation pour gros tableaux ;
- pas de chargement global de toutes les donnees au demarrage.

## 5. Plan de travail

1. Fournir ou placer le code source NOVEX dans le workspace.
2. Refaire l'audit sur le vrai depot : structure, dependances, routes, auth, base de donnees, tests, securite, PWA.
3. Identifier la stack reelle et decider si elle est conservee.
4. Corriger uniquement les problemes fondamentaux qui bloquent une base saine.
5. Poser la separation minimale `/app` et `/admin` si elle n'existe pas deja.
6. Poser ou verifier le modele multi-tenant minimal : `Workspace`, `WorkspaceMember`, roles et permissions.
7. Poser ou verifier la base SaaS : plans, trial 14 jours, statuts d'abonnement.
8. Preparer la fondation PWA sans offline complexe.
9. Lancer le prompt suivant sur le Design System NOVEX.

## Modifications effectuees

Aucune modification applicative n'a ete effectuee, car aucun projet applicatif n'est present.

Fichier cree :

- `outputs/audit-novex-01.md`

Objectif du fichier : conserver un rapport d'audit initial exploitable et tracer clairement que le blocage vient de l'absence de code source dans le workspace fourni.

## Risques

- Le rapport ne remplace pas un audit du vrai code source.
- Toute recommandation technique reste volontairement generique tant que la stack reelle n'est pas connue.
- Il ne faut pas commencer le Design System ou l'architecture applicative avant d'avoir confirme si un projet NOVEX existe deja ailleurs.
