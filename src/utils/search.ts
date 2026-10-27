import type { PromptEntry } from '../types/library.ts';
import { fold, tokens } from './text.ts';

interface IndexedEntry {
  entry: PromptEntry;
  title: string;
  tags: string;
  categories: string;
  description: string;
  prompt: string;
}

export interface SearchIndex {
  items: IndexedEntry[];
}

/** Index en mémoire : champs pré-normalisés (sans accents, minuscules). */
export function buildIndex(entries: readonly PromptEntry[]): SearchIndex {
  return {
    items: entries.map((entry) => ({
      entry,
      title: fold(entry.title),
      tags: fold(entry.tags.join(' ')),
      categories: fold(entry.categories.join(' ')),
      description: fold(entry.description ?? ''),
      prompt: fold(entry.prompt),
    })),
  };
}

const WEIGHTS = { title: 5, tags: 3, categories: 3, description: 2, prompt: 1 } as const;

/**
 * Recherche locale : tous les termes doivent apparaître (ET), chacun dans au moins un champ
 * (titre, prompt, description, catégories, tags). Résultats classés par pertinence,
 * ordre d'origine conservé à égalité. Sans requête, tout est renvoyé dans l'ordre d'origine.
 */
export function search(index: SearchIndex, query: string): PromptEntry[] {
  const terms = tokens(query);
  if (terms.length === 0) return index.items.map((i) => i.entry);
  const scored: { entry: PromptEntry; score: number; order: number }[] = [];
  index.items.forEach((item, order) => {
    let score = 0;
    for (const term of terms) {
      let best = 0;
      for (const field of Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]) {
        if (item[field].includes(term)) best = Math.max(best, WEIGHTS[field]);
      }
      if (best === 0) return;
      score += best;
    }
    scored.push({ entry: item.entry, score, order });
  });
  scored.sort((a, b) => b.score - a.score || a.order - b.order);
  return scored.map((s) => s.entry);
}
