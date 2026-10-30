/**
 * npm run optimize:images
 * Sources (par ordre de priorité) :
 *   1. imports/images/<référence>[__<outil>].<jpg|jpeg|png|webp|gif|avif>   (ajout manuel)
 *      <référence> = identifiant de la fiche, ou titre exact s'il est unique ; <outil> = outil IA
 *   2. imports/external/originals/<id>.<ext>                                (téléchargé par import:external --images)
 * Sorties : public/images/prompts/thumbs/<id>.webp (≤ 480 px) et large/<id>.webp (≤ 1200 px).
 * Les originaux ne sont jamais copiés dans public/. Une image inchangée n'est pas retraitée.
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, rel, writeJson } from './lib/io.mts';
import { PATHS } from './lib/paths.mts';
import { IMAGE_MANIFEST, imagePaths, readManifest, type ImageManifest } from './lib/images.mts';
import { safeFileStem, sha1 } from './lib/text.mts';
import { imageLookupKey, loadBatches, refEntries, sourceImageIndex } from './lib/sources.mts';
import { buildRefIndex, LEGACY_SUFFIX, parseImageStem } from './lib/refs.mts';

export const THUMB = { width: 480, quality: 72 };
export const LARGE = { width: 1200, quality: 82 };
const PARAMS_VERSION = `v1:${THUMB.width}:${THUMB.quality}:${LARGE.width}:${LARGE.quality}`;
const EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const HEAVY_THUMB = 120 * 1024;
const HEAVY_LARGE = 500 * 1024;

interface SourceFile {
  /** Identifiant de la fiche (nom des fichiers produits). */
  id: string;
  file: string;
  origin: 'manual' | 'external';
  /** Outil IA lu dans le nom (`ID__Outil.jpg`). */
  tool?: string;
  rank: number;
}

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const batches = loadBatches(flags.has('sample'));
  const entries = refEntries(batches);
  const knownIds = new Set(entries.map((e) => e.id));
  const refs = buildRefIndex(entries);
  const sourceImages = sourceImageIndex(batches);
  let matchedBySource = 0;

  const sources = new Map<string, SourceFile>();
  const warnings: string[] = [];
  const unresolved: { file: string; error: string }[] = [];
  const candidates: { file: string; origin: SourceFile['origin'] }[] = [];
  for (const [dir, origin] of [[PATHS.externalOriginals, 'external'], [PATHS.manualImages, 'manual']] as const) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).sort()) {
      if (EXTS.includes(path.extname(f).toLowerCase())) candidates.push({ file: path.join(dir, f), origin });
    }
  }
  const multiple: string[] = [];
  for (const c of candidates) {
    const stem = path.basename(c.file, path.extname(c.file));
    // 1. Nom exact d'une image de la source (ym-5489-thumb -> ym-5489) : correspondance fournie par la source.
    const isLegacy = LEGACY_SUFFIX.test(stem);
    const known = isLegacy ? undefined : sourceImages.get(imageLookupKey(stem));
    if (known) {
      matchedBySource++;
      const prevKnown = sources.get(known.id);
      const nextKnown: SourceFile = { id: known.id, file: c.file, origin: c.origin, rank: known.rank, ...(known.tool ? { tool: known.tool } : {}) };
      if (prevKnown) {
        multiple.push(known.id);
        if (!(c.origin !== prevKnown.origin ? c.origin === 'manual' : nextKnown.rank < prevKnown.rank)) continue;
      }
      sources.set(known.id, nextKnown);
      continue;
    }
    // 2. Sinon : identifiant ou titre dans le nom (ID__Outil, Outil_ID, archive-N-outil, N-slug-i…).
    const parsed = parseImageStem(stem);
    let tool = parsed.tool;
    let r = knownIds.size > 0 ? refs.resolve(parsed.ref) : { id: safeFileStem(parsed.ref) };
    if ('error' in r && parsed.altRef) {
      r = refs.resolve(parsed.altRef);
      // « Outil_ID » : l'outil est le texte avant le dernier tiret bas ; « archive-N-outil » : outil déjà lu.
      if (!('error' in r) && parsed.altTool) tool = parsed.altTool;
    }
    if ('error' in r) {
      unresolved.push({ file: rel(c.file, PATHS.root), error: r.error });
      continue;
    }
    // Image « ancienne version » : fichiers optimisés à part (<id>--legacy), jamais en concurrence avec l'image principale.
    const key = parsed.legacy ? `${r.id}--legacy` : r.id;
    const prev = sources.get(key);
    const next: SourceFile = { id: r.id, file: c.file, origin: c.origin, rank: parsed.rank, ...(tool ? { tool } : {}) };
    if (prev) {
      multiple.push(r.id);
      // Ajout manuel prioritaire ; à origine égale, le rang le plus faible (image n° 1 avant les « archive »).
      const better = c.origin !== prev.origin ? c.origin === 'manual' : next.rank < prev.rank;
      if (!better) continue;
    }
    sources.set(key, next);
  }
  if (multiple.length) warnings.push(`${new Set(multiple).size} fiche(s) ont plusieurs images : une seule est utilisée (image n° 1, puis les « archive »).`);

  fs.mkdirSync(PATHS.thumbs, { recursive: true });
  fs.mkdirSync(PATHS.large, { recursive: true });
  const manifest: ImageManifest = readManifest();
  const processed: string[] = [];
  const skipped: string[] = [];
  const invalid: { id: string; error: string }[] = [];
  const heavy: { id: string; kind: string; bytes: number }[] = [];

  for (const [stem, src] of sources) {
    try {
      const stat = fs.statSync(src.file);
      if (stat.size > MAX_SOURCE_BYTES) throw new Error(`fichier source trop volumineux (${stat.size} octets)`);
      const bytes = fs.readFileSync(src.file);
      const hash = sha1(`${PARAMS_VERSION}:${sha1(bytes.toString('binary'))}`);
      const p = imagePaths(stem);
      const thumbFile = path.join(PATHS.publicDir, p.thumbnail);
      const largeFile = path.join(PATHS.publicDir, p.large);
      if (manifest[stem]?.sourceHash === hash && fs.existsSync(thumbFile) && fs.existsSync(largeFile)) {
        // Image inchangée ; l'outil (nom du fichier) peut avoir changé.
        if (src.tool) manifest[stem] = { ...manifest[stem]!, generator: src.tool };
        else if (manifest[stem]) delete manifest[stem]!.generator;
        skipped.push(stem);
        continue;
      }
      const base = sharp(bytes, { failOn: 'error', limitInputPixels: 80_000_000 }).rotate();
      const meta = await sharp(bytes).rotate().metadata();
      const thumb = await base.clone().resize({ width: THUMB.width, withoutEnlargement: true }).webp({ quality: THUMB.quality }).toBuffer();
      const large = await base.clone().resize({ width: LARGE.width, withoutEnlargement: true }).webp({ quality: LARGE.quality }).toBuffer();
      fs.writeFileSync(thumbFile, thumb);
      fs.writeFileSync(largeFile, large);
      const lm = await sharp(large).metadata();
      manifest[stem] = {
        width: lm.width ?? meta.width ?? 0,
        height: lm.height ?? meta.height ?? 0,
        sourceHash: hash,
        thumbBytes: thumb.length,
        largeBytes: large.length,
        ...(src.tool ? { generator: src.tool } : {}),
      };
      processed.push(stem);
      if (thumb.length > HEAVY_THUMB) heavy.push({ id: stem, kind: 'thumbnail', bytes: thumb.length });
      if (large.length > HEAVY_LARGE) heavy.push({ id: stem, kind: 'large', bytes: large.length });
    } catch (e) {
      invalid.push({ id: stem, error: (e as Error).message });
    }
  }

  // Le manifeste ne décrit que des fichiers qui existent encore.
  for (const stem of Object.keys(manifest)) {
    const p = imagePaths(stem);
    if (!fs.existsSync(path.join(PATHS.publicDir, p.thumbnail)) || !fs.existsSync(path.join(PATHS.publicDir, p.large))) delete manifest[stem];
  }

  // Entrées connues sans image source ni image optimisée
  const absent = [...knownIds].filter((id) => !sources.has(id) && !manifest[id]);
  writeJson(IMAGE_MANIFEST, Object.fromEntries(Object.entries(manifest).sort(([a], [b]) => a.localeCompare(b))));
  const report = {
    generatedAt: new Date().toISOString(),
    mode: batches.mode,
    params: { thumbnail: THUMB, large: LARGE },
    sourcesFound: sources.size,
    processed,
    skippedUnchanged: skipped,
    invalid,
    absentForKnownEntries: absent.length,
    absentSample: absent.slice(0, 50),
    heavyOutputs: heavy,
    unresolvedSourceFiles: unresolved,
    warnings,
    matchedBySourceName: matchedBySource,
    notes: batches.notes,
  };
  writeJson(path.join(PATHS.reports, 'images-report.json'), report);
  console.log(
    `Images : ${processed.length} traitée(s), ${skipped.length} inchangée(s), ${invalid.length} invalide(s), ` +
      `${absent.length} fiche(s) connue(s) sans image, ${heavy.length} fichier(s) lourd(s).`,
  );
  if (invalid.length) console.log(invalid.map((i) => `  ✗ ${i.id} : ${i.error}`).join('\n'));
  for (const u of unresolved) console.log(`  ⚠ ${u.file} : ${u.error}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
