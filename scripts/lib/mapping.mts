import type { EditorialMapping, PromptEntry, PromptStatus } from '../../src/types/library.ts';

const KNOWN_KEYS = new Set([
  'title',
  'description',
  'status',
  'categories',
  'tags',
  'orientation',
  'language',
  'requiresReference',
  'image',
  'hiddenReason',
  'canonicalId',
  'collectionIds',
]);

export interface MappingResult {
  entries: PromptEntry[];
  /** Fiches dont le statut est imposé par le mapping (prioritaire sur les règles automatiques). */
  forcedStatus: Map<string, PromptStatus>;
  /** Textes alternatifs imposés par le mapping, appliqués quand l'image est attachée. */
  altOverrides: Map<string, string>;
  warnings: string[];
}

/**
 * Applique le mapping éditorial aux fiches normalisées, AVANT le calcul du statut.
 * Toute valeur explicitement définie l'emporte, y compris un tableau vide.
 * Les clés commençant par « _ » sont des commentaires et sont ignorées.
 */
export function applyMapping(entries: PromptEntry[], mapping: EditorialMapping, label: string): MappingResult {
  const warnings: string[] = [];
  const forcedStatus = new Map<string, PromptStatus>();
  const altOverrides = new Map<string, string>();
  const ids = new Set(entries.map((e) => e.id));
  for (const id of Object.keys(mapping)) {
    if (!id.startsWith('_') && !ids.has(id)) warnings.push(`${label} : le mapping vise « ${id} », absent des données importées.`);
  }

  const out = entries.map((entry) => {
    const o = mapping[entry.id];
    if (!o) return entry;
    for (const k of Object.keys(o)) {
      if (!KNOWN_KEYS.has(k)) warnings.push(`${label} : clé inconnue « ${k} » pour ${entry.id}.`);
    }
    const next: PromptEntry = { ...entry };
    if (o.title !== undefined) next.title = o.title;
    if (o.description !== undefined) next.description = o.description;
    if (o.categories !== undefined) next.categories = [...o.categories];
    if (o.tags !== undefined) next.tags = [...o.tags];
    if (o.orientation !== undefined) next.orientation = o.orientation;
    if (o.language !== undefined) next.language = o.language;
    if (o.requiresReference !== undefined) next.requiresReference = o.requiresReference;
    if (o.hiddenReason !== undefined) next.hiddenReason = o.hiddenReason;
    if (o.canonicalId !== undefined) next.canonicalId = o.canonicalId;
    if (o.collectionIds !== undefined) next.collectionIds = [...o.collectionIds];
    if (o.image?.alt !== undefined) altOverrides.set(entry.id, o.image.alt);
    if (o.status !== undefined) forcedStatus.set(entry.id, o.status);
    return next;
  });
  return { entries: out, forcedStatus, altOverrides, warnings };
}
