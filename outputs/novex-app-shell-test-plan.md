# NOVEX - App Shell Test Plan

## Association desktop

1. Ouvrir `novex-app-shell-preview.html` sur un viewport desktop.
2. Verifier la sidebar permanente.
3. Verifier l'etat actif du Dashboard.
4. Cliquer le bouton collapse.
5. Attendu : sidebar reduite, libelles masques, choix memorise en localStorage.

## Workspace switch

1. Ouvrir le workspace switcher.
2. Choisir `Syndicat Horizon`.
3. Attendu : etat loading visible.
4. Attendu : aucun ancien contenu metier specifique n'est affiche comme donnees du nouveau workspace.
5. Dans la vraie app : invalider les caches `workspace:{oldId}:*`.

## Header

1. Verifier titre, description, recherche globale, aide, notifications, PWA install, profil.
2. Ouvrir notifications.
3. Ouvrir profil.
4. Attendu : menus distincts, accessibles, fermables avec Escape.

## Command palette

1. Cliquer la recherche globale.
2. Appuyer `Ctrl+K` ou `Cmd+K`.
3. Attendu : palette ouverte.
4. Appuyer Escape.
5. Attendu : palette fermee.
6. Dans la vraie app : filtrer les actions selon permissions et entitlements.

## Mobile

1. Passer sous 860px.
2. Verifier header mobile.
3. Verifier bottom navigation : Accueil, Membres, Cotisations, Finance, Plus.
4. Ouvrir Finance.
5. Attendu : bottom sheet Recettes/Depenses.
6. Ouvrir Plus.
7. Attendu : Projets, Evenements, Documents, Rapports, Assistant IA, Parametres.
8. Ouvrir action rapide.
9. Attendu : actions autorisees uniquement dans la vraie app.

## Page container

1. Verifier `PageHeader`.
2. Verifier zone filtres/actions.
3. Verifier contenu dashboard grid.
4. Verifier absence d'overflow horizontal non intentionnel.

## Error states

1. Tester page 404 et Access Denied dans l'integration finale.
2. Attendu : pas de details sur ressources non autorisees.

## NOVEX ADMIN

1. Ouvrir `novex-admin-shell-preview.html`.
2. Verifier layout distinct.
3. Verifier sidebar admin : Dashboard, Associations, Utilisateurs, Abonnements, Paiements, Revenus, Analytics, Support, Notifications, Configuration.
4. Verifier densite desktop.
5. Dans la vraie app : utilisateur association standard sur `/admin` doit recevoir 403.

## PWA

1. Servir `novex-app-shell-preview.html` en localhost ou HTTPS.
2. Verifier manifest et service worker via le prompt 05.
3. Verifier que le shell reste utilisable en mode standalone.
