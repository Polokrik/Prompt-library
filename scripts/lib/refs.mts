import { comparable } from './text.mts';

/**
 * Références vers une fiche utilisées par les noms de fichiers d'images et par descriptions.txt :
 * un identifiant (insensible à la casse) ou, à défaut, un titre exact UNIQUE (casse, accents et
 * ponctuation ignorés). Une référence ambiguë ou inconnue n'est jamais devinée.
 */
export interface RefEntry {
  id: string;
  title: string;
}

export type RefResult = { id: string } | { error: string };

export function buildRefIndex(entries: readonly RefEntry[]) {
  const byId = new Map(entries.map((e) => [e.id.toLowerCase(), e.id]));
  const byTitle = new Map<string, string[]>();
  for (const e of entries) {
    const key = comparable(e.title);
    if (key) byTitle.set(key, [...(byTitle.get(key) ?? []), e.id]);
  }
  return {
    resolve(ref: string): RefResult {
      const raw = ref.trim();
      if (!raw) return { error: 'référence vide' };
      const id = byId.get(raw.toLowerCase());
      if (id) return { id };
      const hits = byTitle.get(comparable(raw));
      if (hits?.length === 1) return { id: hits[0]! };
      if (hits && hits.length > 1) return { error: `titre ambigu « ${raw} » (${hits.slice(0, 4).join(', ')}…) : utiliser l'identifiant` };
      return { error: `aucune fiche pour « ${raw} »` };
    },
  };
}

export interface ImageStem {
  ref: string;
  /** Autre référence à essayer si `ref` ne correspond à aucune fiche (nommage numérique de la source externe). */
  altRef?: string;
  /** Outil lu avec `altRef` (nommage « Outil_ID »). */
  altTool?: string;
  tool?: string;
  /** Ordre de préférence quand plusieurs images visent la même fiche (plus petit = prioritaire). */
  rank: number;
}

/**
 * Nom de fichier d'image :
 * - `<référence>.<ext>` ou `<référence>__<outil>.<ext>` (référence = identifiant ou titre exact unique) ;
 *   l'outil : les tirets bas deviennent des espaces (« Midjourney_v7 » -> « Midjourney v7 »), les tirets sont conservés (« GPT-4o »).
 * - ordre inverse `<outil>_<référence>.<ext>` (ex. `OpenAI_ext-104.png`, `Midjourney v7_ENT-VNHZB48D.jpg`) : le texte après
 *   le DERNIER tiret bas est essayé comme référence ;
 * - nommage des images du site source : `archive-40-gemini` (fiche ext-40, outil « gemini »)
 *   et `309-ceramique-la-glacure-bleue-1` (fiche ext-309, image n° 1).
 */
export function parseImageStem(stem: string): ImageStem {
  const i = stem.indexOf('__');
  if (i >= 0) {
    const tool = stem.slice(i + 2).replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    return { ref: stem.slice(0, i).trim(), ...(tool ? { tool } : {}), rank: 0 };
  }
  const archive = /^archive-(\d+)-(.+)$/i.exec(stem);
  if (archive) return { ref: stem.trim(), altRef: `ext-${archive[1]}`, tool: archive[2]!.replace(/_+/g, ' ').trim(), rank: 1000 };
  const numbered = /^(\d+)-(.+?)(?:-(\d+))?$/.exec(stem);
  if (numbered) return { ref: stem.trim(), altRef: `ext-${numbered[1]}`, rank: Number(numbered[3] ?? 1) };
  const us = stem.lastIndexOf('_');
  if (us > 0 && us < stem.length - 1) {
    const altTool = stem.slice(0, us).replace(/_+/g, ' ').trim();
    return { ref: stem.trim(), altRef: stem.slice(us + 1).trim(), ...(altTool ? { altTool } : {}), rank: 0 };
  }
  return { ref: stem.trim(), rank: 0 };
}

/** descriptions.txt : une ligne `référence | description` ; lignes vides et `#` ignorées. */
export function parseDescriptions(text: string): { ref: string; text: string; line: number }[] {
  const out: { ref: string; text: string; line: number }[] = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const bar = line.indexOf('|');
    if (bar < 0) return;
    const ref = line.slice(0, bar).trim();
    const desc = line.slice(bar + 1).trim();
    if (ref && desc) out.push({ ref, text: desc, line: i + 1 });
  });
  return out;
}
