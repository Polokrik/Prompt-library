/**
 * npm run import:external:sample -> imports/external/raw/external-sample.json (30 entrées max)
 * npm run import:external        -> imports/external/raw/external-full.json   (toute la collection)
 *
 * ACCÈDE AU SITE EXTERNE. Prérequis : imports/external/source.json produit par `npm run inspect:source`
 * (ou renseigné à la main). Le fichier brut conserve l'objet source tel quel (`original`) ;
 * aucune normalisation n'y est appliquée. Les images des entrées retenues sont téléchargées dans
 * imports/external/originals/ (ignoré par git) puis optimisées par `npm run optimize:images`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, readJson, rel, exists, writeJson } from './lib/io.mts';
import { PATHS, SOURCE_IDS } from './lib/paths.mts';
import { FetchError, fetchLimited, sleep } from './lib/net.mts';
import { bestCandidate, extractJsonBlobs, findCandidateArrays, toRawEntry, type FieldMap } from './lib/extract.mts';
import { externalEntryId, type RawExternalBatch, type RawExternalEntry } from './lib/normalize-external.mts';
import { comparable, safeFileStem, safeUrl, textProblems } from './lib/text.mts';
import { recordImportReport } from './lib/reports.mts';
import type { ImportReport } from '../src/types/library.ts';

const SAMPLE_LIMIT = 30;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const EXT_BY_TYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
};

interface SourceJson {
  inspectedUrl: string;
  reachable: boolean;
  strategy: string;
  dataLocation?: { url: string; kind: 'json' | 'embedded'; candidatePath: string };
  fieldMap: FieldMap;
}

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const mode: 'sample' | 'full' = flags.has('full') ? 'full' : 'sample';
  const startedAt = new Date().toISOString();
  const report: ImportReport = {
    source: SOURCE_IDS.external,
    mode,
    startedAt,
    finishedAt: startedAt,
    ok: false,
    analysed: 0,
    imported: 0,
    missingPrompt: [],
    missingImage: [],
    missingTitle: [],
    networkErrors: [],
    exactDuplicatesInBatch: [],
    problematicCharacters: [],
    notes: [],
  };
  const fail = (msg: string, hint?: string): never => {
    report.notes.push(msg, ...(hint ? [hint] : []));
    report.finishedAt = new Date().toISOString();
    recordImportReport(report);
    console.error(`Import externe interrompu : ${msg}`);
    if (hint) console.error(`  → ${hint}`);
    console.error('  Rapport : reports/import-report.json');
    process.exit(2);
  };

  if (!exists(PATHS.externalSource)) {
    fail('imports/external/source.json absent.', 'Lancer d’abord `npm run inspect:source` (accès réseau requis).');
  }
  const src = readJson<SourceJson>(PATHS.externalSource);
  if (!src.dataLocation || Object.keys(src.fieldMap ?? {}).length === 0) {
    fail(
      `Aucune source de données exploitable dans source.json (stratégie : ${src.strategy}).`,
      'Voir reports/source-inspection.md et la procédure locale ; renseigner dataLocation et fieldMap si besoin.',
    );
  }
  const loc = src.dataLocation!;

  // 1. Récupération des données (un seul fichier, borné)
  let items: Record<string, unknown>[];
  try {
    const res = await fetchLimited(loc.url, { maxBytes: 30 * 1024 * 1024 });
    if (!res.ok) throw new FetchError(`HTTP ${res.status} : ${loc.url}`);
    const text = res.body.toString('utf8');
    const blobs = loc.kind === 'json' ? [JSON.parse(text)] : extractJsonBlobs(text);
    const candidates = blobs.flatMap((b) => findCandidateArrays(b));
    const chosen = candidates.find((c) => c.path === loc.candidatePath) ?? bestCandidate(blobs);
    if (!chosen) throw new Error('Aucun tableau de données trouvé à l’emplacement indiqué.');
    if (chosen.path !== loc.candidatePath) report.notes.push(`Chemin ${loc.candidatePath} introuvable ; utilisation de ${chosen.path}.`);
    items = chosen.items;
  } catch (e) {
    report.networkErrors.push({ url: loc.url, error: (e as Error).message });
    return fail(`Lecture des données impossible : ${(e as Error).message}`, 'Vérifier l’accès réseau puis relancer.');
  }
  report.analysed = items.length;

  const kept = mode === 'sample' ? items.slice(0, SAMPLE_LIMIT) : items;
  const entries: RawExternalEntry[] = kept.map((obj, i) => toRawEntry(obj, i + 1, src.fieldMap));
  const batch: RawExternalBatch = {
    source: SOURCE_IDS.external,
    sourceUrl: src.inspectedUrl,
    importedAt: new Date().toISOString(),
    mode,
    entries,
  };
  const out = path.join(PATHS.externalRawDir, `external-${mode}.json`);
  writeJson(out, batch);

  // 2. Contrôles
  const byPrompt = new Map<string, string[]>();
  for (const e of entries) {
    const id = externalEntryId(e);
    if (!e.prompt?.trim()) report.missingPrompt.push(id);
    else byPrompt.set(comparable(e.prompt), [...(byPrompt.get(comparable(e.prompt)) ?? []), id]);
    if (!e.title?.trim()) report.missingTitle.push(id);
    if (!e.imageUrl) report.missingImage.push(id);
    for (const field of ['title', 'prompt'] as const) {
      for (const issue of textProblems(e[field] ?? '')) report.problematicCharacters.push({ id, field, issue });
    }
  }
  report.exactDuplicatesInBatch = [...byPrompt.values()].filter((g) => g.length > 1);

  // 3. Images des entrées retenues uniquement
  fs.mkdirSync(PATHS.externalOriginals, { recursive: true });
  let downloaded = 0;
  for (const e of entries) {
    if (!e.imageUrl) continue;
    const id = externalEntryId(e);
    const url = safeUrl(e.imageUrl, loc.url);
    if (!url) {
      report.networkErrors.push({ url: e.imageUrl, error: 'URL d’image refusée (schéma ou format invalide)' });
      continue;
    }
    const stem = safeFileStem(id);
    if (fs.readdirSync(PATHS.externalOriginals).some((f) => path.basename(f, path.extname(f)) === stem)) continue;
    try {
      await sleep(250);
      const r = await fetchLimited(url, { maxBytes: MAX_IMAGE_BYTES, accept: 'image/*' });
      const ext = EXT_BY_TYPE[r.contentType.split(';')[0]!.trim().toLowerCase()];
      if (!r.ok) throw new FetchError(`HTTP ${r.status}`);
      if (!ext) throw new FetchError(`type de contenu non image : ${r.contentType || 'inconnu'}`);
      fs.writeFileSync(path.join(PATHS.externalOriginals, `${stem}${ext}`), r.body);
      downloaded++;
    } catch (err) {
      report.networkErrors.push({ url, error: (err as Error).message });
    }
  }

  report.imported = entries.length;
  report.ok = true;
  report.output = rel(out, PATHS.root);
  report.notes.push(`${downloaded} image(s) téléchargée(s) dans imports/external/originals/ (non versionné).`);
  report.finishedAt = new Date().toISOString();
  recordImportReport(report);
  console.log(`Import externe (${mode}) : ${entries.length}/${items.length} entrées -> ${report.output} ; ${downloaded} image(s).`);
  console.log(`Prompts absents : ${report.missingPrompt.length} ; images absentes : ${report.missingImage.length} ; erreurs réseau : ${report.networkErrors.length}.`);
  console.log('Étape suivante : npm run refresh');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
