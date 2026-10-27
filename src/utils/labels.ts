import type { PromptKind, PromptLanguage, PromptOrientation } from '../types/library.ts';

export const ORIENTATION_LABELS: Record<PromptOrientation, string> = {
  landscape: 'Paysage',
  portrait: 'Portrait',
  square: 'Carré',
};
export const LANGUAGE_LABELS: Record<PromptLanguage, string> = { fr: 'Français', en: 'Anglais' };
export const KIND_LABELS: Record<PromptKind, string> = {
  prompt: 'Prompt',
  template: 'Modèle',
  style: 'Style',
  technique: 'Technique',
  note: 'Note',
};

/** Extrait court d'un prompt pour les vignettes sans image. */
export function excerpt(text: string, max = 150): string {
  const flat = text.replace(/\s+/g, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 1).trimEnd()}…` : flat;
}

/** Teinte stable (1–6) dérivée d'une chaîne, pour les vignettes typographiques. */
export function tintOf(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % 6) + 1;
}
