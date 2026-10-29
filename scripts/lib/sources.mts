import path from 'node:path';
import { PATHS } from './paths.mts';
import { exists, readJson } from './io.mts';
import type { RawExcelBatch } from './normalize-excel.mts';
import { externalEntryId, type RawExternalBatch } from './normalize-external.mts';
import { excelId } from './ids.mts';
import { SOURCE_IDS } from './paths.mts';
import { safeFileStem } from './text.mts';

export interface Batches {
  mode: 'sample' | 'full' | 'mixed';
  excel?: RawExcelBatch;
  external?: RawExternalBatch;
  notes: string[];
}

/**
 * Charge les lots bruts. Par source, le lot « full » est utilisé s'il existe (import complet déjà fait),
 * sinon le lot « sample ». `forceSample` ignore les lots complets. Un lot absent est signalé,
 * jamais remplacé par autre chose.
 */
export function loadBatches(forceSample = false): Batches {
  const notes: string[] = [];
  const pick = <T,>(dir: string, prefix: string, importCmd: string): { data?: T; mode?: 'sample' | 'full' } => {
    const full = path.join(dir, `${prefix}-full.json`);
    const sample = path.join(dir, `${prefix}-sample.json`);
    if (!forceSample && exists(full)) return { data: readJson<T>(full), mode: 'full' };
    if (exists(sample)) return { data: readJson<T>(sample), mode: 'sample' };
    notes.push(`Lot ${prefix} absent : lancer ${importCmd}`);
    return {};
  };
  const excel = pick<RawExcelBatch>(PATHS.excelRawDir, 'excel', 'npm run import:excel:sample (ou import:excel)');
  const external = pick<RawExternalBatch>(PATHS.externalRawDir, 'external', 'npm run import:external:sample (accès réseau requis)');
  const modes = new Set([excel.mode, external.mode].filter(Boolean));
  return {
    mode: modes.size === 1 ? [...modes][0]! : modes.size === 0 ? 'sample' : 'mixed',
    ...(excel.data ? { excel: excel.data } : {}),
    ...(external.data ? { external: external.data } : {}),
    notes,
  };
}

/** Identifiant et titre de chaque fiche des lots chargés (pour résoudre les références par titre). */
export function refEntries(batches: Batches): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  for (const r of batches.excel?.catalogue ?? []) {
    out.push({ id: safeFileStem(excelId(r.Entrée_ID, SOURCE_IDS.excel, '')), title: String(r['Titre'] ?? '') });
  }
  for (const e of batches.external?.entries ?? []) out.push({ id: safeFileStem(externalEntryId(e)), title: e.title ?? '' });
  return out;
}

export interface SourceImageRef {
  id: string;
  /** Position de l'image dans la liste `images` de la source (0 = première). */
  rank: number;
  tool?: string;
}

/** « GPT-4o · archive » -> « GPT-4o ». Un libellé sans « · » (ex. « Collection YouMind ») n'est pas un outil. */
export function toolFromLabel(label: unknown): string | undefined {
  if (typeof label !== 'string' || !label.includes('·')) return undefined;
  return label.split('·')[0]!.trim() || undefined;
}

/**
 * Noms d'images de la source (champ `images[].src` de chaque entrée brute) -> fiche. C'est la correspondance
 * exacte fournie par la source : le suffixe « -thumb » ajouté pour alléger les fichiers est ignoré à la recherche.
 */
export function sourceImageIndex(batches: Batches): Map<string, SourceImageRef> {
  const out = new Map<string, SourceImageRef>();
  for (const e of batches.external?.entries ?? []) {
    const images = (e.original as { images?: { src?: unknown; label?: unknown }[] }).images;
    if (!Array.isArray(images)) continue;
    const id = safeFileStem(externalEntryId(e));
    images.forEach((im, rank) => {
      if (typeof im?.src !== 'string') return;
      const stem = im.src.split('/').pop()!.replace(/\.[a-z0-9]+$/i, '').toLowerCase();
      const tool = toolFromLabel(im.label);
      if (!out.has(stem)) out.set(stem, { id, rank, ...(tool ? { tool } : {}) });
    });
  }
  return out;
}

/** Nom d'un fichier envoyé -> clé de recherche (minuscules, sans suffixe « -thumb »). */
export const imageLookupKey = (stem: string): string => stem.toLowerCase().replace(/-thumb$/, '');
