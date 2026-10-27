import { describe, expect, it } from 'vitest';
import { validateLibrary } from '../scripts/lib/validate.mts';
import { makeEntry, withImage } from './fixtures.ts';

const codes = (entries: Parameters<typeof validateLibrary>[0]) => validateLibrary(entries, { imageExists: () => true }).map((i) => `${i.severity}:${i.code}`);

describe('validation d’une fiche', () => {
  it('accepte une fiche publiable complète', () => {
    const e = makeEntry({ status: 'published', image: withImage() });
    expect(validateLibrary([e], { imageExists: () => true }).filter((i) => i.severity === 'error')).toEqual([]);
  });

  it('refuse published sans image, sans alt, sans catégorie', () => {
    expect(codes([makeEntry({ status: 'published' })])).toContain('error:image-missing');
    expect(codes([makeEntry({ status: 'published', image: withImage('test-1', '') })])).toContain('error:alt-missing');
    expect(codes([makeEntry({ status: 'published', image: withImage(), categories: [] })])).toContain('error:category-missing');
  });

  it('tolère les manques sur to-confirm (avertissement, pas erreur)', () => {
    const c = codes([makeEntry({ status: 'to-confirm', prompt: '', categories: [] })]);
    expect(c).toContain('warning:prompt-missing');
    expect(c.filter((x) => x.startsWith('error:'))).toEqual([]);
  });

  it('détecte id dupliqué, statut/orientation/langue invalides, URL source, chemins absolus', () => {
    const a = makeEntry();
    const c = codes([
      a,
      { ...a },
      makeEntry({ id: 'b', status: 'nope' as never, orientation: 'diagonal' as never, language: 'de' as never, source: { id: 's', label: 'S', url: 'javascript:alert(1)' } }),
      makeEntry({ id: 'c', image: { ...withImage('c'), thumbnail: '/home/user/x.webp' } }),
    ]);
    expect(c).toEqual(expect.arrayContaining(['error:id-duplicate', 'error:status-invalid', 'error:orientation-invalid', 'error:language-invalid', 'error:source-url-invalid', 'error:image-path-absolute']));
  });

  it('détecte une donnée de démonstration et un doublon exact non traité', () => {
    expect(codes([makeEntry({ source: { id: 'demo-set', label: 'x' } })])).toContain('error:demo-data');
    const dup = [makeEntry({ id: 'a' }), makeEntry({ id: 'b' })];
    expect(codes(dup)).toContain('error:duplicate-untreated');
    expect(codes([makeEntry({ id: 'a' }), makeEntry({ id: 'b', status: 'to-confirm' })])).not.toContain('error:duplicate-untreated');
  });

  it('signale un fichier image introuvable', () => {
    const e = makeEntry({ image: withImage() });
    expect(validateLibrary([e], { imageExists: () => false }).map((i) => i.code)).toContain('image-file-missing');
  });
});
