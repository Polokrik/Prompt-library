import { describe, expect, it } from 'vitest';
import { composePrompt, EMPTY_STATE, FORMATS, type ComposerState } from '../src/utils/composer.ts';
import type { ComposerData } from '../src/types/composer.ts';

const data: ComposerData = {
  source: 'test',
  blocks: [],
  styles: [{ id: 's1', label: 'Pixel', text: '8-bit pixel art, bitmap' }],
  lighting: [{ id: 'l1', label: 'Back lit', text: 'Back lit' }],
  effects: [{ id: 'e1', label: 'Ascends', text: 'Ascends' }],
  templates: [],
  exclusions: [{ id: 'x1', label: 'Texte', text: 'No text, no watermark' }],
  moods: [],
  eras: [],
};
const state = (over: Partial<ComposerState>): ComposerState => ({ ...EMPTY_STATE, ...over });

describe('composeur de prompt', () => {
  it('un état vide ne produit rien (rien n’est inventé)', () => {
    expect(composePrompt(EMPTY_STATE, data)).toBe('');
  });

  it('assemble dans l’ordre de la méthode : sujet, action, décor, ambiance, style, lumière, format, exclusions', () => {
    const out = composePrompt(
      state({ subject: 'Une théière sculpturale', action: 'posée sur un socle', setting: 'studio sobre', moods: ['Poétique', 'Doux'], styleId: 's1', lightingId: 'l1', formatId: 'portrait', exclusionIds: ['x1'], notes: 'Aucun logo' }),
      data,
    );
    expect(out).toBe(
      'Une théière sculpturale. posée sur un socle. studio sobre. Ambiance : Poétique, Doux. 8-bit pixel art, bitmap. Back lit. Format Portrait (4:5). No text, no watermark. Aucun logo.',
    );
  });

  it('le sujet remplace la variable d’un prompt de départ (modèle)', () => {
    expect(composePrompt(state({ base: 'capture d’écran de <sujet>', subject: 'un chat' }), data)).toBe('capture d’écran de un chat.');
    expect(composePrompt(state({ base: 'Collodion Process [Scene description], vintage camera', subject: 'une pêcheuse' }), data)).toBe(
      'Collodion Process une pêcheuse, vintage camera.',
    );
  });

  it('sans variable, le sujet est ajouté après le prompt de départ ; le prompt de départ est conservé tel quel', () => {
    const base = 'A cozy cabin.\nWarm light.';
    const out = composePrompt(state({ base, subject: 'un chien' }), data);
    expect(out.startsWith('A cozy cabin.\nWarm light')).toBe(true);
    expect(out).toContain('un chien');
  });

  it('ignore les identifiants inconnus et nettoie les espaces et points finaux', () => {
    expect(composePrompt(state({ styleId: 'inconnu', subject: '  Un   objet.  ' }), data)).toBe('Un objet.');
  });

  it('propose les 5 formats attendus', () => {
    expect(FORMATS.map((f) => `${f.label} ${f.ratio}`)).toEqual(['Carré 1:1', 'Portrait 4:5', 'Affiche 2:3', 'Paysage 16:9', 'Story 9:16']);
  });
});
