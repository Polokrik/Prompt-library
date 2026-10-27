import { describe, expect, it } from 'vitest';
import { bestCandidate, extractJsonBlobs, guessFieldMap, toRawEntry } from '../scripts/lib/extract.mts';
import { normalizeExternal } from '../scripts/lib/normalize-external.mts';
import { safeUrl, stripHtml } from '../scripts/lib/text.mts';

const items = Array.from({ length: 6 }, (_, i) => ({ id: `i${i}`, titre: `T${i}`, prompt: `prompt ${i} <b>bold</b>`, image: `/img/${i}.jpg`, tags: ['x', 'y'] }));

describe('extraction de la source externe (fixtures synthétiques)', () => {
  it('trouve un tableau de données dans un littéral JSON de script, sans rien évaluer', () => {
    const js = `window.__x = ${JSON.stringify({ catalog: items, padding: 'p'.repeat(200) })}; alert('jamais exécuté');`;
    const best = bestCandidate(extractJsonBlobs(js));
    expect(best?.items).toHaveLength(6);
    expect(best?.path).toBe('$.catalog');
  });

  it('devine les champs et produit une entrée brute fidèle (valeurs non transformées)', () => {
    const map = guessFieldMap(Object.keys(items[0]!));
    expect(map).toMatchObject({ originalId: 'id', title: 'titre', prompt: 'prompt', imageUrl: 'image', tags: 'tags' });
    const raw = toRawEntry(items[0]!, 1, map);
    expect(raw.prompt).toBe('prompt 0 <b>bold</b>'); // aucune normalisation dans le brut
    expect(raw.original).toBe(items[0]);
    expect(raw.alt).toBeUndefined();
  });

  it('la normalisation neutralise le HTML et n’invente ni alt ni catégorie', () => {
    const [{ entry }] = normalizeExternal({
      source: 'external-initial', sourceUrl: 'https://example.org/lib/#x', importedAt: '2000-01-01T00:00:00.000Z', mode: 'sample',
      entries: [toRawEntry(items[0]!, 1, guessFieldMap(Object.keys(items[0]!)))],
    }) as [{ entry: ReturnType<typeof normalizeExternal>[0]['entry'] }];
    expect(entry.prompt).toBe('prompt 0 bold');
    expect(entry.categories).toEqual([]);
    expect(entry.id).toBe('ext-i0');
  });

  it('refuse les schémas d’URL dangereux', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeUrl('data:text/html,x')).toBeUndefined();
    expect(safeUrl('file:///etc/passwd')).toBeUndefined();
    expect(safeUrl('/a.jpg', 'https://example.org/b/')).toBe('https://example.org/a.jpg');
    expect(stripHtml('<script>x()</script>a<br>b')).toBe('a\nb');
  });
});
