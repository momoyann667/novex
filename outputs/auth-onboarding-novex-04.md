# NOVEX - Prompt 04/10 - Authentification + Onboarding + Activation Workspace

Date : 2026-08-29

## Contexte reel

Le code source NOVEX n'est toujours pas present dans le workspace. Il n'existe pas de backend, frontend, ORM, auth provider, router, runner de tests ou configuration PWA a modifier directement.

J'ai donc cree une fondation portable et integrable, sans simuler une fausse application persistante.

## Authentification

Fichiers crees :

- `novex-auth-onboarding-contracts.ts`
- `novex-auth-onboarding-service.ts`
- `novex-auth-onboarding-routes.md`

La fondation couvre :

- inscription ;
- validation email normalisee ;
- validation mot de passe configurable ;
- consentement conditions/confidentialite ;
- preparation verification email par token hashe ;
- connexion ;
- session persistante ;
- deconnexion ;
- mot de passe oublie ;
- reset mot de passe ;
- routage post-login ;
- separation routes publiques, authentifiees, workspace et NOVEX ADMIN.

La logique de hash et generation de token est volontairement abstraite par interfaces pour brancher la librairie securisee de la vraie stack, par exemple Argon2, bcrypt ou le service auth deja existant.

## Onboarding

Parcours defini :

1. Bienvenue
2. Organisation
3. Profil
4. Configuration
5. Membres
6. Finalisation

Preview UI creee :

- `novex-onboarding-ui.html`

Elle utilise le design system du prompt 02 :

- cartes ;
- champs ;
- boutons ;
- badges ;
- progression ;
- checklist d'activation ;
- layout responsive ;
- formulaire mobile-friendly.

## Workspace

La creation workspace est modelisee par `completeWorkspaceOnboarding`.

Elle doit etre executee cote serveur dans une transaction :

```text
User
  -> Workspace
  -> WorkspaceMember role OWNER
  -> Subscription FREEMIUM trial
```

Valeurs par defaut :

- pays : `CI`
- devise : `XOF`
- role createur : `OWNER`

Le `Workspace` reste l'unite d'isolation posee au prompt 03.

## Subscription

Freemium est active automatiquement lors de la creation du workspace :

- plan : `FREEMIUM`
- statut : `trial`
- duree : 14 jours
- `trial_started_at` : date serveur
- `trial_ends_at` : date serveur + 14 jours

Le fichier `novex-auth-onboarding-service.ts` contient :

- `addTrialDays`
- `getTrialStatus`

Le compteur Freemium est base sur `serverNow`, pas sur l'heure frontend.

Etats prepares :

- plus de 7 jours : info ;
- 3 a 7 jours : notice ;
- 1 a 2 jours : warning ;
- dernier jour : danger ;
- expire : expired.

## PWA

La preview et les contrats sont prepares pour une experience mobile/PWA :

- formulaires utilisables au doigt ;
- inputs avec types adaptes : email, tel, password ;
- progression compacte ;
- layout responsive ;
- messages de statut courts ;
- dashboard initial sans fausses donnees.

A integrer quand la vraie application existe :

- manifest ;
- service worker ;
- gestion session expiree sans perdre les brouillons ;
- install prompt ;
- offline indicator ;
- update prompt.

## Securite

Protections preparees :

- mot de passe hashe via interface serveur ;
- tokens de verification/reset stockes sous forme de hash ;
- consentement horodate ;
- erreurs login generiques ;
- validation serveur obligatoire ;
- creation workspace en transaction ;
- trial calcule cote serveur ;
- separation compte NOVEX et profil organisation ;
- invitation acceptee sans creation automatique de workspace ;
- route admin protegee par roles internes NOVEX ;
- upload logo a valider cote serveur : extension, type reel, taille, dimensions.

Protections a brancher dans la vraie stack :

- rate limiting auth ;
- protection brute force ;
- cookies securises ;
- CSRF si sessions par cookies ;
- expiration/rotation sessions ;
- verification email reelle ;
- provider OAuth seulement si architecture existante compatible.

## Analytics activation

Evenements prepares :

- `signup_started`
- `signup_completed`
- `email_verified`
- `onboarding_started`
- `workspace_created`
- `onboarding_completed`
- `first_member_added`
- `first_contribution_created`
- `first_expense_created`
- `subscription_started`

Aucune plateforme externe n'a ete ajoutee.

## Tests

Fichier cree :

- `novex-auth-onboarding-test-plan.md`

Tests couverts :

- inscription ;
- validation mot de passe ;
- verification email ;
- login ;
- creation workspace ;
- createur owner ;
- freemium 14 jours cote serveur ;
- invitation ;
- protection routes ;
- session expiree ;
- dashboard initial vide ;
- upload logo.

Tests executes :

- pas de tests applicatifs executes, car aucun projet ni runner n'existe.

Verifications locales effectuees :

- creation des livrables ;
- fichiers relies au design system ;
- logique TypeScript lisible et portable ;
- aucune dependance ajoutee.

## Fichiers

Fichiers crees :

- `outputs/novex-auth-onboarding-contracts.ts`
- `outputs/novex-auth-onboarding-service.ts`
- `outputs/novex-auth-onboarding-routes.md`
- `outputs/novex-onboarding-ui.html`
- `outputs/novex-auth-onboarding-test-plan.md`
- `outputs/auth-onboarding-novex-04.md`

Fichiers modifies :

- aucun fichier applicatif.

## Dependances

Aucune dependance ajoutee.

## Points restant a traiter

- Integrer cette fondation dans le vrai framework NOVEX.
- Brancher le provider auth ou l'auth maison existante.
- Creer migrations ORM reelles.
- Implementer envoi email verification/reset.
- Implementer rate limiting et brute-force protection.
- Implementer upload logo securise.
- Creer les pages reelles Register, Login, Forgot, Reset, Onboarding, Profile.
- Creer le dashboard initial vide avec donnees reelles.
- Ajouter tests automatises dans le runner du projet.

## Risques

### Critique

- Les criteres d'acceptation ne peuvent pas etre executes sans application reelle.

### Important

- Le service TypeScript est un blueprint d'integration, pas un module branche a une base de donnees.
- Les tokens et hashes doivent etre relies a des primitives cryptographiques eprouvees dans la vraie stack.
- Les routes doivent etre adaptees au routing reel.
