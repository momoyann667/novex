# NOVEX - PWA Test Plan

## Manifest

1. Servir `novex-pwa-app-shell.html` via HTTP localhost ou HTTPS.
2. Ouvrir DevTools > Application > Manifest.
3. Verifier `name = NOVEX`, `short_name = NOVEX`, `display = standalone`, `start_url`, `scope`, `theme_color`, `background_color`.
4. Verifier les icones `192x192`, `512x512` et `maskable`.

## Service Worker

1. Ouvrir DevTools > Application > Service Workers.
2. Verifier que `novex-pwa-service-worker.js` est enregistre.
3. Recharger la page.
4. Verifier que les assets statiques sont servis depuis le cache.

## Installation Desktop

1. Ouvrir la page dans Chrome ou Edge via localhost/HTTPS.
2. Verifier que le navigateur propose l'installation si les criteres sont remplis.
3. Cliquer `Installer NOVEX`.
4. Verifier ouverture en fenetre standalone.
5. Verifier que le CTA installation disparait en mode installe.

## Mobile

1. Ouvrir depuis Chrome Android ou Safari iOS.
2. Verifier viewport, safe areas, bottom navigation et bouton d'action rapide.
3. Ajouter a l'ecran d'accueil lorsque le navigateur le permet.
4. Verifier nom, icone et lancement standalone.

## Offline

1. Charger la page une premiere fois en ligne.
2. Couper la connexion dans DevTools.
3. Recharger.
4. Attendu : App Shell visible, indication `Hors connexion`, pas de crash.
5. Attendu : aucune API sensible servie depuis un cache aveugle.

## Update

1. Changer `NOVEX_PWA_VERSION` dans le service worker.
2. Recharger.
3. Attendu : banniere `Nouvelle version disponible`.
4. Cliquer `Mettre a jour`.
5. Attendu : nouveau service worker active sans casser brutalement la session.

## Security

1. Verifier que les requetes `/api/` utilisent network-only.
2. Verifier absence de tokens ou donnees financieres dans Cache Storage.
3. Verifier que le routing prive reste protege par auth serveur dans l'application finale.

## Lighthouse

1. Lancer Lighthouse sur une URL localhost/HTTPS.
2. Auditer PWA, Performance, Accessibility, Best Practices.
3. Corriger les problemes reels avant production.
