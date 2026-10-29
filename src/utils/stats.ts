import type { PromptEntry } from '../types/library.ts';

export function categoryCounts(entries: readonly PromptEntry[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) for (const c of e.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
}

/** Provenances présentes dans une liste de fiches, avec leur nombre de fiches. */
export function sourceCounts(entries: readonly PromptEntry[]): { id: string; label: string; count: number }[] {
  const counts = new Map<string, { id: string; label: string; count: number }>();
  for (const e of entries) {
    const cur = counts.get(e.source.id) ?? { id: e.source.id, label: e.source.label, count: 0 };
    cur.count++;
    counts.set(e.source.id, cur);
  }
  return [...counts.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'));
}
