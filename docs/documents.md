# Documents & Archives

NOVEX dispose d'une GED associative transversale pour centraliser les documents du workspace sans remplacer les pieces jointes deja presentes dans Finance, Projects, Events ou Payments.

## Perimetre

- Dossiers arborescents via `DocumentFolder`.
- Documents avec statut actif, archive, corbeille, validation et sensibilite.
- Upload controle par extension, MIME deduit, taille, nom et workspace.
- Nom de stockage genere cote serveur par UUID.
- Versions non destructives via `DocumentVersion`.
- Partage cible membre, role ou equipe via `DocumentShare`.
- Liens securises facultatifs via `DocumentShareLink`.
- Favoris, access logs, activite et audit global.
- Relations vers `Project`, `Event`, `FinancialTransaction`, `Payment` et `Member`.

## Configuration

`MAX_DOCUMENT_SIZE` definit la taille maximale en octets. La valeur par defaut est 25 MB.

`DOCUMENT_STORAGE_QUOTA` definit le quota logique par workspace pour les analytics. La valeur par defaut est 10 GB.

## API

- `GET /api/v1/documents/`
- `POST /api/v1/documents/`
- `GET /api/v1/documents/:id/`
- `PATCH /api/v1/documents/:id/`
- `DELETE /api/v1/documents/:id/`
- `GET /api/v1/documents/:id/download/`
- `POST /api/v1/documents/:id/archive/`
- `POST /api/v1/documents/:id/restore/`
- `POST /api/v1/documents/:id/move/`
- `GET|POST /api/v1/documents/:id/versions/`
- `POST /api/v1/documents/:id/versions/:version_id/restore/`
- `GET|POST /api/v1/documents/:id/shares/`
- `GET|POST /api/v1/documents/:id/share-links/`
- `POST /api/v1/documents/:id/favorite/`
- `DELETE /api/v1/documents/:id/unfavorite/`
- `GET|POST /api/v1/documents/:id/approvals/`
- `POST /api/v1/documents/:id/approve/`
- `POST /api/v1/documents/:id/reject/`
- `GET /api/v1/documents/search/`
- `GET /api/v1/documents/analytics/`
- `GET /api/v1/documents/export/`
- `GET|POST /api/v1/documents/folders/`
- `GET|POST /api/v1/documents/tags/`

Tous les endpoints exigent `X-Workspace` et une permission RBAC `documents.*`.

## Securite

Les documents prives ne sont pas exposes par URL publique par defaut. Le telechargement passe par un endpoint controle qui verifie workspace, authentification et RBAC.

Les fichiers dangereux sont bloques par extension, MIME et nom. Les chemins d'upload sont generes par le serveur, ce qui neutralise le path traversal dans le nom utilisateur.

## Analytics

`document_analytics` utilise des agregations SQL par categorie et type, puis retourne le stockage utilise, disponible, les documents recents, archives, favoris, sensibles et en attente.

## Points prevus

OCR, signature electronique, virus scan, thumbnails et extraction IA sont prepares par `extracted_text`, `metadata`, `DocumentAccessLog` et la couche service, mais ne sont pas integres tant que l'infrastructure externe n'existe pas.
