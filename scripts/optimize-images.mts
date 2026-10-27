/**
 * npm run optimize:images
 * Sources (par ordre de priorité) :
 *   1. imports/images/<id>.<jpg|jpeg|png|webp|gif|avif>        (ajout manuel)
 *   2. imports/external/originals/<id>.<ext>                   (téléchargé par import:external*)
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
import { loadBatches } from './lib/sources.mts';
import { excelId } from './lib/ids.mts';
import { externalEntryId } from './lib/normalize-external.mts';
import { SOURCE_IDS } from './lib/paths.mts';

export const THUMB = { width: 480, quality: 72 };
export const LARGE = { width: 1200, quality: 82 };
const PARAMS_VERSION = `v1:${THUMB.width}:${THUMB.quality}:${LARGE.width}:${LARGE.quality}`;
const EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];
const MAX_SOURCE_BYTES = 40 * 1024 * 1024;
const HEAVY_THUMB = 120 * 1024;
const HEAVY_LARGE = 500 * 1024;

interface SourceFile {
  stem: string;
  file: string;
  origin: 'manual' | 'external';
}

function scan(dir: string, origin: SourceFile['origin']): SourceFile[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => EXTS.includes(path.extname(f).toLowerCase()))
    .map((f) => ({ stem: path.basename(f, path.extname(f)), file: path.join(dir, f), origin }));
}

async function main() {
  const { flags } = parseArgs(process.argv.slice(2));
  const batches = loadBatches(flags.has('full'));
  const knownIds = new Set<string>();
  for (const r of batches.excel?.catalogue ?? []) knownIds.add(safeFileStem(excelId(r.Entrée_ID, SOURCE_IDS.excel, '')));
  for (const e of batches.external?.entries ?? []) knownIds.add(safeFileStem(externalEntryId(e)));

  const sources = new Map<string, SourceFile>();
  const warnings: string[] = [];
  for (const s of [...scan(PATHS.externalOriginals, 'external'), ...scan(PATHS.manualImages, 'manual')]) {
    const prev = sources.get(s.stem);
    if (prev) warnings.push(`Collision pour « ${s.stem} » : ${rel(prev.file, PATHS.root)} et ${rel(s.file, PATHS.root)} (priorité à l'ajout manuel)`);
    if (!prev || s.origin === 'manual') sources.set(s.stem, s);
  }

  fs.mkdirSync(PATHS.thumbs, { recursive: true });
  fs.mkdirSync(PATHS.large, { recursive: true });
  const manifest: ImageManifest = readManifest();
  const processed: string[] = [];
  const skipped: string[] = [];
  const invalid: { id: string; error: string }[] = [];
  const heavy: { id: string; kind: string; bytes: number }[] = [];
  const orphans: string[] = [];

  for (const [stem, src] of sources) {
    if (knownIds.size > 0 && !knownIds.has(stem)) {
      orphans.push(rel(src.file, PATHS.root));
      continue;
    }
    try {
      const stat = fs.statSync(src.file);
      if (stat.size > MAX_SOURCE_BYTES) throw new Error(`fichier source trop volumineux (${stat.size} octets)`);
      const bytes = fs.readFileSync(src.file);
      const hash = sha1(`${PARAMS_VERSION}:${sha1(bytes.toString('binary'))}`);
      const p = imagePaths(stem);
      const thumbFile = path.join(PATHS.publicDir, p.thumbnail);
      const largeFile = path.join(PATHS.publicDir, p.large);
      if (manifest[stem]?.sourceHash === hash && fs.existsSync(thumbFile) && fs.existsSync(largeFile)) {
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
    orphanSourceFiles: orphans,
    warnings,
    notes: batches.notes,
  };
  writeJson(path.join(PATHS.reports, 'images-report.json'), report);
  console.log(
    `Images : ${processed.length} traitée(s), ${skipped.length} inchangée(s), ${invalid.length} invalide(s), ` +
      `${absent.length} fiche(s) connue(s) sans image, ${heavy.length} fichier(s) lourd(s).`,
  );
  if (invalid.length) console.log(invalid.map((i) => `  ✗ ${i.id} : ${i.error}`).join('\n'));
  if (orphans.length) console.log(`  ${orphans.length} image(s) source sans fiche correspondante (voir reports/images-report.json).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
