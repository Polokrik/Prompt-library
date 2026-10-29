import type { ComposerData } from '../types/composer.ts';

export interface ComposerFormat {
  id: string;
  label: string;
  ratio: string;
}

/** Formats proposés (liste fournie par l'auteur du projet). */
export const FORMATS: readonly ComposerFormat[] = [
  { id: 'square', label: 'Carré', ratio: '1:1' },
  { id: 'portrait', label: 'Portrait', ratio: '4:5' },
  { id: 'poster', label: 'Affiche', ratio: '2:3' },
  { id: 'landscape', label: 'Paysage', ratio: '16:9' },
  { id: 'story', label: 'Story', ratio: '9:16' },
];

export interface ComposerState {
  /** Prompt de départ : une fiche (« modifier ce prompt ») ou un modèle de l'Excel. */
  base: string;
  subject: string;
  action: string;
  setting: string;
  moods: string[];
  era: string;
  styleId: string;
  effectId: string;
  lightingId: string;
  camera: string;
  texture: string;
  palette: string;
  quality: string;
  formatId: string;
  exclusionIds: string[];
  extraExclusions: string;
  notes: string;
}

export const EMPTY_STATE: ComposerState = {
  base: '',
  subject: '',
  action: '',
  setting: '',
  moods: [],
  era: '',
  styleId: '',
  effectId: '',
  lightingId: '',
  camera: '',
  texture: '',
  palette: '',
  quality: '',
  formatId: '',
  exclusionIds: [],
  extraExclusions: '',
  notes: '',
};

const PLACEHOLDER = /<[^<>\n]{1,60}>|\[[^\]\n]{1,60}\]/;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim().replace(/[.\s]+$/, '');

/**
 * Assemble le prompt dans l'ordre de la méthode en 10 blocs :
 * (prompt de départ +) sujet, action, décor, récit/ambiance, style, lumière, caméra, textures, qualité,
 * puis format et exclusions. Aucune donnée n'est ajoutée : un champ vide ne produit rien.
 * Si le prompt de départ contient une variable (« <sujet> », « [Scene description] »), le sujet la remplace.
 */
export function composePrompt(state: ComposerState, data: ComposerData): string {
  const pick = (list: { id: string; text: string }[], id: string) => list.find((o) => o.id === id)?.text;
  const parts: string[] = [];

  let base = state.base.trim();
  let subjectUsed = false;
  if (base && state.subject.trim() && PLACEHOLDER.test(base)) {
    base = base.replace(PLACEHOLDER, state.subject.trim());
    subjectUsed = true;
  }
  if (base) parts.push(base);
  if (!subjectUsed && state.subject.trim()) parts.push(state.subject);
  parts.push(state.action, state.setting);
  if (state.moods.length) parts.push(`Ambiance : ${state.moods.join(', ')}`);
  if (state.era) parts.push(`Époque : ${state.era}`);
  parts.push(pick(data.styles, state.styleId) ?? '');
  parts.push(pick(data.effects, state.effectId) ?? '');
  parts.push(pick(data.lighting, state.lightingId) ?? '');
  parts.push(state.camera, state.texture);
  if (state.palette.trim()) parts.push(`Palette : ${state.palette}`);
  parts.push(state.quality);
  const format = FORMATS.find((f) => f.id === state.formatId);
  if (format) parts.push(`Format ${format.label} (${format.ratio})`);
  for (const id of state.exclusionIds) parts.push(pick(data.exclusions, id) ?? '');
  parts.push(state.extraExclusions, state.notes);

  const kept = parts.map((p, i) => (i === 0 && base ? p.trim() : clean(p))).filter(Boolean);
  return kept.length ? `${kept.map((p) => p.replace(/[.\s]+$/, '')).join('. ')}.` : '';
}
