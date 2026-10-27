/**
 * npm run inspect:excel
 * Inspecte Prompt Bible.xlsx et écrit reports/excel-inspection.json + .md. Ne modifie aucune donnée.
 */
import path from 'node:path';
import {
  CATALOGUE_SHEET,
  TEXTS_SHEET,
  classifyCatalogueRow,
  classifyText,
  headerOf,
  readRawExcel,
  readWorkbook,
  sheetSizes,
  type RowNature,
} from './lib/excel.mts';
import { isPlaceholder } from './lib/placeholders.mts';
import { PATHS } from './lib/paths.mts';
import { writeJson, writeText } from './lib/io.mts';

const wb = readWorkbook(PATHS.excelFile);
const { catalogue, texts } = readRawExcel(PATHS.excelFile);
const sizes = sheetSizes(wb);

const count = <T,>(items: T[], key: (t: T) => string) => {
  const c: Record<string, number> = {};
  for (const it of items) c[key(it)] = (c[key(it)] ?? 0) + 1;
  return Object.fromEntries(Object.entries(c).sort((a, b) => b[1] - a[1]));
};

const catHeader = headerOf(wb, CATALOGUE_SHEET);
const textHeader = headerOf(wb, TEXTS_SHEET);

const COLUMN_TARGETS: Record<string, string> = {
  Entrée_ID: 'source.originalId + id (conservé tel quel)',
  Titre: 'title',
  'Type proposé': 'kind + plafond de statut',
  'Famille proposée': 'categories[0]',
  'Usages proposés': 'categories (valeurs séparées par « ; »)',
  'Référence requise': 'requiresReference (Oui/Non ; « À confirmer » = inconnu)',
  'Modalité proposée': 'non utilisée (information de classement)',
  'Ratio explicite': 'ratio',
  'Description de travail': 'description (sauf consignes génériques)',
  'Texte principal_ID': 'prompt (jointure vers TEXTES.Texte_ID)',
  'Guide associé': 'non utilisée (renvoie à la feuille MÉTHODE IMAGE 10 BLOCS)',
  'Libellé initial': 'details["Libellé initial"] si différent du titre',
  'Style détaillé': 'details.Style',
  'Technique détaillée': 'details.Technique',
  'Époque / contexte': 'tags + details.Époque',
  Ambiance: 'tags (valeurs séparées par « , ») + details.Ambiance',
  'Composition / cadrage': 'details.Composition',
  'Sujet / action': 'details.Sujet',
  Décor: 'details.Décor',
  'Couleurs / lumière': 'details["Lumière et couleurs"]',
  'Format détaillé': 'details.Format',
  'Orientation mentionnée': 'orientation (si non contradictoire)',
  'Fichier mentionné': 'details.Fichier',
  'Durée mentionnée': 'non utilisée (vidéo)',
};

const textTargets: Record<string, string> = {
  Texte_ID: 'variants[].id / prompt principal',
  Entrée_ID: 'relation vers CATALOGUE',
  Rôle: 'variants[].role (Original → prompt ; Variante → variant ; Brique → brick)',
  'Texte intégral': 'prompt / variants[].prompt',
  'Langue proposée': 'language',
};

const natureCatalogue = count(catalogue, (r) => classifyCatalogueRow(r));
const natureTexts = count(texts, (t) => classifyText(t));

const catIds = catalogue.map((r) => r.Entrée_ID);
const textIds = texts.map((t) => t.Texte_ID);
const dupCat = catIds.filter((id, i) => catIds.indexOf(id) !== i);
const dupText = textIds.filter((id, i) => textIds.indexOf(id) !== i);
const textById = new Map(texts.map((t) => [t.Texte_ID, t]));
const catSet = new Set(catIds);
const withoutMain = catalogue.filter((r) => !textById.has(String(r['Texte principal_ID'])));
const orphanTexts = texts.filter((t) => !t.Entrée_ID);
const danglingTexts = texts.filter((t) => t.Entrée_ID && !catSet.has(t.Entrée_ID));
const originalsPerEntry = count(
  catalogue,
  (r) => String(texts.filter((t) => t.Entrée_ID === r.Entrée_ID && t.Rôle === 'Original').length),
);
const mainNotOriginal = catalogue.filter((r) => {
  const t = textById.get(String(r['Texte principal_ID']));
  return t && t.Rôle !== 'Original';
});

const markerRe = /à confirmer|à tester|non vérifié/i;
const markers: Record<string, number> = {};
for (const r of catalogue) for (const h of catHeader) if (markerRe.test(String(r[h] ?? ''))) markers[`${CATALOGUE_SHEET}.${h}`] = (markers[`${CATALOGUE_SHEET}.${h}`] ?? 0) + 1;
for (const t of texts) for (const h of textHeader) if (markerRe.test(String((t as unknown as Record<string, unknown>)[h] ?? ''))) markers[`${TEXTS_SHEET}.${h}`] = (markers[`${TEXTS_SHEET}.${h}`] ?? 0) + 1;

const multiValued: Record<string, number> = {};
for (const r of catalogue) for (const h of catHeader) if (/[;]/.test(String(r[h] ?? ''))) multiValued[h] = (multiValued[h] ?? 0) + 1;

const incomplete = {
  entriesWithoutCategory: catalogue.filter((r) => isPlaceholder(r['Famille proposée']) && isPlaceholder(r['Usages proposés'])).length,
  entriesWithPlaceholderFamily: catalogue.filter((r) => isPlaceholder(r['Famille proposée'])).length,
  entriesWithoutTitle: catalogue.filter((r) => !r.Titre).length,
  entriesWithoutMainText: withoutMain.length,
  textsWithEmptyBody: texts.filter((t) => !String(t['Texte intégral'] ?? '').trim()).length,
  textsWithUnknownLanguage: texts.filter((t) => isPlaceholder(t['Langue proposée'])).length,
};

const longTextColumns = ['Texte intégral'].map((h) => ({
  column: `${TEXTS_SHEET}.${h}`,
  maxLength: Math.max(...texts.map((t) => String(t[h as keyof typeof t] ?? '').length)),
  over1000Chars: texts.filter((t) => String(t[h as keyof typeof t] ?? '').length > 1000).length,
}));

const report = {
  generatedAt: new Date().toISOString(),
  file: path.relative(PATHS.root, PATHS.excelFile).split(path.sep).join('/'),
  sheets: sizes,
  structureNote:
    'CATALOGUE et TEXTES ont un bandeau de 5 lignes ; l’en-tête est en ligne 6. RÉFÉRENTIELS décrit les vocabulaires ; MÉTHODE IMAGE 10 BLOCS est un guide pédagogique (non importé comme fiches).',
  catalogue: {
    rows: catalogue.length,
    columns: catHeader.map((c) => ({ name: c, feedsModel: COLUMN_TARGETS[c] ?? 'non utilisée' })),
    nature: natureCatalogue,
    typeProposed: count(catalogue, (r) => String(r['Type proposé'])),
    family: count(catalogue, (r) => String(r['Famille proposée'])),
    requiredReference: count(catalogue, (r) => String(r['Référence requise'])),
  },
  texts: {
    rows: texts.length,
    columns: textHeader.map((c) => ({ name: c, feedsModel: textTargets[c] ?? 'non utilisée' })),
    roles: count(texts, (t) => String(t.Rôle)),
    nature: natureTexts,
    languages: count(texts, (t) => String(t['Langue proposée'])),
  },
  identifiers: {
    entryIds: catIds.length,
    uniqueEntryIds: new Set(catIds).size,
    duplicatedEntryIds: [...new Set(dupCat)],
    textIds: textIds.length,
    uniqueTextIds: new Set(textIds).size,
    duplicatedTextIds: [...new Set(dupText)],
  },
  relations: {
    textsPerEntryOriginals: originalsPerEntry,
    entriesWithoutResolvableMainText: withoutMain.map((r) => r.Entrée_ID),
    entriesWhoseMainTextIsNotRoleOriginal: mainNotOriginal.map((r) => r.Entrée_ID),
    orphanTexts: orphanTexts.map((t) => ({ id: t.Texte_ID, role: t.Rôle, row: t._row })),
    textsPointingToUnknownEntry: danglingTexts.map((t) => t.Texte_ID),
    guideLinks: count(catalogue.filter((r) => r['Guide associé']), (r) => String(r['Guide associé'])),
  },
  statusMarkers: markers,
  incomplete,
  multiValuedColumns: multiValued,
  longTextColumns,
  images: 'Aucune colonne d’image ni d’URL d’image : les fiches Excel n’ont pas de visuel (à ajouter dans imports/images/<id>.jpg|png|webp).',
  instructionOrNoteColumns: [
    'Description de travail (consignes génériques + descriptions réelles)',
    'Guide associé (renvoi vers la feuille de méthode)',
    'RÉFÉRENTIELS / MÉTHODE IMAGE 10 BLOCS : feuilles de consignes, non importées',
  ],
  statusRulesApplied: {
    'Type = Prompt': 'to-test si prompt/titre/catégorie présents, sinon to-confirm',
    'Type = Template / Style / Technique': 'to-confirm (brique ou modèle, pas une fiche de galerie)',
    'Type = Note': 'hidden (note pédagogique)',
    'Type = À confirmer': 'to-confirm',
    'Texte sans Entrée_ID': 'non importé comme fiche (cité dans le rapport d’import)',
  },
};

writeJson(path.join(PATHS.reports, 'excel-inspection.json'), report);

const md = [
  '# Inspection du fichier Excel',
  '',
  `Généré le ${report.generatedAt} — \`${report.file}\``,
  '',
  '## Feuilles',
  ...sizes.map((s) => `- **${s.name}** : ${s.rows} lignes (plage ${s.ref ?? '—'})`),
  '',
  report.structureNote,
  '',
  `## Catalogue — ${catalogue.length} fiches`,
  '',
  '| Colonne | Alimente |',
  '|---|---|',
  ...report.catalogue.columns.map((c) => `| ${c.name} | ${c.feedsModel} |`),
  '',
  '**Nature probable**',
  ...Object.entries(natureCatalogue).map(([k, v]) => `- ${k} : ${v}`),
  '',
  `## Textes — ${texts.length} lignes`,
  ...Object.entries(report.texts.roles).map(([k, v]) => `- ${k} : ${v}`),
  '',
  '**Langues proposées**',
  ...Object.entries(report.texts.languages).map(([k, v]) => `- ${k} : ${v}`),
  '',
  '## Identifiants et relations',
  `- Entrée_ID uniques : ${report.identifiers.uniqueEntryIds}/${report.identifiers.entryIds}`,
  `- Texte_ID uniques : ${report.identifiers.uniqueTextIds}/${report.identifiers.textIds}`,
  `- Fiches sans texte principal résolvable : ${withoutMain.length}`,
  `- Fiches dont le texte principal n’a pas le rôle « Original » : ${mainNotOriginal.length}`,
  `- Textes sans Entrée_ID (fragments autonomes) : ${orphanTexts.length}`,
  '',
  '## Marqueurs de statut (cellules contenant « à confirmer » / « à tester » / « non vérifié »)',
  ...Object.entries(markers).map(([k, v]) => `- ${k} : ${v}`),
  '',
  '## Lignes incomplètes',
  ...Object.entries(incomplete).map(([k, v]) => `- ${k} : ${v}`),
  '',
  '## Colonnes à valeurs multiples (séparateur « ; »)',
  ...Object.entries(multiValued).map(([k, v]) => `- ${k} : ${v} cellules`),
  '',
  '## Images',
  report.images,
  '',
  '## Règles de statut appliquées à l’import',
  ...Object.entries(report.statusRulesApplied).map(([k, v]) => `- ${k} → ${v}`),
  '',
].join('\n');
writeText(path.join(PATHS.reports, 'excel-inspection.md'), md);

console.log(`Inspection Excel terminée : ${catalogue.length} fiches, ${texts.length} textes.`);
console.log(`Rapports : reports/excel-inspection.json et reports/excel-inspection.md`);
