# NOVEX - Prompt 06/10 - App Shell + Navigation + Layout Association

Date : 2026-08-29

## Contexte reel

Le code source NOVEX n'est toujours pas present dans le workspace. Il n'existe donc pas de router, framework frontend, auth, backend, middleware ou composants applicatifs a modifier.

J'ai cree une fondation App Shell autonome, integrable plus tard dans la vraie stack, en reutilisant les livrables precedents :

- Design System du prompt 02 ;
- multi-tenant et permissions du prompt 03 ;
- auth/onboarding du prompt 04 ;
- PWA du prompt 05.

## App Shell

Fichiers crees :

- `novex-app-shell-preview.html`
- `novex-admin-shell-preview.html`
- `novex-app-shell.css`
- `novex-app-shell-client.js`
- `novex-app-shell-navigation.json`
- `novex-app-shell-test-plan.md`
- `app-shell-novex-06.md`

Architecture livree :

```text
Authenticated App
  Association Workspace
    AppShell
    Sidebar
    MobileHeader
    BottomNavigation
    WorkspaceSwitcher
    CommandPalette
    Notifications
    UserMenu
    PageContent

  NOVEX Admin
    AdminShell
    AdminSidebar
    AdminHeader
    AdminContent
```

## Navigation

Navigation Association desktop :

- Dashboard
- Membres
- Cotisations
- Recettes
- Depenses
- Projets
- Evenements
- Documents
- Rapports
- Assistant IA
- Parametres

Navigation mobile :

- Accueil
- Membres
- Cotisations
- Finance
- Plus

Le menu Finance ouvre :

- Recettes
- Depenses

Le menu Plus contient :

- Projets
- Evenements
- Documents
- Rapports
- Assistant IA
- Parametres

Les permissions et entitlements attendus sont formalises dans `novex-app-shell-navigation.json`.

## Mobile

Le shell Association est mobile/PWA-first :

- header mobile compact ;
- bottom navigation fixe ;
- safe area via `viewport-fit=cover` et `env(safe-area-inset-*)` ;
- bouton d'action rapide ;
- bottom sheets pour Finance, Plus et Quick Actions ;
- une action principale visible ;
- actions secondaires regroupables.

Les quick actions preparees :

- Ajouter un membre ;
- Ajouter une depense ;
- Ajouter une recette ;
- Enregistrer une cotisation ;
- Creer un projet ;
- Creer un evenement.

Dans la vraie app, elles devront etre filtrees cote serveur et UI selon les permissions du workspace.

## Desktop

Le desktop Association inclut :

- sidebar permanente ;
- sidebar collapsed ;
- tooltips via `title` sur les items ;
- workspace switcher ;
- header avec titre, description, recherche globale, aide, notifications, installation PWA et profil ;
- PageHeader ;
- filtres horizontaux ;
- data refresh ;
- dashboard grid responsive.

## Workspace Switch

La preview simule :

- ouverture du switcher ;
- choix d'un workspace ;
- skeleton de chargement ;
- mise a jour du titre/description ;
- absence d'affichage volontaire de donnees metier d'un autre workspace.

Dans l'application finale, le switch devra :

1. verifier l'autorisation cote serveur ;
2. changer le workspace actif ;
3. invalider les caches `workspace:{oldId}:*` ;
4. charger les donnees du nouveau workspace ;
5. mettre a jour le routing ;
6. eviter toute fuite visuelle de l'ancien workspace.

## Global Search et Command Palette

Elements livres :

- recherche globale ;
- ouverture par clic ;
- ouverture par `Ctrl/Cmd + K` ;
- fermeture par Escape ;
- liste d'actions de base.

Actions preparees :

- Rechercher un membre ;
- Ajouter une depense ;
- Creer une recette ;
- Creer un evenement ;
- Creer un projet ;
- Ouvrir les parametres ;
- Changer de Workspace.

La vraie implementation devra filtrer chaque resultat par permissions, workspace actif et entitlements.

## Notifications et profil

Centre de notifications prepare :

- badge de notifications non lues ;
- categories visuelles ;
- menu discret.

Menu profil prepare :

- Mon profil ;
- Mon organisation ;
- Preferences ;
- Securite ;
- Aide ;
- Se deconnecter.

## NOVEX ADMIN

Le fichier `novex-admin-shell-preview.html` cree un shell separe, desktop-first.

Navigation Admin :

- Dashboard
- Associations
- Utilisateurs
- Abonnements
- Paiements
- Revenus
- Analytics
- Support
- Notifications
- Configuration

La separation est visuelle et conceptuelle. Dans la vraie app, elle devra etre appliquee cote backend par roles internes NOVEX, pas par roles Association.

## Responsive

Desktop :

- grille avec sidebar ;
- header complet ;
- filtres horizontaux ;
- KPI et tableaux.

Tablet :

- contenu plus compact ;
- recherche globale peut se masquer ;
- grid adaptee.

Mobile :

- sidebar desktop masquee ;
- header mobile ;
- bottom navigation ;
- bottom sheets ;
- padding safe area.

## PWA

`novex-app-shell-preview.html` reference le manifest du prompt 05 et le client PWA.

Le shell est donc pret a fonctionner en mode installe une fois servi via localhost/HTTPS. L'installation, le service worker et l'offline restent portes par les fichiers du prompt 05.

## Securite

Protections conceptuelles posees :

- Association et Admin separes ;
- navigation formalisee avec permissions ;
- quick actions formalisees avec permissions ;
- workspace switch avec etat loading pour eviter fuite visuelle ;
- Access Denied a prevoir sans details de ressource ;
- backend obligatoire pour autorisation `/admin` et workspace.

Ce qui reste obligatoire dans la vraie app :

- middleware auth ;
- `requireWorkspaceAccess` sur chaque route workspace ;
- role interne NOVEX pour `/admin` ;
- non-confiance envers le frontend ;
- invalidation cache au changement de workspace ;
- tests IDOR avec navigation active.

## Tests

Fichier cree :

- `novex-app-shell-test-plan.md`

Verifications locales effectuees :

- fichiers crees ;
- preview Association reliee au Design System, au CSS App Shell, au manifest PWA et au client PWA ;
- preview Admin reliee au Design System et au CSS App Shell ;
- navigation JSON valide ;
- hooks JS principaux presents.

Tests navigateur non executes :

- responsive visuel reel ;
- installation PWA ;
- standalone ;
- workspace switch reel ;
- permissions serveur ;
- acces `/admin`.

Raison : il n'y a pas de projet applicatif, de serveur, d'auth ni de backend.

## Fichiers crees

- `outputs/novex-app-shell-navigation.json`
- `outputs/novex-app-shell.css`
- `outputs/novex-app-shell-client.js`
- `outputs/novex-app-shell-preview.html`
- `outputs/novex-admin-shell-preview.html`
- `outputs/novex-app-shell-test-plan.md`
- `outputs/app-shell-novex-06.md`

## Dependances

Aucune dependance ajoutee.

## Problemes

### Critique

- Les criteres d'acceptation ne peuvent pas etre executes completement sans vraie application.

### Important

- Les menus et actions sont des previews statiques ; l'autorisation reelle doit venir du backend.
- Les icones sont temporaires en texte/symboles, faute de librairie UI projet disponible.
- Le routing `/app/...` et `/admin/...` doit etre adapte a la stack finale.

## Prochaine integration

Quand le code source NOVEX sera disponible :

1. transformer cette preview en composants de la stack ;
2. brancher navigation sur router reel ;
3. brancher workspace switch sur session/cache/API ;
4. filtrer menus/actions par permissions serveur ;
5. integrer command palette a la recherche reelle ;
6. ajouter 404, Access Denied et Error Boundary ;
7. tester mobile, tablet, desktop et PWA.
