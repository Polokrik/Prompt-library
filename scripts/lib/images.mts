import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.mts';
import { readJson } from './io.mts';
import { safeFileStem } from './text.mts';
import type { PromptImage } from '../../src/types/library.ts';

export const IMAGE_MANIFEST = path.join(PATHS.publicDir, 'images', 'prompts', 'manifest.json');

export interface ManifestItem {
  width: number;
  height: number;
  /** Empreinte de l'original : sert à ne pas retraiter une image inchangée. */
  sourceHash: string;
  thumbBytes: number;
  largeBytes: number;
  /** Outil IA lu dans le nom du fichier (`ID__Outil.jpg`). */
  generator?: string;
}
export type ImageManifest = Record<string, ManifestItem>;

export function readManifest(): ImageManifest {
  return readJson<ImageManifest>(IMAGE_MANIFEST, {});
}

export function imagePaths(id: string) {
  const stem = safeFileStem(id);
  return {
    thumbnail: `images/prompts/thumbs/${stem}.webp`,
    large: `images/prompts/large/${stem}.webp`,
  };
}

/** Image publiée de la fiche, seulement si les deux fichiers optimisés existent réellement. */
export function resolveImage(id: string, alt: string | undefined, manifest = readManifest()): PromptImage | undefined {
  const p = imagePaths(id);
  const ok =
    fs.existsSync(path.join(PATHS.publicDir, p.thumbnail)) && fs.existsSync(path.join(PATHS.publicDir, p.large));
  if (!ok) return undefined;
  const m = manifest[safeFileStem(id)];
  return {
    thumbnail: p.thumbnail,
    large: p.large,
    // Sans texte alternatif fiable, la chaîne reste vide : deriveStatus place alors la fiche en « à confirmer ».
    alt: alt ?? '',
    ...(m ? { width: m.width, height: m.height } : {}),
  };
}

/** Empreinte du fichier miniature : sert à repérer une même image associée à plusieurs fiches. */
export function imageKeyOf(e: { image?: PromptImage }): string | undefined {
  if (!e.image) return undefined;
  const file = path.join(PATHS.publicDir, e.image.thumbnail);
  if (!fs.existsSync(file)) return undefined;
  return createHash('sha1').update(fs.readFileSync(file)).digest('hex');
}
