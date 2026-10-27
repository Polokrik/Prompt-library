/**
 * npm run normalize [-- --full]
 * Données brutes -> fiches normalisées (une sortie par source dans generated/).
 * Ordre : normalisation de forme -> mapping éditorial -> image -> statut -> invariants.
 */
import path from 'node:path';
import type { EditorialMapping, PromptEntry } from '../src/types/library.ts';
import { parseArgs, readJson, writeJson } from './lib/io.mts';
import { PATHS, SOURCE_IDS } from './lib/paths.mts';
import { loadBatches } from './lib/sources.mts';
import { normalizeExcel, type ExcelDraft } from './lib/normalize-excel.mts';
import { normalizeExternal } from './lib/normalize-external.mts';
import { applyMapping } from './lib/mapping.mts';
import { resolveImage, readManifest } from './lib/images.mts';
import { finalizeEntry, type NatureCap } from './lib/status.mts';

export interface NormalizedFile {
  source: string;
  mode: 'sample' | 'full';
  entries: PromptEntry[];
  warnings: string[];
}

interface Draft {
  entry: PromptEntry;
  cap?: NatureCap;
  alt?: string;
}

function build(drafts: Draft[], mapping: EditorialMapping, label: string, verified: boolean) {
  const mapped = applyMapping(drafts.map((d) => d.entry), mapping, label);
  const manifest = readManifest();
  const warnings = [...mapped.warnings];
  const entries = mapped.entries.map((entry, i) => {
    const draft = drafts[i]!;
    const alt = mapped.altOverrides.get(entry.id) ?? draft.alt;
    const image = resolveImage(entry.id, alt, manifest);
    const withImage: PromptEntry = image ? { ...entry, image } : entry;
    const forced = mapped.forcedStatus.get(entry.id);
    const res = finalizeEntry(withImage, {
      verified,
      ...(forced ? { forced } : {}),
      ...(draft.cap ? { cap: draft.cap } : {}),
    });
    warnings.push(...res.warnings.map((w) => `${label} : ${w}`));
    return res.entry;
  });
  return { entries, warnings };
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const batches = loadBatches(flags.has('sample'));
  batches.notes.forEach((n) => console.log(`  ! ${n}`));
  const summary: string[] = [];

  if (batches.excel) {
    const drafts: Draft[] = normalizeExcel(batches.excel).map(({ entry, cap }: ExcelDraft) => ({ entry, ...(cap ? { cap } : {}) }));
    const mapping = readJson<EditorialMapping>(PATHS.excelMapping, {});
    const { entries, warnings } = build(drafts, mapping, 'prompt-bible', false);
    const file: NormalizedFile = { source: SOURCE_IDS.excel, mode: batches.excel.mode, entries, warnings };
    writeJson(path.join(PATHS.generated, `normalized-${SOURCE_IDS.excel}.json`), file);
    summary.push(`prompt-bible : ${entries.length} fiches`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  if (batches.external) {
    const drafts: Draft[] = normalizeExternal(batches.external).map(({ entry, alt }) => ({ entry, ...(alt ? { alt } : {}) }));
    const mapping = readJson<EditorialMapping>(PATHS.externalMapping, {});
    const { entries, warnings } = build(drafts, mapping, 'external', true);
    const file: NormalizedFile = { source: SOURCE_IDS.external, mode: batches.external.mode, entries, warnings };
    writeJson(path.join(PATHS.generated, `normalized-${SOURCE_IDS.external}.json`), file);
    summary.push(`external-initial : ${entries.length} fiches`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  if (summary.length === 0) {
    console.error('Aucun lot brut disponible : lancer d’abord un import.');
    process.exit(1);
  }
  console.log(`Normalisation (${batches.mode}) : ${summary.join(' ; ')}`);
}

main();
