import { useSyncExternalStore } from 'react';

/** Annonces pour les technologies d'assistance (région aria-live unique, montée dans App). */
let message = '';
const listeners = new Set<() => void>();
let counter = 0;

export function announce(text: string): void {
  // Un compteur invisible force la ré-annonce d'un message identique.
  counter++;
  message = counter % 2 === 0 ? `${text}​` : text;
  listeners.forEach((l) => l());
}

export function useAnnouncement(): string {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => message,
    () => '',
  );
}
