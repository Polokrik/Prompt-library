import { describe, expect, it } from 'vitest';
import { buildRefIndex, parseDescriptions, parseImageStem } from '../scripts/lib/refs.mts';
import { attachImage } from '../scripts/lib/attach.mts';
import { makeEntry } from './fixtures.ts';

describe('noms de fichiers d’images', () => {
  it('lit la référence et l’outil (ID__Outil)', () => {
    expect(parseImageStem('ENT-ABC__Midjourney v7')).toEqual({ ref: 'ENT-ABC', tool: 'Midjourney v7' });
    expect(parseImageStem('ENT-ABC__Midjourney_v7')).toEqual({ ref: 'ENT-ABC', tool: 'Midjourney v7' });
    expect(parseImageStem('ENT-ABC__GPT-4o')).toEqual({ ref: 'ENT-ABC', tool: 'GPT-4o' });
    expect(parseImageStem('ext-104')).toEqual({ ref: 'ext-104' });
    expect(parseImageStem('ENT-ABC__')).toEqual({ ref: 'ENT-ABC' });
  });

  it('résout un identifiant (casse ignorée) ou un titre unique, jamais un titre ambigu ou inconnu', () => {
    const idx = buildRefIndex([
      { id: 'ENT-1', title: '1970s panda train' },
      { id: 'ENT-2', title: 'Portrait doublon' },
      { id: 'ENT-3', title: 'portrait  DOUBLON!' },
    ]);
    expect(idx.resolve('ent-1')).toEqual({ id: 'ENT-1' });
    expect(idx.resolve('1970s Panda Train')).toEqual({ id: 'ENT-1' });
    expect(idx.resolve('Portrait doublon')).toHaveProperty('error', expect.stringContaining('ambigu'));
    expect(idx.resolve('nimporte quoi')).toHaveProperty('error');
  });
});

describe('descriptions.txt', () => {
  it('une ligne par image, commentaires et lignes invalides ignorés, | autorisé dans le texte', () => {
    const out = parseDescriptions('# commentaire\n\nENT-1 | Un panda | dans un train\nsans barre\n | sans réf\nENT-2 |   \r\nENT-3|Texte collé');
    expect(out).toEqual([
      { ref: 'ENT-1', text: 'Un panda | dans un train', line: 3 },
      { ref: 'ENT-3', text: 'Texte collé', line: 7 },
    ]);
  });
});

describe('rattachement de l’image', () => {
  const img = (alt: string) => ({ thumbnail: 'images/prompts/thumbs/a.webp', large: 'images/prompts/large/a.webp', alt, width: 1200, height: 800 });
  it('image sans description : non publiée, fiche inchangée (reste visible), signalée', () => {
    const e = makeEntry();
    const r = attachImage(e, img(''), 'Midjourney');
    expect(r.pending).toBe(true);
    expect(r.entry.image).toBeUndefined();
    expect(r.entry.generator).toBeUndefined();
  });
  it('image + description : rattachée, outil du nom de fichier, orientation mesurée', () => {
    const r = attachImage(makeEntry(), img('Un objet sur une table'), 'Midjourney v7');
    expect(r).toMatchObject({ pending: false, entry: { generator: 'Midjourney v7', orientation: 'landscape' } });
    expect(r.entry.image?.alt).toBe('Un objet sur une table');
  });
  it('le mapping (generator, orientation) garde la priorité', () => {
    const r = attachImage(makeEntry({ generator: 'Sora', orientation: 'portrait' }), img('x y'), 'Midjourney');
    expect(r.entry).toMatchObject({ generator: 'Sora', orientation: 'portrait' });
  });
  it('sans image : rien ne change', () => {
    const e = makeEntry();
    expect(attachImage(e, undefined)).toEqual({ entry: e, pending: false });
  });
});
