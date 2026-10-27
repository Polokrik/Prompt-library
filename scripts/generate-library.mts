/**
 * npm run generate
 * generated/merged.json -> src/data/prompts.json (tout), prompts.public.json (publié + à tester,
 * sans notes de revue), sources.json ; met à jour la section automatique de SOURCES.md.
 * collections.json est un fichier éditorial : il n'est jamais écrasé.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PromptEntry } from '../src/types/library.ts';
import { PATHS } from './lib/paths.mts';
import { exists, readJson, writeJson } from './lib/io.mts';
import { IMPORT_REPORT, type ImportReportFile } from './lib/reports.mts';

const merged = readJson<{ mode: string; entries: PromptEntry[] }>(path.join(PATHS.generated, 'merged.json'));
const entries = merged.entries;

const publicEntries = entries
  .filter((e) => e.status === 'published' || e.status === 'to-test')
  .map((e) => {
    const { reviewNotes: _r, hiddenReason: _h, canonicalId: _c, ...rest } = e;
    return rest;
  });

writeJson(path.join(PATHS.dataDir, 'prompts.json'), entries);
writeJson(path.join(PATHS.dataDir, 'prompts.public.json'), publicEntries);
if (!exists(path.join(PATHS.dataDir, 'collections.json'))) writeJson(path.join(PATHS.dataDir, 'collections.json'), []);

const statuses = ['published', 'to-test', 'to-confirm', 'hidden'] as const;
const sourceMap = new Map<string, { id: string; label: string; url?: string; importedAt?: string; count: number; byStatus: Record<string, number> }>();
for (const e of entries) {
  const s =
    sourceMap.get(e.source.id) ??
    { id: e.source.id, label: e.source.label, ...(e.source.url ? { url: e.source.url } : {}), count: 0, byStatus: Object.fromEntries(statuses.map((k) => [k, 0])) };
  s.count++;
  s.byStatus[e.status]!++;
  if (e.source.importedAt && (!s.importedAt || e.source.importedAt > s.importedAt)) s.importedAt = e.source.importedAt;
  sourceMap.set(e.source.id, s);
}
const sources = [...sourceMap.values()];
writeJson(path.join(PATHS.dataDir, 'sources.json'), sources);

// --- SOURCES.md : section automatique ---------------------------------------------------------
const START = '<!-- AUTO:START -->';
const END = '<!-- AUTO:END -->';
const reports = readJson<ImportReportFile>(IMPORT_REPORT, { note: '', runs: {} });
const lines: string[] = [START, '', '_Section générée par `npm run generate` à partir des rapports réels. Ne pas modifier à la main._', ''];
lines.push(`Jeu de données actuellement publié : mode **${merged.mode}** — ${entries.length} fiche(s) au total.`, '');
for (const s of sources) {
  lines.push(`### ${s.label} (\`${s.id}\`)`, '');
  lines.push(`- Fiches dans la bibliothèque : ${s.count} (${statuses.map((k) => `${k} : ${s.byStatus[k]}`).join(', ')})`);
  if (s.url) lines.push(`- URL : ${s.url}`);
  if (s.importedAt) lines.push(`- Dernier import (date réelle) : ${s.importedAt}`);
  lines.push('');
}
lines.push('### Journal des imports', '');
const runs = Object.values(reports.runs);
if (runs.length === 0) lines.push('Aucun import enregistré.');
for (const r of runs) {
  lines.push(
    `- **${r.source}** (${r.mode}) — ${r.finishedAt} — ${r.ok ? 'réussi' : '**échec**'} : ${r.imported} entrée(s) importée(s) sur ${r.analysed} analysée(s)` +
      (r.networkErrors.length ? `, ${r.networkErrors.length} erreur(s) réseau` : ''),
  );
  for (const n of r.notes) lines.push(`  - ${n}`);
  for (const e of r.networkErrors.slice(0, 3)) lines.push(`  - Erreur réseau : ${e.error}`);
}
lines.push('', END);
const sourcesMd = path.join(PATHS.root, 'SOURCES.md');
const block = lines.join('\n');
if (exists(sourcesMd)) {
  const cur = fs.readFileSync(sourcesMd, 'utf8');
  const a = cur.indexOf(START);
  const b = cur.indexOf(END);
  fs.writeFileSync(sourcesMd, a >= 0 && b > a ? cur.slice(0, a) + block + cur.slice(b + END.length) : `${cur.trimEnd()}\n\n${block}\n`);
}
console.log(`Génération : ${entries.length} fiches (${publicEntries.length} publiques) -> src/data/prompts.json, prompts.public.json, sources.json`);
