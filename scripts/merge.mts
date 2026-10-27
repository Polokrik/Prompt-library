/**
 * npm run merge
 * Fusionne les sources normalisées en une bibliothèque unique (generated/merged.json).
 * - une seule liste : les lots sont entrelacés, la provenance reste dans `source` ;
 * - doublons exacts : jamais supprimés, la fiche non canonique passe en « à confirmer »
 *   (ou « hidden » si le mapping la désigne via canonicalId).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PromptEntry } from '../src/types/library.ts';
import { PATHS, SOURCE_IDS } from './lib/paths.mts';
import { exists, readJson, writeJson } from './lib/io.mts';
import type { NormalizedFile } from './normalize.mts';
import { detectDuplicates } from './lib/duplicates.mts';
import { imageKeyOf } from './lib/images.mts';

export function interleave<T>(lists: T[][]): T[] {
  const out: T[] = [];
  const max = Math.max(0, ...lists.map((l) => l.length));
  // Répartition proportionnelle : chaque liste avance selon sa taille.
  const cursors = lists.map(() => 0);
  for (let step = 0; step < max * lists.length && out.length < lists.reduce((n, l) => n + l.length, 0); step++) {
    let best = -1;
    let bestRatio = Infinity;
    lists.forEach((l, i) => {
      if (cursors[i]! >= l.length) return;
      const ratio = cursors[i]! / l.length;
      if (ratio < bestRatio) {
        bestRatio = ratio;
        best = i;
      }
    });
    if (best < 0) break;
    out.push(lists[best]![cursors[best]!++]!);
  }
  return out;
}

export function mergeEntries(lists: PromptEntry[][]): { entries: PromptEntry[]; notes: string[] } {
  const notes: string[] = [];
  const merged = interleave(lists);
  const ids = new Map<string, PromptEntry>();
  for (const e of merged) {
    if (ids.has(e.id)) throw new Error(`Identifiant en collision entre sources : ${e.id}`);
    ids.set(e.id, e);
  }

  const result = merged.map((e) => ({ ...e }));
  const byId = new Map(result.map((e) => [e.id, e]));
  const visible = (e: PromptEntry) => e.status === 'published' || e.status === 'to-test';

  // 1. Décisions éditoriales : canonicalId => la fiche est un doublon masqué (conservée dans les données).
  for (const e of result) {
    if (!e.canonicalId) continue;
    if (e.canonicalId === e.id || !byId.has(e.canonicalId)) {
      notes.push(`${e.id} : canonicalId « ${e.canonicalId} » invalide ou inconnu, ignoré.`);
      delete e.canonicalId;
      continue;
    }
    if (e.status !== 'hidden') {
      e.status = 'hidden';
      e.hiddenReason ??= `Doublon de ${e.canonicalId} (décision éditoriale)`;
      e.reviewNotes = [...(e.reviewNotes ?? []), `Doublon de ${e.canonicalId} : masquée via canonicalId`];
    }
  }

  // 2. Doublons exacts restants : non-canoniques visibles => à confirmer (rien n'est supprimé).
  const exact = detectDuplicates(result, imageKeyOf).filter((c) => c.type === 'exact');
  for (const c of exact) {
    for (const id of c.ids) {
      const e = byId.get(id)!;
      if (id === c.canonicalId || !visible(e)) continue;
      e.status = 'to-confirm';
      e.reviewNotes = [...(e.reviewNotes ?? []), `Doublon exact de ${c.canonicalId} : à traiter (mapping : canonicalId)`];
      notes.push(`${id} : doublon exact de ${c.canonicalId}, passée en « to-confirm ».`);
    }
  }
  return { entries: result, notes };
}

function main() {
  const files = [SOURCE_IDS.external, SOURCE_IDS.excel]
    .map((s) => path.join(PATHS.generated, `normalized-${s}.json`))
    .filter(exists);
  if (files.length === 0) {
    console.error('Aucune source normalisée : lancer npm run normalize.');
    process.exit(1);
  }
  const normalized = files.map((f) => readJson<NormalizedFile>(f));
  const modes = new Set(normalized.map((n) => n.mode));
  const { entries, notes } = mergeEntries(normalized.map((n) => n.entries));
  fs.mkdirSync(PATHS.generated, { recursive: true });
  writeJson(path.join(PATHS.generated, 'merged.json'), {
    generatedAt: new Date().toISOString(),
    mode: modes.size === 1 ? [...modes][0] : 'mixed',
    sources: normalized.map((n) => ({ source: n.source, mode: n.mode, count: n.entries.length })),
    notes: [...notes, ...normalized.flatMap((n) => n.warnings)],
    entries,
  });
  console.log(`Fusion : ${entries.length} fiches (${normalized.map((n) => `${n.source}: ${n.entries.length}`).join(', ')}).`);
  notes.forEach((n) => console.log(`  ⚠ ${n}`));
}

if (import.meta.url === `file://${process.argv[1]}`) main();
