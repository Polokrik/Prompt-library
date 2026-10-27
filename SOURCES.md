# Sources

Ce fichier documente l’origine des données. La section entre `AUTO:START` et `AUTO:END` est **générée par `npm run generate`** à partir des rapports réels
(dates, volumes, erreurs) ; ne la modifiez pas à la main. Rien ici n’est estimé ni fictif.

## Inspiration

**La baie des images** — Vincent Flibustier — <https://vincentflibustier.com/imageia/#bibliotheque>.
Le parcours (bibliothèque visuelle, fiches, copie du prompt) inspire ce projet ; la direction artistique est volontairement différente. Cette inspiration est citée sur la page « À propos » du site.

## Sources

### 1. La baie des images (`external-initial`)
- URL : <https://vincentflibustier.com/imageia/#bibliotheque>
- Méthode prévue : `npm run inspect:source` (lecture seule, robots.txt respecté) puis `npm run import:external:sample` (30 entrées + images) puis `npm run import:external`.
- Brut conservé : `imports/external/raw/external-*.json` (objet source intact dans `original`), images originales dans `imports/external/originals/` (non versionnées), versions optimisées dans `public/images/prompts/`.
- Transformations : nettoyage des espaces, neutralisation du HTML, catégories/tags en tableaux, langue harmonisée, URL validées (http/https), corrections éditoriales via `imports/external/mapping.json`. Un texte alternatif n’est jamais généré : sans alt fiable, la fiche est `to-confirm`.
- Droits : les contenus restent la propriété de leurs auteurs ; ce dépôt est un usage personnel. Vérifier les conditions d’utilisation avant toute publication de la collection importée.

### 2. Prompt Bible (`prompt-bible`)
- Fichier : `imports/prompt-bible/Prompt Bible.xlsx` (classeur personnel : feuilles CATALOGUE, TEXTES, RÉFÉRENTIELS, MÉTHODE IMAGE 10 BLOCS).
- Méthode : `npm run inspect:excel` puis `npm run import:excel:sample` / `npm run import:excel` (lecture locale, valeurs de cellules copiées sans transformation dans `imports/prompt-bible/raw/`).
- Transformations : jointure CATALOGUE ↔ TEXTES par `Texte principal_ID` / `Entrée_ID`, variantes et briques rattachées à la fiche, catégories = famille + usages, tags = ambiance + époque, orientation et référence seulement si non ambiguës, descriptions génériques du classeur non republiées.
- Exclusions : les feuilles RÉFÉRENTIELS et MÉTHODE IMAGE 10 BLOCS (consignes, pas des fiches) ; les 16 textes sans `Entrée_ID` (fragments autonomes) ne deviennent pas des fiches.
- Particularités : aucune image dans le classeur ; aucun résultat testé attesté.

<!-- AUTO:START -->

_Section générée par `npm run generate` à partir des rapports réels. Ne pas modifier à la main._

Jeu de données actuellement publié : mode **sample** — 30 fiche(s) au total.

### Prompt Bible (`prompt-bible`)

- Fiches dans la bibliothèque : 30 (published : 0, to-test : 12, to-confirm : 17, hidden : 1)
- Dernier import (date réelle) : 2026-10-27T13:21:55.111Z

### Journal des imports

- **external-initial** (sample) — 2026-10-27T13:32:45.387Z — **échec** : 0 entrée(s) importée(s) sur 0 analysée(s)
  - Aucune source de données exploitable dans source.json (stratégie : unreachable).
  - Voir reports/source-inspection.md et la procédure locale ; renseigner dataLocation et fieldMap si besoin.
- **prompt-bible** (sample) — 2026-10-27T13:32:54.289Z — réussi : 30 entrée(s) importée(s) sur 424 analysée(s)
  - Le classeur ne contient aucune image : toutes les fiches sont « sans image » tant que imports/images/<id>.* n’est pas alimenté.
  - 16 texte(s) sans Entrée_ID (fragments autonomes) non inclus dans le lot pilote ; ils ne deviennent pas des fiches.

<!-- AUTO:END -->
