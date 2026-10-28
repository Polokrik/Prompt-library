# Ajouter une image à une fiche

## Méthode directe sur GitHub (la plus simple, sans terminal)

1. **Nommer l'image** : `IDENTIFIANT__Outil.jpg`, par exemple
   `ENT-VNHZB48D__Midjourney v7.jpg` ou `ext-104__GPT-4o.png`.
   - L'identifiant est à la fin de l'adresse de la fiche (`…/#/fiche/ENT-VNHZB48D`).
   - Le titre exact de la fiche est accepté à la place de l'identifiant **s'il est unique** (sinon l'image est signalée, jamais devinée).
   - Après `__`, l'outil IA ; un tiret bas devient un espace (`Midjourney_v7` → « Midjourney v7 »). Sans `__Outil`, aucun outil n'est enregistré.
2. **Déposer l'image** : dans le dépôt, dossier `imports/images/` → *Add file → Upload files* → *Commit changes*.
3. **Ajouter une ligne dans `imports/descriptions.txt`** (crayon ✎ sur GitHub) :
   `ENT-VNHZB48D | Panda en uniforme de cheminot, assis dans un wagon de train des années 1970, en noir et blanc.`
   Une ligne par image, sans guillemets ni virgules à gérer. Référence = identifiant ou titre exact.
4. GitHub optimise l'image, met à jour les données et republie le site tout seul (environ 3 minutes). Un problème (nom inconnu, titre ambigu…) apparaît dans l'onglet *Actions* et dans `reports/images-report.json`.

Règles : une image **sans ligne dans `descriptions.txt` n'est pas publiée** (la fiche reste visible sans image, rien n'est cassé). Une image avec description fait passer la fiche en **« publiée »** : n'ajoutez donc que les résultats satisfaisants.
Vous pouvez aussi me déposer les images et me dire « j'ai uploadé » : je vérifie les attributions et je rédige les descriptions à partir des images.

---

# Variante : m'envoyer les images — modèle

Une image par fiche, avec les informations ci-dessous. Copiez le bloc « Modèle », remplissez-le (un bloc par image) et envoyez-le avec le fichier image.

## Trouver l'identifiant de la fiche
Ouvrez la fiche sur le site : l'identifiant est à la fin de l'adresse.
`https://polokrik.github.io/Prompt-library/#/fiche/`**`ENT-VNHZB48D`** ou **`ext-104`**.
À défaut, donnez le titre exact de la fiche.

## Modèle (à copier)

```
Fiche (identifiant ou titre exact) :
Fichier image (nom du fichier joint) :
Outil IA utilisé (ex. Midjourney v7, GPT-4o, Gemini, Sora, Flux…) :
Prompt utilisé : identique à la fiche  /  modifié (coller le prompt exact ci-dessous)
Image de référence fournie à l'outil : non  /  oui (laquelle ?)
Description de l'image (1 phrase, ce qu'on y voit) :
Résultat : satisfaisant (à publier)  /  moyen (à tester)  /  raté (ne pas publier)
Remarques (réglages, essais, pourquoi ça marche ou pas) :
```

## Règles pour la description (texte alternatif)
- Une phrase courte qui décrit **ce qu'on voit** : sujet, cadrage, ambiance.
- Ne commence pas par « Image de… » ou « Photo de… ».
- Ne recopie pas le titre de la fiche.
- N'invente rien qui n'est pas visible (pas d'interprétation, pas de nom propre non lisible).
- Exemple : « Panda en uniforme de cheminot, assis dans un wagon de train des années 1970, en noir et blanc. »

## Ce que devient chaque réponse
| Champ du modèle | Où ça va |
|---|---|
| Fichier image | `imports/images/<identifiant>.jpg` (renommé), optimisé en WebP (480 px et 1200 px) |
| Outil IA | `generator` de la fiche (« Généré avec ») |
| Description | `image.alt` (texte alternatif, obligatoire pour publier) |
| Résultat « satisfaisant » | `status: "published"` ; « moyen » : `to-test` ; « raté » : aucune image ajoutée |
| Image de référence | `requiresReference: true/false` |
| Prompt modifié | à examiner : variante de la fiche ou correction du prompt |
| Remarques | `description` de la fiche si utile |

Exemple de ligne obtenue dans `imports/<source>/mapping.json` :

```json
"ENT-VNHZB48D": {
  "status": "published",
  "generator": "Midjourney v7",
  "requiresReference": false,
  "image": { "alt": "Panda en uniforme de cheminot, assis dans un wagon de train des années 1970, en noir et blanc." }
}
```

## Conseils pour les fichiers
- Format : JPG, PNG ou WebP ; taille quelconque (le site le réduit), idéalement ≥ 1200 px de large.
- Une seule image par fiche pour l'instant.
- Nom du fichier : peu importe à l'envoi (je le renomme) ; si vous l'ajoutez vous-même sur GitHub, il doit s'appeler exactement comme l'identifiant : `ENT-VNHZB48D.jpg`.
