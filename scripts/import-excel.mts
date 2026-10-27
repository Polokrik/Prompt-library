/**
 * npm run import:excel:sample  -> imports/prompt-bible/raw/excel-sample.json (30 fiches max)
 * npm run import:excel         -> imports/prompt-bible/raw/excel-full.json   (tout le classeur)
 *
 * Données brutes : valeurs de cellules copiées telles quelles (colonnes d'origine conservées),
 * sans normalisation ni correction. Les corrections éditoriales vivent dans mapping.json.
 */
import path from 'node:path';
import { exists, parseArgs, readJson, rel, writeJson } from './lib/io.mts';
import { PATHS, SOURCE_IDS } from './lib/paths.mts';
import { pickSample, readRawExcel, type RawText } from './lib/excel.mts';
import type { RawExcelBatch } from './lib/normalize-excel.mts';
import { cleanText, comparable, textProblems } from './lib/text.mts';
import { recordImportReport } from './lib/reports.mts';
import type { ImportReport } from '../src/types/library.ts';

const { flags } = parseArgs(process.argv.slice(2));
const mode = flags.has('full') ? 'full' : 'sample';
const startedAt = new Date().toISOString();

const raw = readRawExcel(PATHS.excelFile);
const catalogue = mode === 'sample' ? pickSample(raw.catalogue, 30) : raw.catalogue;
const ids = new Set(catalogue.map((r) => r.Entrée_ID));
const texts = raw.texts.filter((t) => t.Entrée_ID && ids.has(t.Entrée_ID));
const orphans: RawText[] = raw.texts.filter((t) => !t.Entrée_ID);

const out = path.join(PATHS.excelRawDir, mode === 'sample' ? 'excel-sample.json' : 'excel-full.json');
const batch: RawExcelBatch & { fragments?: RawText[] } = {
  source: SOURCE_IDS.excel,
  file: rel(PATHS.excelFile, PATHS.root),
  importedAt: new Date().toISOString(),
  mode,
  catalogue,
  texts,
  ...(mode === 'full' ? { fragments: orphans } : {}),
};
// Contenu inchangé : on garde la date d'import d'origine (traçabilité, pas de diff inutile).
const previous = exists(out) ? readJson<typeof batch>(out) : undefined;
const unchanged = previous && JSON.stringify({ ...previous, importedAt: '' }) === JSON.stringify({ ...batch, importedAt: '' });
if (unchanged) batch.importedAt = previous.importedAt;
else writeJson(out, batch);

const textById = new Map(raw.texts.map((t) => [t.Texte_ID, t]));
const main = (r: (typeof catalogue)[number]) => cleanText(textById.get(String(r['Texte principal_ID']))?.['Texte intégral']);
const byPrompt = new Map<string, string[]>();
const problems: ImportReport['problematicCharacters'] = [];
for (const r of catalogue) {
  const p = main(r);
  if (p) byPrompt.set(comparable(p), [...(byPrompt.get(comparable(p)) ?? []), r.Entrée_ID]);
  for (const field of ['Titre', 'Description de travail'] as const) {
    for (const issue of textProblems(String(r[field] ?? ''))) problems.push({ id: r.Entrée_ID, field, issue });
  }
}
for (const t of texts) for (const issue of textProblems(String(t['Texte intégral'] ?? ''))) problems.push({ id: t.Texte_ID, field: 'Texte intégral', issue });

const report: ImportReport = {
  source: SOURCE_IDS.excel,
  mode,
  startedAt,
  finishedAt: new Date().toISOString(),
  ok: true,
  analysed: raw.catalogue.length,
  imported: catalogue.length,
  missingPrompt: catalogue.filter((r) => !main(r)).map((r) => r.Entrée_ID),
  missingImage: catalogue.map((r) => r.Entrée_ID),
  missingTitle: catalogue.filter((r) => !cleanText(r.Titre)).map((r) => r.Entrée_ID),
  networkErrors: [],
  exactDuplicatesInBatch: [...byPrompt.values()].filter((g) => g.length > 1),
  problematicCharacters: problems,
  notes: [
    'Le classeur ne contient aucune image : toutes les fiches sont « sans image » tant que imports/images/<id>.* n’est pas alimenté.',
    `${orphans.length} texte(s) sans Entrée_ID (fragments autonomes) ${mode === 'full' ? 'conservés dans "fragments" du fichier brut' : 'non inclus dans le lot pilote'} ; ils ne deviennent pas des fiches.`,
  ],
  output: rel(out, PATHS.root),
};
recordImportReport(report);

console.log(`Import Excel (${mode}) : ${catalogue.length}/${raw.catalogue.length} fiches, ${texts.length} textes -> ${report.output}`);
console.log(`Doublons exacts dans le lot : ${report.exactDuplicatesInBatch.length} groupe(s). Problèmes de caractères : ${problems.length}.`);
