# NOVEX - Multi-Tenant Test Plan

## Isolation

1. Creer Workspace A avec User A owner.
2. Creer Workspace B avec User B owner.
3. Creer un membre association dans Workspace A.
4. Appeler l'API membres avec le contexte Workspace B.
5. Attendu : le membre de Workspace A n'apparait jamais.

## IDOR

1. User A recupere `/app/association-a/members/member_a_id`.
2. User A tente `/app/association-b/members/member_a_id`.
3. Attendu : 403 ou 404 controle, sans fuite de details.

## Permissions

1. Creer User T avec role TREASURER dans Workspace A.
2. User T tente `expenses.create`.
3. Attendu : autorise.
4. User T tente `workspace_users.update_role`.
5. Attendu : refuse.

## Invitations

1. Owner invite User C avec role SECRETARY.
2. Token valide et non expire.
3. User C accepte.
4. Attendu : creation de WorkspaceMember actif avec role SECRETARY.
5. Rejouer le meme token.
6. Attendu : refus.

## Invitation expiree

1. Creer une invitation expiree.
2. Tenter acceptation.
3. Attendu : refus, statut `expired`.

## Workspace switch

1. User appartient a Workspace A et B.
2. Charger A, puis passer a B.
3. Attendu : caches workspace A invalides ou scopes par `workspace:A:*`.
4. Attendu : aucune donnee A dans les vues B.

## Subscription

1. Creer Workspace avec plan FREEMIUM.
2. Attendu : `trial_started_at` serveur et `trial_ends_at = +14 jours`.
3. Simuler date apres expiration.
4. Attendu : statut expire ou acces restreint selon politique produit.

## Feature access

1. Workspace Start tente `online_contributions`.
2. Attendu : refus serveur.
3. Workspace Pro tente `online_contributions`.
4. Attendu : autorise serveur.

## Last owner protection

1. Workspace avec un seul OWNER actif.
2. Tenter suppression, suspension ou changement de role de cet owner.
3. Attendu : refus transactionnel.

## NOVEX Admin separation

1. User avec role Association OWNER mais sans role `novex_admin_members`.
2. Tenter acces `/admin`.
3. Attendu : refus.
4. User admin interne sans membership association.
5. Tenter acces donnees association sans route admin controlee.
6. Attendu : refus ou acces lecture admin audite selon politique interne.
