# PWA

L'application Association est mobile-first et installable.

Fondation :

- `frontend/public/manifest.webmanifest`
- `frontend/public/sw.js`
- icones dans `frontend/public/icons/`
- meta viewport avec safe areas dans Next.js

Strategie :

- App Shell et assets statiques caches.
- Navigation fallback controle.
- API non cachees automatiquement.
- Donnees financieres non stockees offline sans strategie dediee.

Tests requis :

- Chrome desktop
- Edge desktop
- Chrome Android
- Safari iOS ajout ecran accueil
- Lighthouse PWA
