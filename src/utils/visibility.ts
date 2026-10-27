import type { PromptEntry, PromptStatus } from '../types/library.ts';

/** Statuts affichés dans la bibliothèque publique. `to-confirm` et `hidden` n'y apparaissent jamais. */
export const PUBLIC_STATUSES: readonly PromptStatus[] = ['published', 'to-test'];

export function isPublic(entry: Pick<PromptEntry, 'status'>): boolean {
  return PUBLIC_STATUSES.includes(entry.status);
}

export function publicEntries(entries: readonly PromptEntry[]): PromptEntry[] {
  return entries.filter(isPublic);
}

export const STATUS_LABELS: Record<PromptStatus, string> = {
  published: 'Publiée',
  'to-test': 'À tester',
  'to-confirm': 'À confirmer',
  hidden: 'Masquée',
};
