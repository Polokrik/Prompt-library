# Inspection du fichier Excel

Généré le 2026-10-27T13:21:36.240Z — `imports/prompt-bible/Prompt Bible.xlsx`

## Feuilles
- **CATALOGUE** : 430 lignes (plage A1:AE430)
- **TEXTES** : 843 lignes (plage A1:M843)
- **RÉFÉRENTIELS** : 85 lignes (plage A1:H85)
- **MÉTHODE IMAGE 10 BLOCS** : 58 lignes (plage A1:F58)

CATALOGUE et TEXTES ont un bandeau de 5 lignes ; l’en-tête est en ligne 6. RÉFÉRENTIELS décrit les vocabulaires ; MÉTHODE IMAGE 10 BLOCS est un guide pédagogique (non importé comme fiches).

## Catalogue — 424 fiches

| Colonne | Alimente |
|---|---|
| Entrée_ID | source.originalId + id (conservé tel quel) |
| Titre | title |
| Type proposé | kind + plafond de statut |
| Famille proposée | categories[0] |
| Usages proposés | categories (valeurs séparées par « ; ») |
| Référence requise | requiresReference (Oui/Non ; « À confirmer » = inconnu) |
| Modalité proposée | non utilisée (information de classement) |
| Ratio explicite | ratio |
| Description de travail | description (sauf consignes génériques) |
| Texte principal_ID | prompt (jointure vers TEXTES.Texte_ID) |
| Guide associé | non utilisée (renvoie à la feuille MÉTHODE IMAGE 10 BLOCS) |
| Libellé initial | details["Libellé initial"] si différent du titre |
| Style détaillé | details.Style |
| Technique détaillée | details.Technique |
| Époque / contexte | tags + details.Époque |
| Ambiance | tags (valeurs séparées par « , ») + details.Ambiance |
| Composition / cadrage | details.Composition |
| Sujet / action | details.Sujet |
| Décor | details.Décor |
| Couleurs / lumière | details["Lumière et couleurs"] |
| Format détaillé | details.Format |
| Orientation mentionnée | orientation (si non contradictoire) |
| Fichier mentionné | details.Fichier |
| Durée mentionnée | non utilisée (vidéo) |

**Nature probable**
- style : 210
- prompt : 71
- contenu non reconnu : 61
- template : 41
- technique : 40
- note pédagogique : 1

## Textes — 837 lignes
- Original : 420
- Brique recomposable : 374
- Fragment non rattaché : 16
- Variante (libellé SORA, non vérifié) : 14
- Variante (libellé Gemini, non vérifié) : 13

**Langues proposées**
- À confirmer : 686
- Anglais : 125
- Français : 26

## Identifiants et relations
- Entrée_ID uniques : 424/424
- Texte_ID uniques : 837/837
- Fiches sans texte principal résolvable : 0
- Fiches dont le texte principal n’a pas le rôle « Original » : 4
- Textes sans Entrée_ID (fragments autonomes) : 16

## Marqueurs de statut (cellules contenant « à confirmer » / « à tester » / « non vérifié »)
- CATALOGUE.Référence requise : 411
- CATALOGUE.Usages proposés : 296
- CATALOGUE.Famille proposée : 85
- CATALOGUE.Type proposé : 61
- CATALOGUE.Modalité proposée : 6
- TEXTES.Rôle : 27
- TEXTES.Langue proposée : 686

## Lignes incomplètes
- entriesWithoutCategory : 73
- entriesWithPlaceholderFamily : 85
- entriesWithoutTitle : 0
- entriesWithoutMainText : 0
- textsWithEmptyBody : 0
- textsWithUnknownLanguage : 686

## Colonnes à valeurs multiples (séparateur « ; »)
- Description de travail : 41 cellules
- Usages proposés : 30 cellules
- Orientation mentionnée : 6 cellules
- Ratio explicite : 2 cellules
- Fichier mentionné : 1 cellules
- Format détaillé : 7 cellules
- Style détaillé : 2 cellules
- Ambiance : 1 cellules
- Sujet / action : 1 cellules
- Couleurs / lumière : 1 cellules

## Images
Aucune colonne d’image ni d’URL d’image : les fiches Excel n’ont pas de visuel (à ajouter dans imports/images/<id>.jpg|png|webp).

## Règles de statut appliquées à l’import
- Type = Prompt → to-test si prompt/titre/catégorie présents, sinon to-confirm
- Type = Template / Style / Technique → to-confirm (brique ou modèle, pas une fiche de galerie)
- Type = Note → hidden (note pédagogique)
- Type = À confirmer → to-confirm
- Texte sans Entrée_ID → non importé comme fiche (cité dans le rapport d’import)
