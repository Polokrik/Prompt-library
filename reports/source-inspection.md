# Inspection de la source externe

- Date d’inspection : 2026-10-27T13:24:12.205Z
- URL inspectée : https://vincentflibustier.com/imageia/#bibliotheque
- Accessible depuis l’environnement : non
- robots.txt : robots.txt illisible : fetch failed (Request was cancelled.) : https://vincentflibustier.com/robots.txt
- Stratégie technique : **unreachable**


## Champs
Disponibles : —

Absents : —

Clés non utilisées : —

## Images
- (aucune image détectée)

## Catégories détectées
—

## Fichiers inspectés
- (aucun)

## Obstacles
- Page inaccessible depuis cet environnement : fetch failed (Request was cancelled.) : https://vincentflibustier.com/imageia/

## Méthode recommandée
Relancer `npm run inspect:source` depuis un poste ayant accès au site, ou autoriser le domaine dans la politique réseau de l’environnement. Voir localInstructions.

## Procédure locale
- Depuis une machine qui peut joindre vincentflibustier.com : `npm ci` puis `npm run inspect:source`.
- Vérifier imports/external/source.json (strategy, dataLocation, fieldMap) et reports/source-inspection.md.
- Si strategy = "none-found" : ouvrir la page dans un navigateur, onglet Réseau, repérer l’appel JSON du catalogue, puis renseigner `dataLocation` et `fieldMap` à la main dans source.json (kind = "json", url = l’adresse relevée).
- Puis `npm run import:external:sample` (30 entrées max + leurs images) et `npm run refresh`.
- Dépendances : Node ≥ 22.21 (aucune autre que celles de package.json).
