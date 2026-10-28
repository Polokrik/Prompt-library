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

/**
 * Nom de fichier d'image : `<référence>.<ext>` ou `<référence>__<outil>.<ext>`.
 * L'outil : les tirets bas deviennent des espaces (« Midjourney_v7 » -> « Midjourney v7 ») ; les tirets sont conservés (« GPT-4o »).
 */
export function parseImageStem(stem: string): { ref: string; tool?: string } {
  const i = stem.indexOf('__');
  if (i < 0) return { ref: stem.trim() };
  const tool = stem
    .slice(i + 2)
    .replace(/_+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return { ref: stem.slice(0, i).trim(), ...(tool ? { tool } : {}) };
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
