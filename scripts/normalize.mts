/**
 * npm run normalize [-- --full]
 * Données brutes -> fiches normalisées (une sortie par source dans generated/).
 * Ordre : normalisation de forme -> mapping éditorial -> image -> statut -> invariants.
 */
import path from 'node:path';
import type { EditorialMapping, PromptEntry } from '../src/types/library.ts';
import { exists, parseArgs, readJson, writeJson } from './lib/io.mts';
import { PATHS, SOURCE_IDS } from './lib/paths.mts';
import { loadBatches } from './lib/sources.mts';
import { normalizeExcel, type ExcelDraft } from './lib/normalize-excel.mts';
import { normalizeExternal } from './lib/normalize-external.mts';
import { applyMapping } from './lib/mapping.mts';
import { resolveImage, readManifest } from './lib/images.mts';
import { finalizeEntry, type NatureCap } from './lib/status.mts';
import { attachImage } from './lib/attach.mts';
import { buildRefIndex, parseDescriptions } from './lib/refs.mts';
import { refEntries } from './lib/sources.mts';
import fs from 'node:fs';

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

function build(drafts: Draft[], mapping: EditorialMapping, label: string, verified: boolean, descriptions: Map<string, string>) {
  const mapped = applyMapping(drafts.map((d) => d.entry), mapping, label);
  const manifest = readManifest();
  const warnings = [...mapped.warnings];
  const entries = mapped.entries.map((entry, i) => {
    const draft = drafts[i]!;
    // Priorité du texte alternatif : mapping > descriptions.txt > source. Jamais généré.
    const alt = mapped.altOverrides.get(entry.id) ?? descriptions.get(entry.id) ?? draft.alt;
    const image = resolveImage(entry.id, alt, manifest);
    const attached = attachImage(entry, image, manifest[entry.id]?.generator);
    const forced = mapped.forcedStatus.get(entry.id);
    // Une image fournie par l'auteur du site (qui a généré et vérifié le résultat) vaut vérification.
    const res = finalizeEntry(attached.entry, {
      verified: verified || !!attached.entry.image,
      ...(forced ? { forced } : {}),
      ...(draft.cap ? { cap: draft.cap } : {}),
    });
    warnings.push(...res.warnings.map((w) => `${label} : ${w}`));
    if (attached.pending) {
      res.entry.reviewNotes = [...(res.entry.reviewNotes ?? []), 'Image prête mais sans description : ajouter une ligne dans imports/descriptions.txt'];
      warnings.push(`${label} : ${entry.id} a une image sans description (imports/descriptions.txt) : image non publiée.`);
    }
    return res.entry;
  });
  return { entries, warnings };
}

function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const batches = loadBatches(flags.has('sample'));
  batches.notes.forEach((n) => console.log(`  ! ${n}`));
  const summary: string[] = [];

  // imports/descriptions.txt : `référence | description`, une ligne par image (voir docs/AJOUTER-UNE-IMAGE.md)
  const refs = buildRefIndex(refEntries(batches));
  const descriptions = new Map<string, string>();
  if (exists(PATHS.descriptions)) {
    for (const d of parseDescriptions(fs.readFileSync(PATHS.descriptions, 'utf8'))) {
      const r = refs.resolve(d.ref);
      if ('error' in r) console.log(`  ⚠ descriptions.txt ligne ${d.line} : ${r.error}`);
      else descriptions.set(r.id, d.text);
    }
  }

  if (batches.excel) {
    const drafts: Draft[] = normalizeExcel(batches.excel).map(({ entry, cap }: ExcelDraft) => ({ entry, ...(cap ? { cap } : {}) }));
    const mapping = readJson<EditorialMapping>(PATHS.excelMapping, {});
    const { entries, warnings } = build(drafts, mapping, 'prompt-bible', false, descriptions);
    const file: NormalizedFile = { source: SOURCE_IDS.excel, mode: batches.excel.mode, entries, warnings };
    writeJson(path.join(PATHS.generated, `normalized-${SOURCE_IDS.excel}.json`), file);
    summary.push(`prompt-bible : ${entries.length} fiches`);
    warnings.forEach((w) => console.log(`  ⚠ ${w}`));
  }
  if (batches.external) {
    const drafts: Draft[] = normalizeExternal(batches.external).map(({ entry, alt }) => ({ entry, ...(alt ? { alt } : {}) }));
    const mapping = readJson<EditorialMapping>(PATHS.externalMapping, {});
    const { entries, warnings } = build(drafts, mapping, 'external', true, descriptions);
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
