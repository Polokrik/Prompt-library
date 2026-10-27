import { describe, expect, it } from 'vitest';
import { applyMapping } from '../scripts/lib/mapping.mts';
import { finalizeEntry } from '../scripts/lib/status.mts';
import { makeEntry, withImage } from './fixtures.ts';

describe('mapping éditorial', () => {
  it('prime sur la donnée normalisée, y compris avec un tableau vide, et laisse le reste intact', () => {
    const base = makeEntry({ tags: ['a', 'b'], title: 'Brut' });
    const { entries } = applyMapping([base], { 'test-1': { title: 'Corrigé', tags: [], categories: ['Portrait', 'Matières'] } }, 'x');
    expect(entries[0]).toMatchObject({ title: 'Corrigé', tags: [], categories: ['Portrait', 'Matières'], prompt: base.prompt });
    expect(base.title).toBe('Brut'); // la donnée d’origine n’est pas modifiée
  });

  it('applique l’outil de génération (generator)', () => {
    const { entries } = applyMapping([makeEntry()], { 'test-1': { generator: 'Midjourney' } }, 'x');
    expect(entries[0]!.generator).toBe('Midjourney');
  });

  it('signale les identifiants et clés inconnus sans les appliquer', () => {
    const { warnings } = applyMapping([makeEntry()], { absent: { title: 'x' }, 'test-1': { foo: 1 } as never }, 'x');
    expect(warnings.join('\n')).toMatch(/absent/);
    expect(warnings.join('\n')).toMatch(/clé inconnue « foo »/);
  });

  it('ignore les clés de commentaire (_...)', () => {
    expect(applyMapping([makeEntry()], { _doc: { title: 'x' } }, 'x').warnings).toEqual([]);
  });

  it('un statut forcé est prioritaire mais borné par les invariants de la fiche', () => {
    const e = makeEntry({ prompt: '' });
    const r = finalizeEntry(e, { verified: true, forced: 'published' });
    expect(r.entry.status).toBe('to-confirm');
    expect(r.warnings.length).toBe(1);
    const ok = finalizeEntry(makeEntry({ image: withImage() }), { verified: false, forced: 'published' });
    expect(ok.entry.status).toBe('published');
  });

  it('le mapping peut lever un doute automatique (catégorie ajoutée -> to-test)', () => {
    const base = makeEntry({ categories: [] });
    expect(finalizeEntry(base, { verified: false }).entry.status).toBe('to-confirm');
    const { entries } = applyMapping([base], { 'test-1': { categories: ['Portrait'] } }, 'x');
    expect(finalizeEntry(entries[0]!, { verified: false }).entry.status).toBe('to-test');
  });
});
