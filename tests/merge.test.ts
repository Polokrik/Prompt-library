import { describe, expect, it } from 'vitest';
import { mergeEntries, interleave } from '../scripts/merge.mts';
import { makeEntry } from './fixtures.ts';

const src = (id: string, n: number) =>
  Array.from({ length: n }, (_, i) => makeEntry({ id: `${id}-${i}`, prompt: `unique prompt ${id} number ${i} with enough words`, source: { id, label: id } }));

describe('fusion de deux sources', () => {
  it('produit une liste unique entrelacée, avec la provenance conservée', () => {
    const { entries } = mergeEntries([src('a', 4), src('b', 2)]);
    expect(entries).toHaveLength(6);
    expect(new Set(entries.map((e) => e.source.id))).toEqual(new Set(['a', 'b']));
    expect(entries.slice(0, 4).map((e) => e.source.id)).toContain('b'); // pas de blocs séparés
  });

  it('interleave conserve l’ordre interne de chaque liste', () => {
    expect(interleave<number | string>([[1, 2, 3], ['a']])).toEqual([1, 'a', 2, 3]);
  });

  it('refuse une collision d’identifiants entre sources', () => {
    expect(() => mergeEntries([[makeEntry({ id: 'x' })], [makeEntry({ id: 'x', prompt: 'other text here' })]])).toThrow(/collision/);
  });

  it('un doublon exact n’est jamais supprimé : la fiche non canonique passe en to-confirm', () => {
    const a = makeEntry({ id: 'a', source: { id: 's1', label: 's1' } });
    const b = makeEntry({ id: 'b', source: { id: 's2', label: 's2' } });
    const { entries, notes } = mergeEntries([[a], [b]]);
    expect(entries).toHaveLength(2);
    expect(entries.find((e) => e.id === 'a')!.status).toBe('to-test'); // canonique : id le plus petit
    expect(entries.find((e) => e.id === 'b')!.status).toBe('to-confirm');
    expect(notes.join(' ')).toMatch(/doublon exact de a/);
  });

  it('canonicalId (mapping) masque la fiche en doublon et conserve la donnée', () => {
    const a = makeEntry({ id: 'a' });
    const b = makeEntry({ id: 'b', canonicalId: 'a', prompt: 'a different prompt entirely' });
    const { entries } = mergeEntries([[a, b]]);
    const hidden = entries.find((e) => e.id === 'b')!;
    expect(hidden.status).toBe('hidden');
    expect(hidden.hiddenReason).toMatch(/Doublon de a/);
  });
});
