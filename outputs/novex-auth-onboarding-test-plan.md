# NOVEX - Auth + Onboarding Test Plan

## Inscription

1. Soumettre prenom, nom, email, telephone, mot de passe valide et consentement.
2. Attendu : `User` cree, `Profile` cree, mot de passe hashe, consentement horodate.
3. Soumettre email deja utilise.
4. Attendu : refus sans detail technique.

## Mot de passe

1. Mot de passe trop court.
2. Attendu : erreur explicite.
3. Mot de passe sans chiffre.
4. Attendu : erreur explicite.
5. Confirmation differente.
6. Attendu : refus.

## Verification email

1. Token valide et non expire.
2. Attendu : `email_verified_at` renseigne, evenement `email_verified`.
3. Token expire ou rejoue.
4. Attendu : refus et message generique.

## Connexion

1. Email et mot de passe corrects.
2. Attendu : session persistante creee.
3. Mot de passe incorrect.
4. Attendu : refus generique.
5. Utilisateur suspendu.
6. Attendu : refus.

## Onboarding Workspace

1. Utilisateur authentifie sans workspace.
2. Attendu : redirection `/onboarding`.
3. Creer organisation Association en Cote d'Ivoire.
4. Attendu : `Workspace` cree avec `currency = XOF` et `country = CI`.
5. Attendu : `WorkspaceMember` cree avec role `OWNER`.

## Freemium

1. Creation workspace a `serverNow`.
2. Attendu : `Subscription.plan = FREEMIUM`.
3. Attendu : `status = trial`.
4. Attendu : `trial_started_at = serverNow`.
5. Attendu : `trial_ends_at = serverNow + 14 jours` cote serveur.

## Invitations

1. Arriver via token invitation.
2. Creer compte ou se connecter.
3. Accepter invitation.
4. Attendu : membership cree dans le workspace invite avec le role assigne.
5. Attendu : aucun nouveau workspace cree automatiquement.

## Protection routes

1. Anonymous tente `/app/:workspace/dashboard`.
2. Attendu : redirection login ou 401.
3. User sans workspace tente dashboard.
4. Attendu : redirection onboarding.
5. User association tente `/admin`.
6. Attendu : 403.

## Session

1. Session expiree.
2. Attendu : message "Votre session a expire. Veuillez vous reconnecter."
3. Deconnexion.
4. Attendu : session revoquee.

## Dashboard initial

1. Workspace fraichement cree.
2. Attendu : dashboard vide avec vrais compteurs a zero.
3. Attendu : aucune fausse donnee persistante.

## Upload logo

1. Fichier image valide.
2. Attendu : verification serveur extension, signature/type reel, taille.
3. Fichier deguise ou trop lourd.
4. Attendu : refus.
