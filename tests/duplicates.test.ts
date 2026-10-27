import { describe, expect, it } from 'vitest';
import { detectDuplicates, pickCanonical } from '../scripts/lib/duplicates.mts';
import { makeEntry, withImage } from './fixtures.ts';

describe('détection de doublons', () => {
  it('trouve un doublon exact (casse/ponctuation/espaces ignorés) et propose un canonique', () => {
    const a = makeEntry({ id: 'a', prompt: 'Neon fox, in the rain!' });
    const b = makeEntry({ id: 'b', prompt: '  neon FOX in the   rain ', status: 'published', image: withImage('b') });
    const [c] = detectDuplicates([a, b]);
    expect(c).toMatchObject({ type: 'exact', canonicalId: 'b' });
    expect(c!.ids.sort()).toEqual(['a', 'b']);
    expect(c!.excerpts).toHaveLength(2);
  });

  it('la règle du canonique : statut > image > catégories/tags > id', () => {
    const lowId = makeEntry({ id: 'a', status: 'to-test' });
    const published = makeEntry({ id: 'z', status: 'published' });
    expect(pickCanonical([lowId, published]).id).toBe('z');
    expect(pickCanonical([makeEntry({ id: 'b' }), makeEntry({ id: 'a' })]).id).toBe('a');
  });

  it('ignore les fiches masquées', () => {
    expect(detectDuplicates([makeEntry({ id: 'a' }), makeEntry({ id: 'b', status: 'hidden' })])).toEqual([]);
  });

  it('même prompt + images différentes : pas un doublon exact', () => {
    const a = makeEntry({ id: 'a', image: withImage('a') });
    const b = makeEntry({ id: 'b', image: withImage('b') });
    const r = detectDuplicates([a, b], (e) => e.id);
    expect(r.map((c) => c.type)).toEqual(['same-prompt-different-image']);
  });

  it('même image + prompts différents', () => {
    const a = makeEntry({ id: 'a', prompt: 'one two three four five six', image: withImage('a') });
    const b = makeEntry({ id: 'b', prompt: 'completely different words about another thing', image: withImage('b') });
    expect(detectDuplicates([a, b], () => 'same-hash').map((c) => c.type)).toContain('same-image-different-prompt');
  });

  it('textes proches : signalés, jamais fusionnés', () => {
    const a = makeEntry({ id: 'a', prompt: 'a red fox jumping over a frozen river at dawn with very soft golden light and mist' });
    const b = makeEntry({ id: 'b', prompt: 'a red fox jumping over a frozen river at dawn with very soft golden lights and mist' });
    const r = detectDuplicates([a, b]);
    expect(r[0]).toMatchObject({ type: 'near' });
    expect(r[0]!.canonicalId).toBeUndefined();
  });

  it('variante probable : le prompt d’une fiche est une variante de l’autre', () => {
    const a = makeEntry({ id: 'a', prompt: 'first formulation of the idea' });
    const b = makeEntry({ id: 'b', prompt: 'second wording', variants: [{ id: 'v', label: 'v', role: 'variant', prompt: 'first formulation of the idea' }] });
    expect(detectDuplicates([a, b]).map((c) => c.type)).toEqual(['probable-variant']);
  });
});
