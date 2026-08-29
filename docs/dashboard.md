# Dashboard Association

Le dashboard Association est le centre de pilotage d'un workspace NOVEX.

## Objectifs

Il doit repondre rapidement a cinq questions :

- combien avons-nous ;
- combien avons-nous encaisse ;
- combien avons-nous depense ;
- combien devons-nous encore collecter ;
- que se passe-t-il actuellement.

## Endpoint

```text
GET /api/v1/dashboard/overview/?period=month
X-Workspace: <workspace-slug>
```

L'endpoint est agrege pour eviter une multitude de requetes independantes au chargement initial.

## Periodes

- `today`
- `week`
- `month`
- `quarter`
- `year`
- `previous_year`

Le solde courant n'est pas limite artificiellement a la periode. Les flux de recettes, depenses et cotisations le sont.

## Securite

- Le backend resout le workspace depuis le membership actif.
- Les donnees sont scopees par workspace.
- Les donnees finance sont masquees si l'utilisateur n'a pas les permissions necessaires.
- Les futurs caches devront inclure `workspace_id`, `period`, `filters` et permissions utilisateur.

## Empty state

Une nouvelle organisation ne doit pas afficher de fausses statistiques. Les widgets restent a zero ou vides tant que les modules metier n'ont pas de donnees reelles.

## Futurs modules

Les widgets finance, cotisations, projets, evenements, documents, activite et insights sont prepares pour etre branches aux modules metier au fur et a mesure.
