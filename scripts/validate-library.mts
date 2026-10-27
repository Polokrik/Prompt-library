/**
 * npm run validate [-- --input=generated/merged.json]
 * Valide la bibliothèque (par défaut src/data/prompts.json), écrit reports/validation-report.json
 * et affiche un résumé. Code de sortie 1 uniquement s'il existe des erreurs bloquantes.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PromptCollection, PromptEntry, ValidationIssue } from '../src/types/library.ts';
import { parseArgs, readJson, writeJson } from './lib/io.mts';
import { PATHS } from './lib/paths.mts';
import { validateLibrary } from './lib/validate.mts';
import { detectDuplicates } from './lib/duplicates.mts';
import { imageKeyOf } from './lib/images.mts';

const MAX_FILE_BYTES = 1_500_000;
const WARN_THUMB = 120 * 1024;
const WARN_LARGE = 500 * 1024;

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

const { values } = parseArgs(process.argv.slice(2));
const input = path.resolve(PATHS.root, values.input ?? 'src/data/prompts.json');
const data = readJson<{ entries: PromptEntry[] } | PromptEntry[]>(input);
const entries = Array.isArray(data) ? data : data.entries;

const duplicates = detectDuplicates(entries, imageKeyOf);
const issues: ValidationIssue[] = validateLibrary(entries, {
  duplicates,
  imageExists: (p) => fs.existsSync(path.join(PATHS.publicDir, p)),
});

// Fichiers publiés
for (const f of walk(PATHS.publicDir)) {
  const size = fs.statSync(f).size;
  const rel = path.relative(PATHS.publicDir, f).split(path.sep).join('/');
  if (size > MAX_FILE_BYTES) issues.push({ severity: 'error', code: 'file-too-large', message: `Fichier publié trop volumineux : ${rel} (${size} octets)` });
  else if (rel.includes('/thumbs/') && size > WARN_THUMB) issues.push({ severity: 'warning', code: 'thumb-heavy', message: `Miniature lourde : ${rel} (${Math.round(size / 1024)} Ko)` });
  else if (rel.includes('/large/') && size > WARN_LARGE) issues.push({ severity: 'warning', code: 'large-heavy', message: `Grande image lourde : ${rel} (${Math.round(size / 1024)} Ko)` });
  if (/(^|\/)demo(\/|$)/i.test(rel)) issues.push({ severity: 'error', code: 'demo-in-public', message: `Dossier/fichier de démonstration dans public/ : ${rel}` });
  if (!/\.(webp|svg|json|ico|png|txt)$/i.test(rel)) issues.push({ severity: 'warning', code: 'public-unexpected-file', message: `Fichier inattendu dans public/ : ${rel}` });
}

// Collections
const collectionsFile = path.join(PATHS.dataDir, 'collections.json');
if (fs.existsSync(collectionsFile)) {
  const ids = new Set(entries.map((e) => e.id));
  for (const c of readJson<PromptCollection[]>(collectionsFile)) {
    for (const id of c.promptIds) {
      if (!ids.has(id)) issues.push({ severity: 'warning', code: 'collection-unknown-prompt', message: `Collection « ${c.id} » : fiche inconnue ${id}` });
    }
  }
}

const errors = issues.filter((i) => i.severity === 'error');
const warnings = issues.filter((i) => i.severity === 'warning');
const count = (s: string) => entries.filter((e) => e.status === s).length;
const notHidden = entries.filter((e) => e.status !== 'hidden');
const withImage = entries.filter((e) => e.image);
const stats = {
  analysed: entries.length,
  published: count('published'),
  toTest: count('to-test'),
  toConfirm: count('to-confirm'),
  hidden: count('hidden'),
  missingImages: notHidden.filter((e) => !e.image).length,
  missingAlt: withImage.filter((e) => !e.image?.alt?.trim()).length,
  duplicateCandidates: duplicates.length,
  blockingErrors: errors.length,
  warnings: warnings.length,
};

writeJson(path.join(PATHS.reports, 'validation-report.json'), {
  generatedAt: new Date().toISOString(),
  input: path.relative(PATHS.root, input).split(path.sep).join('/'),
  stats,
  issues,
});

const row = (label: string, v: number) => `${label.padEnd(28)}: ${v}`;
console.log(
  [
    'Validation terminée',
    '',
    row('Fiches analysées', stats.analysed),
    row('Fiches publiables', stats.published),
    row('Fiches à tester', stats.toTest),
    row('Fiches à confirmer', stats.toConfirm),
    row('Fiches masquées', stats.hidden),
    row('Images absentes', stats.missingImages),
    row('Textes alternatifs absents', stats.missingAlt),
    row('Doublons potentiels', stats.duplicateCandidates),
    row('Erreurs bloquantes', stats.blockingErrors),
    row('Avertissements', stats.warnings),
  ].join('\n'),
);
if (errors.length) {
  console.error('\nErreurs bloquantes :');
  errors.slice(0, 25).forEach((i) => console.error(`  ✗ [${i.code}] ${i.entryId ?? ''} ${i.message}`));
  if (errors.length > 25) console.error(`  … et ${errors.length - 25} autre(s) : voir reports/validation-report.json`);
  process.exit(1);
}
