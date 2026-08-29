# NOVEX - Prompt 05/10 - PWA complete + installation + offline + mise a jour

Date : 2026-08-29

## Contexte reel

Le code source NOVEX n'est toujours pas present dans le workspace. Il n'existe donc pas de framework, routing, build, service worker existant, manifest existant ou configuration PWA a modifier.

J'ai cree une fondation PWA concrete sous forme de fichiers statiques autonomes, relies au Design System du prompt 02. Elle peut etre servie via localhost ou HTTPS pour tester l'enregistrement du service worker et l'installabilite navigateur.

## PWA

Fichiers crees :

- `novex-pwa-app-shell.html`
- `novex-pwa-manifest.webmanifest`
- `novex-pwa-service-worker.js`
- `novex-pwa-client.js`
- `novex-icon-192.svg`
- `novex-icon-512.svg`
- `novex-icon-maskable.svg`
- `novex-pwa-test-plan.md`
- `pwa-novex-05.md`

La PWA couvre :

- App Shell ;
- manifest ;
- service worker ;
- cache des assets statiques ;
- mode standalone ;
- detection online/offline ;
- invite d'installation non agressive ;
- detection app installee ;
- update available ;
- safe areas mobiles ;
- bottom navigation mobile ;
- action rapide mobile ;
- dashboard initial vide ;
- non-cache des API sensibles.

## Manifest

Configuration :

- `name`: NOVEX
- `short_name`: NOVEX
- `description`: NOVEX - gestion moderne des associations, syndicats, ONG et organisations communautaires.
- `start_url`: `./novex-pwa-app-shell.html`
- `scope`: `./`
- `display`: `standalone`
- `orientation`: `portrait-primary`
- `theme_color`: `#0b4ed8`
- `background_color`: `#f6f8fb`
- `lang`: `fr-CI`
- icons : 192, 512, maskable

Dans la vraie app, `start_url` devra pointer vers la route qui applique le post-login routing :

```text
session absente -> login
session active + workspace -> dashboard
session active sans workspace -> onboarding
plusieurs workspaces -> dernier workspace ou selecteur
```

## Service Worker

Strategie utilisee :

- version : `novex-pwa-v1.0.0`
- installation : mise en cache de l'App Shell et des assets essentiels ;
- activation : suppression des anciens caches NOVEX ;
- navigation : network first, fallback vers App Shell ;
- static assets : cache first apres premiere recuperation ;
- API : network-only.

Les requetes contenant `/api/` ne sont pas cachees. C'est volontaire pour eviter de stocker aveuglement des donnees privees, financieres ou sensibles.

## Cache

Mis en cache :

- HTML App Shell ;
- CSS Design System ;
- client PWA JS ;
- manifest ;
- icones.

Non mis en cache automatiquement :

- endpoints API ;
- cotisations ;
- recettes ;
- depenses ;
- paiements ;
- soldes ;
- documents ;
- rapports.

Raison : les donnees sensibles doivent attendre une strategie offline transactionnelle, chiffrement eventuel, expiration, invalidation workspace et controles serveur.

## Offline

Fonctionne hors connexion apres un premier chargement :

- App Shell ;
- navigation structurelle ;
- dashboard vide/skeleton ;
- indication `Hors connexion` ;
- message de statut discret.

Ne fonctionne pas encore hors connexion :

- mutations metier ;
- operations financieres ;
- chargement de donnees jamais vues ;
- import/export ;
- documents sensibles.

## Installation

La logique client gere :

- `beforeinstallprompt` ;
- bouton `Installer NOVEX` ;
- bouton `Plus tard` avec cooldown local de 7 jours ;
- `appinstalled` ;
- detection `display-mode: standalone` ;
- masquage du CTA si l'app est deja installee.

Navigateurs a tester dans une vraie app servie en HTTP localhost ou HTTPS :

- Chrome desktop ;
- Edge desktop ;
- Chrome Android ;
- Safari iOS via ajout a l'ecran d'accueil.

## Responsive

Mobile :

- viewport `viewport-fit=cover` ;
- safe areas ;
- header compact ;
- bottom navigation ;
- bouton d'action rapide ;
- cartes KPI empilees ;
- skeletons au lieu de spinner plein ecran.

Tablet :

- grille adaptee ;
- navigation utilisable ;
- contenu non surcharge.

Desktop Association :

- sidebar ;
- header ;
- grille dashboard ;
- tables et KPI possibles.

## NOVEX ADMIN

NOVEX ADMIN n'a pas ete transforme en experience mobile-first. La PWA cible principalement l'application Association.

Si le manifest et le service worker sont partages dans la vraie app, l'admin devra conserver :

- layout desktop-first ;
- densite KPI/tableaux ;
- routes admin protegees ;
- cache prudent ou desactive pour donnees internes sensibles.

## Securite

Protections mises en place dans cette fondation :

- aucune API mise en cache automatiquement ;
- service worker limite aux assets et a l'App Shell ;
- pas de stockage de token ;
- pas de stockage de donnees financieres ;
- fallback offline sans contournement auth ;
- message explicite indiquant que les guards serveur restent obligatoires.

Protections a appliquer dans la vraie application :

- HTTPS en production ;
- cookies securises ;
- auth serveur avant toute route privee ;
- workspace guards avant toute API ;
- cache keys scopees par workspace si cache data futur ;
- invalidation cache au changement de workspace ;
- politique de retention des donnees offline ;
- tests IDOR avec service worker actif.

## Performance

Optimisations preparees :

- App Shell leger ;
- assets statiques caches ;
- pas de bibliotheque ajoutee ;
- skeletons ;
- chargement dynamique des donnees a brancher ;
- pas de gros graphiques ou images lourdes.

Lighthouse n'a pas ete lance, car il n'y a pas de serveur local demarre ni d'application buildable. Le plan de test indique comment le lancer une fois servi en localhost/HTTPS.

## Tests

Verifications locales effectuees :

- creation des fichiers PWA ;
- manifest JSON valide ;
- service worker present ;
- client PWA present ;
- App Shell relie au manifest, CSS et JS ;
- icones presentes.

Tests non executes :

- installation navigateur ;
- standalone ;
- offline navigateur ;
- update service worker ;
- Lighthouse.

Raison : service workers et installation PWA doivent etre testes via HTTP localhost ou HTTPS dans un navigateur compatible. Le workspace ne contient pas de serveur/projet applicatif.

## Dependances

Aucune dependance ajoutee.

## Points restant a traiter

- Integrer les fichiers dans le vrai framework NOVEX.
- Adapter `start_url` au routing auth/onboarding/workspace reel.
- Remplacer les icones par le logo officiel NOVEX si disponible.
- Generer des PNG 192/512/maskable pour compatibilite maximale.
- Ajouter meta tags propres a la stack finale.
- Brancher les prompts update/offline dans le layout Association reel.
- Tester Chrome, Edge, Safari, mobile et Lighthouse.
- Definir une strategie offline data future, particulierement pour les donnees financieres.
