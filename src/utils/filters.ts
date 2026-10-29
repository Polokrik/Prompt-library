import type { PromptEntry, PromptLanguage, PromptOrientation } from '../types/library.ts';

export type SortKey = 'relevance' | 'title-asc' | 'title-desc';
export type StatusFilter = 'all' | 'published' | 'to-test';

export interface Filters {
  q: string;
  category: string;
  /** Identifiant de la source (provenance) : « external-initial », « prompt-bible »… ; vide = toutes. */
  source: string;
  orientation: '' | PromptOrientation;
  language: '' | PromptLanguage;
  status: StatusFilter;
  reference: '' | 'yes';
  favoritesOnly: boolean;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  q: '',
  category: '',
  source: '',
  orientation: '',
  language: '',
  status: 'all',
  reference: '',
  favoritesOnly: false,
  sort: 'relevance',
};

export function applyFilters(
  entries: readonly PromptEntry[],
  f: Filters,
  favorites: ReadonlySet<string> = new Set(),
): PromptEntry[] {
  const out = entries.filter((e) => {
    if (f.category && !e.categories.includes(f.category)) return false;
    if (f.source && e.source.id !== f.source) return false;
    if (f.orientation && e.orientation !== f.orientation) return false;
    if (f.language && e.language !== f.language) return false;
    if (f.status !== 'all' && e.status !== f.status) return false;
    if (f.reference === 'yes' && e.requiresReference !== true) return false;
    if (f.favoritesOnly && !favorites.has(e.id)) return false;
    return true;
  });
  if (f.sort === 'title-asc') out.sort((a, b) => a.title.localeCompare(b.title, 'fr'));
  if (f.sort === 'title-desc') out.sort((a, b) => b.title.localeCompare(a.title, 'fr'));
  return out;
}

export function countActiveFilters(f: Filters): number {
  return (
    Number(!!f.category) +
    Number(!!f.source) +
    Number(!!f.orientation) +
    Number(!!f.language) +
    Number(f.status !== 'all') +
    Number(!!f.reference) +
    Number(f.favoritesOnly)
  );
}

/** Sérialisation dans la partie « query » du hash (#/bibliotheque?q=…). Seules les valeurs non par défaut sont écrites. */
export function filtersToParams(f: Filters): URLSearchParams {
  const p = new URLSearchParams();
  (Object.keys(DEFAULT_FILTERS) as (keyof Filters)[]).forEach((k) => {
    if (f[k] !== DEFAULT_FILTERS[k]) p.set(k, String(f[k]));
  });
  return p;
}

const ORIENTATIONS = ['landscape', 'portrait', 'square'];
const LANGUAGES = ['fr', 'en'];
const SORTS = ['relevance', 'title-asc', 'title-desc'];
const STATUSES = ['all', 'published', 'to-test'];

export function filtersFromParams(p: URLSearchParams): Filters {
  const pick = <T extends string>(v: string | null, allowed: string[], fallback: T): T =>
    v !== null && allowed.includes(v) ? (v as T) : fallback;
  return {
    q: p.get('q') ?? '',
    category: p.get('category') ?? '',
    source: p.get('source') ?? '',
    orientation: pick(p.get('orientation'), ORIENTATIONS, ''),
    language: pick(p.get('language'), LANGUAGES, ''),
    status: pick(p.get('status'), STATUSES, 'all'),
    reference: pick(p.get('reference'), ['yes'], ''),
    favoritesOnly: p.get('favoritesOnly') === 'true',
    sort: pick(p.get('sort'), SORTS, 'relevance'),
  };
}
