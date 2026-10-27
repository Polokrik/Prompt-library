# Carnet d’images — bibliothèque personnelle de prompts pour images

Une bibliothèque web visuelle (façon moodboard) pour **découvrir, rechercher, copier et retrouver** des prompts de création d’images.
C’est une expérience personnelle : une seule personne maintient le contenu, sans compte, sans serveur, sans base de données distante,
sans suivi des visiteurs. Le site est 100 % statique et se publie gratuitement sur **GitHub Pages**.

L’expérience est notamment inspirée par [« La baie des images » de Vincent Flibustier](https://vincentflibustier.com/imageia/#bibliotheque)
(voir [SOURCES.md](SOURCES.md) et la page « À propos » du site).

> Le nom du site et sa phrase d’accroche sont dans `src/config/site.ts` (un seul fichier à modifier).
> Le titre de l’onglet par défaut dans `index.html` est à aligner si vous changez le nom.

---

## 1. Où en est le projet (état réel)

| Élément | État |
|---|---|
| Application React (accueil, bibliothèque, fiche, favoris, à propos, revue dev) | fonctionnelle |
| Pipeline d’import / normalisation / fusion / doublons / validation / génération | fonctionnel, testé |
| Source **Excel** « Prompt Bible » | inspectée ; **lot pilote de 30 fiches** importé |
| Source **externe** (vincentflibustier.com) | scripts prêts, **non exécutés avec succès** : le domaine est refusé par la politique réseau de l’environnement où le projet a été construit (voir `reports/source-inspection.md`). Aucune donnée externe n’a été inventée. |
| Images | **aucune** pour l’instant : le classeur Excel n’en contient pas et la source externe n’a pas pu être lue |

Conséquence : le lot pilote publié ne contient que des fiches Excel **sans image**, affichées comme vignettes typographiques
(extrait du prompt) avec la mention « À tester ». Les nombres exacts sont dans `reports/validation-report.json` (jamais recopiés ici).

## 2. Stack et dépendances (chacune justifiée)

| Dépendance | Pourquoi |
|---|---|
| `react`, `react-dom` | interface (exigé) |
| `vite`, `@vitejs/plugin-react`, `typescript` | build, serveur de dev, typage (exigé) |
| `sharp` (dev) | optimisation locale des images en WebP (scripts uniquement, absent du site) |
| `xlsx` (SheetJS, dev) | lecture du fichier Excel (scripts uniquement). ⚠ La version npm 0.18.5 a des vulnérabilités connues sur des fichiers hostiles ; elle ne lit ici que **votre propre classeur**, hors navigateur. Ne l’utilisez pas sur des fichiers d’origine inconnue. |
| `vitest` (dev) | tests ciblés, sans infrastructure lourde |
| `axe-core`, `playwright` (dev) | contrôle automatisé d’accessibilité (`npm run a11y`) |

Aucune bibliothèque d’interface, de routage, de recherche, d’état ou d’analytics. Routage par hash (`#/…`) écrit à la main : aucune
réécriture serveur nécessaire sur GitHub Pages. Recherche locale écrite à la main (substring, sans accents/casse).

Prérequis : **Node ≥ 22.21** (scripts `.mts` exécutés nativement, sans compilation).

## 3. Installation et lancement

```bash
npm ci            # installation reproductible
npm run dev       # serveur de dev (http://localhost:5173) — inclut la vue de revue (#/revue)
npm test          # tests unitaires
npm run build     # validation des données + typage + build de production dans dist/
npm run preview   # prévisualiser dist/
```

## 4. Structure du dépôt

```
imports/
  external/            source externe (La baie des images)
    source.json          résultat de l’inspection (stratégie, champs, obstacles) — éditable
    mapping.json         corrections éditoriales de cette source
    raw/                 données brutes (external-sample.json / external-full.json)
    originals/           images téléchargées (ignoré par git)
  prompt-bible/
    Prompt Bible.xlsx    VOTRE classeur (source de vérité)
    mapping.json         corrections éditoriales pour l’Excel
    raw/                 excel-sample.json / excel-full.json (valeurs de cellules, sans transformation)
  images/              images à ajouter à la main : <id de la fiche>.jpg|png|webp
public/
  images/prompts/thumbs|large/   images optimisées (WebP), manifest.json (dimensions)
scripts/               pipeline Node (lib/ = fonctions partagées et testées)
src/                   application (components, pages, features/review, utils, data, types, styles, config)
src/data/              fichiers générés : prompts.json, prompts.public.json, sources.json + collections.json (éditorial)
reports/               import-report, validation-report, duplicates-report, images-report, inspections
generated/             fichiers intermédiaires (ignoré par git)
tests/                 tests Vitest
.github/workflows/deploy.yml
```

Séparation stricte : **brut** (`imports/*/raw`) → **corrections** (`mapping.json`) → **normalisé** (`generated/`) → **publié** (`src/data/`).

## 5. Modèle de données

Types dans `src/types/library.ts` : `PromptEntry`, `PromptStatus`, `PromptImage`, `PromptSource`, `PromptVariant`, `PromptOrientation`,
`ImportReport`, `ValidationIssue`, `DuplicateCandidate` (+ `PromptCollection`, `EditorialOverride`).

**Règle des valeurs absentes (appliquée partout) : la propriété est omise.** Jamais de `null`, de chaîne vide ni de valeur inventée.
`categories`, `tags` et `variants` sont toujours des tableaux (éventuellement vides). `requiresReference: false` n’est écrit que si la source l’affirme.

Écarts assumés par rapport à l’exemple du cahier des charges :
- chemins d’image **sans « / » initial** (`images/prompts/thumbs/ID.webp`) : ils sont résolus avec `import.meta.env.BASE_URL`, indispensable sous `https://utilisateur.github.io/nom-du-repository/` ;
- `image` est **facultatif** (une fiche Excel n’a pas d’image) ; il n’est obligatoire que pour `published` ;
- champs ajoutés : `kind` (prompt/template/style/technique/note), `ratio`, `details` (style, technique, ambiance… issus de l’Excel), `reviewNotes` (pourquoi le statut n’est pas `published`, retiré du build public), `hiddenReason`, `canonicalId`, `collectionIds` (prévus par le mapping).

### Identifiants stables
1. identifiant fourni par la source externe → `ext-<id>` ;
2. identifiant fourni par l’Excel → repris tel quel (`ENT-…`) ;
3. à défaut : hash stable de (source + prompt original) → `ext-h…` / `xl-h…`.
Le titre n’entre jamais dans l’identifiant (il peut être corrigé sans casser les liens ni les images, nommées d’après l’id).

## 6. Statuts éditoriaux

| Statut | Sens | Dans le site public |
|---|---|---|
| `published` | prompt + titre + catégorie + image + texte alternatif, source vérifiée | oui |
| `to-test` | exploitable mais non vérifié, ou sans image | oui, avec la mention « À tester » (texte + bordure pointillée, pas la couleur seule) |
| `to-confirm` | incomplet, ambigu, fragment, doublon probable, catégorie manquante, image sans alt | **non** (vue de revue en dev) |
| `hidden` | conservé dans les données, jamais affiché | **non** |

Le site public n’embarque que `src/data/prompts.public.json` (published + to-test, sans notes de revue) ; `prompts.json` (tout) n’est
lu que par la vue de revue, supprimée du build de production (vérifié par `npm run check:build`).

Règles automatiques (`scripts/lib/status.mts`, `normalize-excel.mts`) : sans prompt/titre/catégorie → `to-confirm` ; prompt de moins de 3 mots → `to-confirm`
(ressemble à un fragment) ; image sans texte alternatif fiable → `to-confirm` (aucun alt n’est généré) ; pas d’image → au mieux `to-test` ;
source Excel jamais « vérifiée » → au mieux `to-test` (le classeur le dit lui-même : « aucun résultat généré ou testé attesté »).

Règles propres à l’Excel (colonne « Type proposé ») : `Prompt` → `to-test` s’il est complet ; `Style`, `Technique`, `Template` → `to-confirm` (ce sont des **briques** ou
des modèles à recomposer, pas des fiches de galerie) ; `Note` → `hidden` ; `À confirmer` → `to-confirm`. Pour promouvoir une brique en fiche : `{ "status": "to-test" }` dans le mapping.
Les 16 textes sans `Entrée_ID` (« Fragment non rattaché ») ne deviennent pas des fiches : ils sont cités dans le rapport d’import et conservés dans `excel-full.json`.

## 7. Imports

### Pilote (déjà réalisé pour l’Excel)
```bash
npm run inspect:excel          # reports/excel-inspection.json|md (lecture seule)
npm run import:excel:sample    # 30 fiches max, lot varié et déterministe (quotas par type) → imports/prompt-bible/raw/excel-sample.json
npm run inspect:source         # ⚠ ACCÈS RÉSEAU — inspection technique, pas de scraping → imports/external/source.json
npm run import:external:sample # ⚠ ACCÈS RÉSEAU — 30 entrées max + leurs images → imports/external/raw/external-sample.json
```

### Source externe : procédure (à faire sur un poste qui peut joindre le site)
1. `npm ci && npm run inspect:source` — lit la page, ses scripts et JSON du même domaine (14 fichiers max, robots.txt respecté, aucun contournement).
2. Lire `reports/source-inspection.md`. Si `strategy` vaut `none-found`, ouvrir la page dans un navigateur (onglet Réseau), repérer l’appel de données et renseigner à la main
   `dataLocation` (`kind: "json"`, `url`) et `fieldMap` dans `imports/external/source.json`.
3. `npm run import:external:sample`, puis `npm run refresh`, puis `npm run dev` et vérifier.
4. Seulement si le pilote est correct : `npm run import:external` (collection entière) puis `npm run refresh:full`.

Les commandes réseau utilisent `node --use-env-proxy` (prise en compte de `HTTPS_PROXY` si présent). Les données sont lues sans jamais exécuter le code de la page ;
les URL sont limitées à http(s), les téléchargements bornés (délai, taille, type de contenu) et espacés.

### Import complet de l’Excel (local, sans réseau)
```bash
npm run import:excel     # → imports/prompt-bible/raw/excel-full.json
npm run refresh:full     # normalise / fusionne / valide / génère à partir des lots « full »
```
`npm run refresh` (sans `:full`) travaille toujours sur les lots **sample**. Le mode du dernier `generate` est indiqué dans `SOURCES.md`.
Un ré-import dont le contenu est inchangé conserve la date d’import d’origine.

## 8. Mapping éditorial (corrections persistantes)

`imports/prompt-bible/mapping.json` et `imports/external/mapping.json`, indexés par id de fiche (voir `_exemple` dans ces fichiers) :

```json
{ "ENT-VNHZB48D": { "status": "published", "title": "…", "categories": ["Photographie"], "tags": ["panda"], "image": { "alt": "…" } } }
```
Clés possibles : `title`, `description`, `status`, `categories`, `tags`, `orientation`, `language`, `requiresReference`, `image.alt`, `generator`, `hiddenReason`, `canonicalId`, `collectionIds`.

**Priorité des valeurs** : 1. données brutes → 2. règles de normalisation → 3. mapping éditorial (prioritaire dès qu’une valeur est explicitement définie, même un tableau vide) → 4. validation finale.
Le mapping est appliqué **avant** le calcul du statut : ajouter une catégorie à une fiche `to-confirm` la fait passer en `to-test`. Un statut forcé ne peut pas dépasser ce que la fiche permet
(ex. `published` sans image est ramené à `to-test` avec un avertissement). Un nouvel import ne touche jamais aux mappings. `canonicalId` marque la fiche comme doublon masqué d’une autre.
Les ids inconnus ou clés inconnues sont signalés à la normalisation.

## 9. Images

Déposer `imports/images/<id>.jpg|png|webp|gif|avif` (l’id est celui de la fiche, ex. `ENT-VNHZB48D.jpg`) ; priorité à l’ajout manuel sur une image téléchargée. `npm run optimize:images` génère :
`public/images/prompts/thumbs/<id>.webp` (≤ 480 px, qualité 72) et `large/<id>.webp` (≤ 1200 px, qualité 82), ratio conservé, métadonnées retirées, orientation EXIF appliquée.
Une image inchangée n’est pas retraitée (empreinte dans `public/images/prompts/manifest.json`, qui stocke aussi les dimensions pour éviter les décalages de mise en page).
Rapport : `reports/images-report.json` (images invalides, absentes, orphelines, collisions, fichiers lourds). Les originaux ne sont jamais copiés dans `public/`.
**Après avoir ajouté l’image, ajoutez son texte alternatif** dans le mapping (`image.alt`) : sans lui la fiche reste `to-confirm`. Un bon alt est court, ne commence pas par « image de », ne répète pas le titre.

## 10. Doublons

`npm run detect:duplicates` → `reports/duplicates-report.json` : `exact`, `near` (similarité ≥ 0,85), `same-image-different-prompt`, `same-prompt-different-image`, `probable-variant`.
Rien n’est supprimé. Pour un doublon exact, le candidat canonique est : décision éditoriale (`canonicalId`) > statut le plus avancé > présence d’image > nombre de catégories+tags > plus petit id.
`merge` passe les autres fiches visibles en `to-confirm` ; vous tranchez avec `canonicalId` (masque) dans le mapping. Les doublons proches ne sont jamais fusionnés automatiquement.

## 11. Validation et build

`npm run validate` → `reports/validation-report.json` + résumé. **Bloquant** : id manquant/dupliqué, statut/orientation/langue invalides, tableaux mal formés, URL source invalide, chemins d’image absolus ou inattendus,
fichier image introuvable, donnée de démonstration, chemin local, doublon exact non traité, fichier > 1,5 Mo dans `public/`, et, **pour les fiches visibles** (published/to-test), titre/prompt/catégorie/alt manquants.
Les mêmes manques sur `to-confirm`/`hidden` sont des avertissements (c’est leur raison d’être). `npm run build` lance la validation puis le typage puis Vite.

## 12. Déploiement GitHub Pages

1. Dépôt GitHub → **Settings → Pages → Build and deployment → Source : GitHub Actions** (une seule fois).
2. Pousser sur `main` : `.github/workflows/deploy.yml` fait `npm ci` → `validate` → `test` → `build` (avec `BASE_PATH=/<nom-du-repo>/`) → `check:build` → `a11y` → publication.
3. Le workflow ne relance **jamais** l’import externe : les données validées sont versionnées.
Sans `BASE_PATH`, le build utilise des chemins relatifs (`./`), qui fonctionnent aussi sous un sous-dossier. Le workflow s’exécute aussi sur les pull requests (sans déployer).

## 13. Ajouter ou corriger un prompt

1. **Modifier** `imports/prompt-bible/Prompt Bible.xlsx` (feuille CATALOGUE/TEXTES) **ou** le `mapping.json` concerné.
2. **Ajouter l’image** si nécessaire : `imports/images/<id>.jpg`, puis son `image.alt` dans le mapping.
3. `npm run import:excel:sample` si le classeur a changé (ou `npm run import:excel` pour tout), puis **`npm run refresh`** (`refresh:full` pour le lot complet).
4. **Consulter** `reports/validation-report.json` et `reports/duplicates-report.json`.
5. `npm run dev`, ouvrir `#/revue` (liste ce qui reste à traiter et quel fichier modifier), vérifier le rendu.
6. `git add -A && git commit && git push`.
7. GitHub Actions publie le site.

### Variante sans terminal (depuis le site GitHub)
1. Dans le dépôt, ouvrir `imports/images/` → *Add file → Upload files* et déposer l'image, nommée comme l'id de la fiche (ex. `ENT-VNHZB48D.jpg`) → *Commit changes* sur `main`.
2. Ouvrir `imports/prompt-bible/mapping.json` → crayon → ajouter la fiche :
   `"ENT-VNHZB48D": { "status": "published", "image": { "alt": "…" }, "generator": "Midjourney" }` → *Commit changes*.
3. Le workflow **Régénérer les données** (`refresh.yml`) optimise l'image, régénère les données, les commite, puis relance le déploiement (≈ 3 min). Un échec de validation apparaît dans l'onglet *Actions* sans rien casser.
`generator` (optionnel) = outil IA ayant produit l'image ; il s'affiche sur la fiche (« Généré avec »).

> Le lot **sample** est un échantillon de 30 fiches : pour publier toute la bibliothèque, passez par `import:excel` + `refresh:full`.

## 14. Commandes

`dev` · `build` · `preview` · `check:build` · `typecheck` · `test` · `a11y` · `inspect:source` ⚠réseau · `inspect:excel` · `import:external:sample` ⚠réseau · `import:external` ⚠réseau ·
`import:excel:sample` · `import:excel` · `optimize:images` · `normalize` · `merge` · `detect:duplicates` · `validate` · `generate` · `refresh` · `refresh:full`.
`refresh` enchaîne, sans réseau : import Excel local → images → normalisation (+ mapping) → fusion → doublons → validation → génération → validation finale.

## 15. Accessibilité

Visée WCAG 2.2 AA : liens d’évitement, titres hiérarchisés, libellés de formulaires visibles, focus toujours visible, cibles ≥ 44 px, nombre de résultats et copie annoncés (`aria-live`),
`prefers-reduced-motion`, thème clair/sombre automatique, statut jamais porté par la couleur seule, images lazy avec dimensions, favoris `aria-pressed`.
`npm run a11y` exécute axe-core sur 6 pages × clair/sombre × mobile/bureau (rapport : `reports/a11y-report.json`, non versionné ; la dernière exécution locale n’a trouvé aucune violation).
Un contrôle automatique ne remplace pas un essai au clavier et au lecteur d’écran.

## 16. Erreurs fréquentes

- *« Lot … absent »* : lancer l’import correspondant avant `normalize`.
- *`inspect:source` → « Page inaccessible »* : le réseau refuse le domaine ; lancer la commande depuis un poste avec accès (voir §7).
- *Fiche toujours `to-confirm` après ajout d’image* : il manque `image.alt` dans le mapping, ou la catégorie.
- *`validate` : « Doublon exact … non traité »* : ajouter `canonicalId` sur la fiche en trop (mapping) ou la masquer.
- *Mapping sans effet* : vérifier l’id (voir les avertissements de `npm run normalize`) et que le JSON est valide.
- *Page blanche sous un sous-dossier* : construire avec `BASE_PATH=/nom-du-repo/`.

## 17. Limites connues

- La source externe n’a pas pu être inspectée depuis l’environnement de construction ; les heuristiques d’extraction (`scripts/lib/extract.mts`) sont testées sur des fixtures synthétiques, **pas sur le vrai site**.
  Elles ne lisent que du JSON (jamais de JavaScript évalué) : si le site fabrique ses données dans un littéral JS non JSON, il faudra renseigner `source.json` à la main.
- Le classeur Excel n’a pas d’images : toutes ses fiches sont sans visuel tant que vous n’en ajoutez pas ; seules les fiches de type `Prompt` sont visibles (les ~290 briques style/technique/modèle restent `to-confirm`).
- La langue n’est pas détectée automatiquement (686 textes sur 837 sont « À confirmer » dans l’Excel) ; le filtre de langue ne porte donc que sur les valeurs renseignées.
- Recherche par sous-chaîne (pas de tolérance aux fautes). Mosaïque en colonnes CSS : l’ordre de lecture visuel suit les colonnes. Détection de doublons proches en O(n²) : adaptée à quelques milliers de fiches.
- Pas de virtualisation : affichage progressif par pages de 48 fiches.
- Les collections (`src/data/collections.json`) sont prévues dans le modèle mais vides : aucune n’a été inventée.
- Le build tel quel n’a pas été exécuté sur GitHub (pas d’exécution de Actions possible depuis l’environnement) ; il l’a été localement avec `BASE_PATH=/Prompt-library/`.
