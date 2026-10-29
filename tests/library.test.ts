import { describe, expect, it } from 'vitest';
import { buildIndex, search } from '../src/utils/search.ts';
import { applyFilters, DEFAULT_FILTERS, filtersFromParams, filtersToParams } from '../src/utils/filters.ts';
import { isPublic, publicEntries } from '../src/utils/visibility.ts';
import { relatedEntries } from '../src/utils/related.ts';
import { sourceCounts } from '../src/utils/stats.ts';
import { parseFavorites } from '../src/utils/favorites.ts';
import { makeEntry } from './fixtures.ts';
import type { PromptEntry } from '../src/types/library.ts';

const lib: PromptEntry[] = [
  makeEntry({ id: 'a', title: 'Robot barista', prompt: 'A robot making coffee in a spaceship', categories: ['Science-fiction'], tags: ['café', 'robot'], status: 'published' }),
  makeEntry({ id: 'b', title: 'Portrait en verre', prompt: 'Iridescent glass portrait', categories: ['Portrait'], tags: ['verre'], orientation: 'portrait', language: 'en' }),
  makeEntry({ id: 'c', title: 'Fragment douteux', prompt: 'maybe a robot', status: 'to-confirm' }),
  makeEntry({ id: 'd', title: 'Caché', prompt: 'hidden robot', status: 'hidden' }),
  makeEntry({ id: 'e', title: 'Cafetière', prompt: 'Une cafetière sur une table', categories: ['Science-fiction'], tags: ['robot'], requiresReference: true, language: 'fr' }),
];

describe('visibilité publique', () => {
  it('exclut hidden et n’affiche pas to-confirm dans la bibliothèque principale', () => {
    const ids = publicEntries(lib).map((e) => e.id);
    expect(ids).toEqual(['a', 'b', 'e']);
    expect(isPublic(lib[2]!)).toBe(false);
    expect(isPublic(lib[3]!)).toBe(false);
  });
});

describe('recherche locale', () => {
  const index = buildIndex(publicEntries(lib));
  it('cherche dans titre, prompt, description, catégories et tags, sans accents ni casse', () => {
    expect(search(index, 'CAFE').map((e) => e.id).sort()).toEqual(['a', 'e']); // tag « café », titre « Cafetière »
    expect(search(index, 'iridescent').map((e) => e.id)).toEqual(['b']);
    expect(search(index, 'science fiction').map((e) => e.id).sort()).toEqual(['a', 'e']);
  });
  it('exige tous les termes et classe par pertinence (titre > prompt)', () => {
    expect(search(index, 'robot café').map((e) => e.id)).toEqual(['a', 'e']); // « café » est aussi une sous-chaîne de « Cafetière »
    expect(search(index, 'robot verre')).toEqual([]);
    expect(search(index, 'robot')[0]!.id).toBe('a');
  });
  it('sans requête, renvoie tout dans l’ordre d’origine', () => {
    expect(search(index, '  ').map((e) => e.id)).toEqual(['a', 'b', 'e']);
  });
});

describe('filtrage', () => {
  const pub = publicEntries(lib);
  it('filtre par catégorie, orientation, langue, statut, référence', () => {
    expect(applyFilters(pub, { ...DEFAULT_FILTERS, category: 'Portrait' }).map((e) => e.id)).toEqual(['b']);
    expect(applyFilters(pub, { ...DEFAULT_FILTERS, orientation: 'portrait' }).map((e) => e.id)).toEqual(['b']);
    expect(applyFilters(pub, { ...DEFAULT_FILTERS, language: 'fr' }).map((e) => e.id)).toEqual(['e']);
    expect(applyFilters(pub, { ...DEFAULT_FILTERS, status: 'published' }).map((e) => e.id)).toEqual(['a']);
    expect(applyFilters(pub, { ...DEFAULT_FILTERS, reference: 'yes' }).map((e) => e.id)).toEqual(['e']);
  });
  it('filtre par provenance (source) et compte les provenances', () => {
    const mixed = [
      makeEntry({ id: 'v1', source: { id: 'external-initial', label: 'La baie des images' } }),
      makeEntry({ id: 'v2', source: { id: 'external-initial', label: 'La baie des images' } }),
      makeEntry({ id: 'p1', source: { id: 'prompt-bible', label: 'Prompt Bible' } }),
    ];
    expect(applyFilters(mixed, { ...DEFAULT_FILTERS, source: 'external-initial' }).map((e) => e.id)).toEqual(['v1', 'v2']);
    expect(applyFilters(mixed, { ...DEFAULT_FILTERS, source: 'prompt-bible' }).map((e) => e.id)).toEqual(['p1']);
    expect(sourceCounts(mixed)).toEqual([
      { id: 'external-initial', label: 'La baie des images', count: 2 },
      { id: 'prompt-bible', label: 'Prompt Bible', count: 1 },
    ]);
    expect(filtersFromParams(filtersToParams({ ...DEFAULT_FILTERS, source: 'prompt-bible' })).source).toBe('prompt-bible');
  });
  it('favoris seulement et tri', () => {
    expect(applyFilters(pub, { ...DEFAULT_FILTERS, favoritesOnly: true }, new Set(['b'])).map((e) => e.id)).toEqual(['b']);
    expect(applyFilters(pub, { ...DEFAULT_FILTERS, sort: 'title-asc' }).map((e) => e.id)).toEqual(['e', 'b', 'a']);
  });
  it('aller-retour des filtres dans l’URL, valeurs invalides ignorées', () => {
    const f = { ...DEFAULT_FILTERS, q: 'robot', category: 'Portrait', orientation: 'portrait' as const };
    expect(filtersFromParams(filtersToParams(f))).toEqual(f);
    expect(filtersFromParams(new URLSearchParams('orientation=diagonal&sort=zzz')).orientation).toBe('');
  });
});

describe('fiches proches', () => {
  it('score = 2 × catégories communes + tags communs, sans la fiche elle-même', () => {
    const r = relatedEntries(lib[0]!, publicEntries(lib));
    expect(r.map((e) => e.id)).toEqual(['e']); // même catégorie (2) + tag robot (1)
  });
  it('ne renvoie rien sans point commun', () => {
    expect(relatedEntries(lib[1]!, publicEntries(lib))).toEqual([]);
  });
});

describe('favoris (stockage)', () => {
  it('tolère un contenu absent ou corrompu', () => {
    expect([...parseFavorites(null)]).toEqual([]);
    expect([...parseFavorites('{pas du json')]).toEqual([]);
    expect([...parseFavorites('["a", 3, "b"]')]).toEqual(['a', 'b']);
  });
});
