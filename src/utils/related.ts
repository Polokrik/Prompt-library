import type { PromptEntry } from '../types/library.ts';
import { fold } from './text.ts';

/**
 * Fiches proches : score simple = 2 × catégories communes + 1 × tags communs.
 * Pas de moteur de recommandation : égalités départagées par l'ordre d'origine.
 */
export function relatedEntries(
  entry: PromptEntry,
  pool: readonly PromptEntry[],
  limit = 4,
): PromptEntry[] {
  const cats = new Set(entry.categories.map(fold));
  const tags = new Set(entry.tags.map(fold));
  return pool
    .map((e, order) => {
      if (e.id === entry.id) return null;
      let score = 0;
      for (const c of e.categories) if (cats.has(fold(c))) score += 2;
      for (const t of e.tags) if (tags.has(fold(t))) score += 1;
      return score > 0 ? { e, score, order } : null;
    })
    .filter((x): x is { e: PromptEntry; score: number; order: number } => x !== null)
    .sort((a, b) => b.score - a.score || a.order - b.order)
    .slice(0, limit)
    .map((x) => x.e);
}
