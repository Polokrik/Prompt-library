import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage.ts';

/** Niveau d'aide choisi par la personne (confort d'affichage, stocké dans ce navigateur uniquement). */
export type HelpLevel = 'beginner' | 'intermediate' | 'expert';

export const HELP_LEVELS: readonly { id: HelpLevel; label: string; text: string }[] = [
  { id: 'beginner', label: 'Je découvre', text: 'On vous guide pas à pas.' },
  { id: 'intermediate', label: 'Je me débrouille', text: 'Champs à remplir, prompt prêt à copier.' },
  { id: 'expert', label: 'Je maîtrise', text: 'Le prompt brut, sans détour.' },
];

const KEY = 'carnet.helpLevel';
const listeners = new Set<() => void>();

function parse(v: string | null): HelpLevel | null {
  return v === 'beginner' || v === 'intermediate' || v === 'expert' ? v : null;
}

/** null = jamais choisi (la fenêtre de choix s'ouvre alors une fois). */
export function getHelpLevel(): HelpLevel | null {
  return parse(readStorage(KEY));
}

export function setHelpLevel(level: HelpLevel): void {
  writeStorage(KEY, level);
  listeners.forEach((l) => l());
}

export function useHelpLevel(): HelpLevel | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    getHelpLevel,
    () => null,
  );
}
