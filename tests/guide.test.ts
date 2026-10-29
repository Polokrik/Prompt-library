import { describe, expect, it } from 'vitest';
import { findFields, fillPrompt, isShort, mentionsReference, splitPrompt, unfilledCount } from '../src/utils/guide.ts';

describe('splitPrompt', () => {
  it('sépare le bloc « DIRECTION DÉTAILLÉE » du prompt de base', () => {
    const r = splitPrompt('Un chat.\n\nDIRECTION DÉTAILLÉE — Chat\nSoigner les poils.');
    expect(r.base).toBe('Un chat.');
    expect(r.detail).toBe('DIRECTION DÉTAILLÉE — Chat\nSoigner les poils.');
  });
  it('laisse intact un prompt sans précisions', () => {
    expect(splitPrompt('Un chat roux ').detail).toBeUndefined();
    expect(splitPrompt('Un chat roux ').base).toBe('Un chat roux');
  });
});

describe('findFields / fillPrompt', () => {
  const text = 'Poster for [SUBJECT] in [SUBJECT] style, [LIGHTING / MOOD], {argument name="main title" default="Hello"} and ["a","b"] [AI inserts name] [1]';
  it('repère les champs sans doublon et ignore les consignes à l’IA, listes JSON et numéros', () => {
    const f = findFields(text);
    expect(f.map((x) => x.label)).toEqual(['SUBJECT', 'LIGHTING / MOOD', 'main title']);
    expect(f[2]!.defaultValue).toBe('Hello');
  });
  it('gère les variables Raycast échappées dans un JSON', () => {
    const f = findFields('"bg": "{argument name=\\"background color\\" default=\\"soft purple\\"}"');
    expect(f).toHaveLength(1);
    expect(f[0]!.label).toBe('background color');
    expect(f[0]!.defaultValue).toBe('soft purple');
  });
  it('remplace toutes les occurrences, applique la valeur par défaut et laisse les crochets vides', () => {
    const f = findFields(text);
    const out = fillPrompt(text, f, { '[SUBJECT]': 'a fox' });
    expect(out).toContain('Poster for a fox in a fox style');
    expect(out).toContain('[LIGHTING / MOOD]');
    expect(out).toContain(', Hello and ["a","b"]');
    expect(unfilledCount(f, { '[SUBJECT]': 'a fox' })).toBe(1);
  });
});

describe('détections', () => {
  it('détecte une image à fournir', () => {
    expect(mentionsReference('Turn this photo into a bobblehead')).toBe(true);
    expect(mentionsReference('Transforme ma photo en dessin')).toBe(true);
    expect(mentionsReference('A red fox in the snow')).toBe(false);
  });
  it('repère un prompt court', () => {
    expect(isShort('a red fox')).toBe(true);
    expect(isShort('x'.repeat(300))).toBe(false);
  });
});
