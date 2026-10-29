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
- Format observé (inspection du 2026-10-28) : le site charge `catalogue.php` (JSON, ~1 130 prompts, ~904 avec images). Chaque entrée : `id`, `title`, `category`, `prompt`, `author`, `source` (publication d’origine, souvent un post X), `license` (ex. « CC BY 4.0 · collection YouMind »), `origin` (collection / creation / atelier), `images[]` (`src` hébergé par le site, `label` = outil, dimensions). **Choix actuel : prompts seulement, aucune image n’est téléchargée** (les images de la source n’ont pas de licence visible ; elles seront refaites au fil de l’eau). Les URL d’images restent dans le lot brut à titre de référence.
- Crédit conservé sur chaque fiche : auteur (sauf la valeur de remplissage « Créateur cité dans la source »), lien de la publication d’origine, licence.
- Droits : les prompts portent la licence indiquée par la source (attribution requise : auteur, publication d’origine et licence sont affichés sur la fiche). Les entrées d’origine « creation » et « atelier » sont des productions de l’auteur du site : à vérifier. Les images ne sont pas reprises (option `--images` déconseillée sans accord de l’auteur).

### 2. Prompt Bible (`prompt-bible`)
- Fichier : `imports/prompt-bible/Prompt Bible.xlsx` (classeur personnel : feuilles CATALOGUE, TEXTES, RÉFÉRENTIELS, MÉTHODE IMAGE 10 BLOCS).
- Méthode : `npm run inspect:excel` puis `npm run import:excel:sample` / `npm run import:excel` (lecture locale, valeurs de cellules copiées sans transformation dans `imports/prompt-bible/raw/`).
- Transformations : jointure CATALOGUE ↔ TEXTES par `Texte principal_ID` / `Entrée_ID`, variantes et briques rattachées à la fiche, catégories = famille + usages, tags = ambiance + époque, orientation et référence seulement si non ambiguës, descriptions génériques du classeur non republiées.
- Exclusions : les feuilles RÉFÉRENTIELS et MÉTHODE IMAGE 10 BLOCS (consignes, pas des fiches) ; les 16 textes sans `Entrée_ID` (fragments autonomes) ne deviennent pas des fiches.
- Particularités : aucune image dans le classeur ; aucun résultat testé attesté.

<!-- AUTO:START -->

_Section générée par `npm run generate` à partir des rapports réels. Ne pas modifier à la main._

Jeu de données actuellement publié : mode **full** — 1554 fiche(s) au total.

### La baie des images (`external-initial`)

- Fiches dans la bibliothèque : 1130 (published : 0, to-test : 1130, to-confirm : 0, hidden : 0)
- URL : https://vincentflibustier.com/imageia/#bibliotheque
- Dernier import (date réelle) : 2026-10-28T08:57:24.065Z

### Prompt Bible (`prompt-bible`)

- Fiches dans la bibliothèque : 424 (published : 0, to-test : 66, to-confirm : 357, hidden : 1)
- Dernier import (date réelle) : 2026-10-27T15:56:39.064Z

### Journal des imports

- **external-initial** (sample) — 2026-10-28T08:45:23.006Z — réussi : 30 entrée(s) importée(s) sur 1130 analysée(s)
  - Prompts seulement : aucune image téléchargée (option --images pour les récupérer).
- **prompt-bible** (sample) — 2026-10-27T15:35:08.100Z — réussi : 30 entrée(s) importée(s) sur 424 analysée(s)
  - Le classeur ne contient aucune image : toutes les fiches sont « sans image » tant que imports/images/<id>.* n’est pas alimenté.
  - 16 texte(s) sans Entrée_ID (fragments autonomes) non inclus dans le lot pilote ; ils ne deviennent pas des fiches.
- **prompt-bible** (full) — 2026-10-29T09:17:21.692Z — réussi : 424 entrée(s) importée(s) sur 424 analysée(s)
  - Le classeur ne contient aucune image : toutes les fiches sont « sans image » tant que imports/images/<id>.* n’est pas alimenté.
  - 16 texte(s) sans Entrée_ID (fragments autonomes) conservés dans "fragments" du fichier brut ; ils ne deviennent pas des fiches.
- **external-initial** (full) — 2026-10-28T08:57:24.315Z — réussi : 1130 entrée(s) importée(s) sur 1130 analysée(s)
  - Prompts seulement : aucune image téléchargée (option --images pour les récupérer).

<!-- AUTO:END -->
