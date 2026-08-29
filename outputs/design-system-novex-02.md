# NOVEX - Prompt 02/10 - Design System + UI Foundation

Date : 2026-08-28

## Contexte reel du workspace

Le code source NOVEX n'est toujours pas present dans le workspace. Le Prompt 01 avait conclu qu'aucune stack applicative n'etait identifiable. Le Prompt 02 demande de construire une fondation UI/UX ; j'ai donc produit une fondation autonome, integrable plus tard dans la vraie stack, sans modifier de backend ni inventer de modules metier.

## Design System cree

Livrables crees :

- `novex-design-system.css` : tokens + primitives + composants CSS reutilisables.
- `novex-ui-preview.html` : apercu statique Association mobile-first et NOVEX ADMIN desktop-first.
- `design-system-novex-02.md` : rapport du prompt 02.

### Tokens

Le fichier CSS definit :

- couleurs : primary, success, warning, danger, info, neutral ;
- surfaces : page, panel, raised, muted ;
- texte : strong, body, muted, inverse ;
- typographie : sans, mono, display, h1, h2, h3, h4, body, small, caption, label ;
- spacing : 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 ;
- radius : small, medium, large, card, pill ;
- shadows : xs, sm, md ;
- focus accessible ;
- transitions ;
- breakpoints : mobile, tablet, laptop, desktop, wide.

### Dark mode

La structure est preparee via `[data-theme="dark"]`. Les composants utilisent des variables de surface, texte et bordure afin de permettre une activation progressive du dark mode dans la vraie application.

### Composants UI de base

Presents dans la fondation :

- Button : primary, secondary, outline, ghost, destructive, link, disabled ;
- Input ;
- Select ;
- Textarea ;
- Search ;
- Checkbox ;
- Radio ;
- Switch ;
- Helper text ;
- Error/success field states ;
- Focus visible.

### Composants data

Presents dans la fondation :

- KPI Card ;
- KPI value pour montants financiers ;
- KPI trend up/down ;
- Sparkline CSS placeholder ;
- Progress ;
- Status Badge ;
- Table responsive ;
- Table toolbar ;
- Skeleton ;
- Spinner ;
- Empty state ;
- Error state ;
- Toast ;
- Modal ;
- Drawer.

### Layouts

Presents dans la fondation :

- Association shell ;
- Admin shell ;
- Sidebar ;
- Header ;
- Main content ;
- Dashboard grid 12 colonnes ;
- Mobile frame ;
- Mobile header ;
- Bottom navigation ;
- Floating quick action button ;
- PWA banner.

## Fichiers crees/modifies

Fichiers crees :

- `outputs/novex-design-system.css`
- `outputs/novex-ui-preview.html`
- `outputs/design-system-novex-02.md`

Fichiers modifies :

- Aucun fichier applicatif, car aucun projet source n'est present.

## Dependances ajoutees

Aucune dependance ajoutee.

La preview utilise uniquement HTML + CSS afin de rester portable et integrable dans n'importe quelle stack future : React, Next.js, Vue, Laravel, Rails, Django, Remix ou autre.

## Responsive

### Mobile

La fondation privilegie l'espace Association en mobile-first :

- header compact ;
- bottom navigation ;
- cartes KPI lisibles ;
- quick actions accessibles au pouce ;
- table transformable en rows compactes ;
- tailles tactiles suffisantes ;
- layouts mono-colonne sous 768px.

### Tablet

Les grilles passent progressivement en deux colonnes lorsque l'espace le permet. L'admin reste utilisable, mais la densite maximale est reservee au desktop.

### Desktop

Le desktop utilise :

- sidebar permanente ;
- header ;
- dashboard grid 12 colonnes ;
- KPI multiples sur une ligne ;
- grands tableaux ;
- composants analytics.

NOVEX ADMIN est concu comme une surface desktop-first, dense mais lisible.

## PWA

Pret dans cette fondation :

- composants UI pour install prompt ;
- offline indicator ;
- sync indicator ;
- updated indicator ;
- update available banner ;
- shell mobile-first adapte a une app installee.

A traiter quand la vraie stack sera disponible :

- `manifest.webmanifest` ;
- service worker ;
- cache assets ;
- strategie offline ;
- gestion update service worker ;
- background sync ;
- icones PWA ;
- splash screen selon support navigateur.

## Accessibilite

La fondation inclut :

- focus visible ;
- contrastes sobres ;
- tailles de boutons adaptees ;
- structure semantique HTML dans la preview ;
- labels de champs ;
- `aria-label` sur les apercus principaux.

Il faudra completer dans l'application finale :

- tests clavier reels ;
- audits Lighthouse ;
- validation screen reader ;
- gestion focus modal/drawer ;
- annonces toast via live regions.

## Tests

Lint : non lance, aucun projet ni configuration lint.

Typecheck : non lance, aucun projet TypeScript ou framework.

Build : non lance, aucun projet buildable.

Verification effectuee :

- creation des fichiers ;
- CSS autonome ;
- HTML statique lie au CSS ;
- pas de dependance externe ;
- pas de donnees metier persistantes ;
- pas de secret ;
- aucune modification backend.

## Problemes rencontres

### Critique

- Le projet NOVEX reel est absent du workspace. L'integration directe dans une application n'est donc pas possible.

### Important

- La stack reste inconnue ; les composants sont donc livres en CSS/HTML portable, pas en composants React/Vue/etc.
- Les icones ne peuvent pas etre normalisees avec une librairie projet existante, puisqu'aucune librairie UI n'est presente.

### Amelioration

- Quand le code source sera fourni, convertir cette fondation en composants natifs de la stack.
- Ajouter une page interne `/design-system` ou `/admin/design-system` selon le routing reel.
- Ajouter tests visuels et screenshots responsive une fois l'app disponible.

## Prochaine etape recommandee

Avant le prompt 03, placer le vrai projet NOVEX dans le workspace. Ensuite, integrer cette fondation dans la stack reelle en conservant :

- les tokens ;
- les noms de composants ;
- la separation Association / Admin ;
- l'approche mobile-first pour Association ;
- l'approche desktop-first pour NOVEX ADMIN.
