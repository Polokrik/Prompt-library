/**
 * npm run detect:duplicates [-- --input=src/data/prompts.json]
 * Écrit reports/duplicates-report.json. Ne modifie aucune donnée.
 */
import path from 'node:path';
import type { PromptEntry } from '../src/types/library.ts';
import { parseArgs, readJson, writeJson } from './lib/io.mts';
import { PATHS } from './lib/paths.mts';
import { detectDuplicates, NEAR_THRESHOLD, VARIANT_THRESHOLD } from './lib/duplicates.mts';
import { imageKeyOf } from './lib/images.mts';

const { values } = parseArgs(process.argv.slice(2));
const input = path.resolve(PATHS.root, values.input ?? 'generated/merged.json');
const data = readJson<{ entries: PromptEntry[] } | PromptEntry[]>(input);
const entries = Array.isArray(data) ? data : data.entries;
const candidates = detectDuplicates(entries, imageKeyOf);

const byType: Record<string, number> = {};
for (const c of candidates) byType[c.type] = (byType[c.type] ?? 0) + 1;
writeJson(path.join(PATHS.reports, 'duplicates-report.json'), {
  generatedAt: new Date().toISOString(),
  entriesAnalysed: entries.filter((e) => e.status !== 'hidden').length,
  thresholds: { near: NEAR_THRESHOLD, probableVariant: VARIANT_THRESHOLD },
  canonicalRule:
    'Doublons exacts : décision éditoriale (canonicalId) > statut le plus avancé > présence d’une image > nombre de catégories+tags > identifiant le plus petit.',
  counts: byType,
  candidates,
});
console.log(`Doublons : ${candidates.length} candidat(s) ${Object.entries(byType).map(([k, v]) => `${k}=${v}`).join(' ')}`);
