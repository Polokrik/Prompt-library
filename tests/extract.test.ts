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

describe('format réel de la source (structure observée, valeurs synthétiques)', () => {
  const item = (i: number, withImg: boolean) => ({
    id: String(i), title: `Titre ${i}`, category: 'Concepts créatifs', prompt: `prompt numéro ${i}`, author: i === 1 ? 'Créateur cité dans la source' : '@auteur',
    source: `https://x.com/auteur/status/${i}`, origin: 'collection', description: 'Un point de départ à adapter', license: { label: 'CC BY 4.0 · collection X', url: 'https://creativecommons.org/licenses/by/4.0/' },
    images: withImg ? [{ src: `media/a-${i}.webp`, label: 'GPT-4o · archive', source: 'https://cdn.example/x.png', width: 667, height: 1000 }, { src: `media/b-${i}.webp`, label: 'Gemini · archive' }] : [],
  });
  const items = [item(1, false), item(2, true), item(3, true), item(4, true), item(5, false), item(6, true)];

  it('devine images.0.src, auteur, licence, post d’origine et catégorie', async () => {
    const { refineFieldMap, guessFieldMap } = await import('../scripts/lib/extract.mts');
    const map = refineFieldMap(guessFieldMap(Object.keys(items[1]!)), items);
    expect(map).toMatchObject({ imageUrl: 'images.0.src', imageLabel: 'images.0.label', author: 'author', license: 'license', postUrl: 'source', categories: 'category', originalId: 'id' });
  });

  it('brut fidèle puis normalisation : crédit, licence, outil, image relative, pas d’alt inventé', async () => {
    const { refineFieldMap, guessFieldMap } = await import('../scripts/lib/extract.mts');
    const map = refineFieldMap(guessFieldMap(Object.keys(items[1]!)), items);
    const raws = items.map((it, i) => toRawEntry(it, i + 1, map));
    expect(raws[1]).toMatchObject({ imageUrl: 'media/a-2.webp', imageLabel: 'GPT-4o · archive', postUrl: 'https://x.com/auteur/status/2' });
    expect(raws[1]!.license).toEqual({ label: 'CC BY 4.0 · collection X', url: 'https://creativecommons.org/licenses/by/4.0/' });
    expect(raws[0]!.imageUrl).toBeUndefined();
    const out = normalizeExternal({ source: 'external-initial', sourceUrl: 'https://example.org/imageia/#bibliotheque', importedAt: '2000-01-01T00:00:00.000Z', mode: 'sample', entries: raws });
    const [first, second] = out.map((o) => o.entry);
    expect(first!.source.author).toBeUndefined(); // « Créateur cité dans la source » = remplissage
    expect(second!.source).toMatchObject({ author: '@auteur', originalUrl: 'https://x.com/auteur/status/2', license: { label: expect.stringContaining('CC BY 4.0') } });
    expect(second!.generator).toBeUndefined(); // l'outil de l'image n'est pas repris sans l'image
    expect(second!.categories).toEqual(['Concepts créatifs']);
    expect(out[1]!.alt).toBeUndefined();
  });
});
