# Inspection de la source externe

- Date d’inspection : 2026-10-28T08:45:21.308Z
- URL inspectée : https://vincentflibustier.com/imageia/#bibliotheque
- Accessible depuis l’environnement : oui
- robots.txt : Chemin autorisé pour User-agent: *
- Stratégie technique : **json-endpoint**
- Données : https://vincentflibustier.com/imageia/catalogue.php?v=20261020-r6 (json, 1130 entrées, chemin $.prompts)

## Champs
Disponibles : originalId, title, prompt, categories, tags, imageUrl, author, license, postUrl, imageLabel, origin

Absents : pageUrl, language, alt

Clés non utilisées : description, images, originalPrompt, enrichment, note, collection, reversePrompt, added

## Images
- .(inconnu) : 904

## Catégories détectées
Affiches & édition, Architecture & espaces, Bandes dessinées & récits, Cartes & diagrammes, Concepts créatifs, Cuisine & objets, Design produit, Dessin & carnet, Effets photo, Identité visuelle, Infographies & données, Jeux & interfaces, Lumière & photo, Nature & paysages, Personnages & 3D, Retouche & variations, Réseaux sociaux, Schémas & pédagogie, Styles artistiques, Textures & matières

## Fichiers inspectés
- https://vincentflibustier.com/imageia/ — HTTP 200, 33645 octets
- https://vincentflibustier.com/imageia/imageia-20261020.js?v=6 — HTTP 200, 24121 octets
- https://vincentflibustier.com/imageia/catalogue.php?v=20261020-r6 — HTTP 200, 4709601 octets

## Forme des données récupérées (appels fetch)
### https://vincentflibustier.com/imageia/catalogue.php?v=20261020-r6

```json
{
  "version": "2026-10-20-r6",
  "prompts": {
    "_type": "array",
    "length": 1130,
    "sample": {
      "id": "104",
      "title": "Book to Life - 3D Story Eruption",
      "category": "Concepts créatifs",
      "prompt": "Input A is a classic novel or book title. Analyze the setting, the protagonist's journey, and the core motif. Goal: A high-end leather-bound book lying open,…",
      "author": "@Gdgtify",
      "source": "https://x.com/Gdgtify/status/2003388609651454417",
      "description": "Un point de départ à adapter à votre sujet, votre composition et votre palette.",
      "origin": "collection",
      "images": {
        "_type": "array",
        "length": 0
      },
      "originalPrompt": "Input A is a classic novel or book title. Analyze the setting, the protagonist's journey, and the core motif. Goal: A high-end leather-bound book lying open,…",
      "enrichment": {
        "_type": "object",
        "keys": [
          "version",
          "sections"
        ]
      }
    }
  },
  "featured": {
    "_type": "array",
    "length": 70,
    "sample": "323"
  },
  "categories": {
    "_type": "array",
    "length": 20,
    "sample": "Affiches & édition"
  }
}
```

## Obstacles
- (aucun)

## Méthode recommandée
Import direct depuis https://vincentflibustier.com/imageia/catalogue.php?v=20261020-r6 (fichier JSON), 1130 entrées. Vérifier fieldMap, puis `npm run import:external:sample`.

## Procédure locale
- Depuis une machine qui peut joindre vincentflibustier.com : `npm ci` puis `npm run inspect:source`.
- Vérifier imports/external/source.json (strategy, dataLocation, fieldMap) et reports/source-inspection.md.
- Si strategy = "none-found" : ouvrir la page dans un navigateur, onglet Réseau, repérer l’appel JSON du catalogue, puis renseigner `dataLocation` et `fieldMap` à la main dans source.json (kind = "json", url = l’adresse relevée).
- Puis `npm run import:external:sample` (30 entrées max + leurs images) et `npm run refresh`.
- Dépendances : Node ≥ 22.21 (aucune autre que celles de package.json).
