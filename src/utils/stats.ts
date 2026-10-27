import type { PromptEntry } from '../types/library.ts';

export function categoryCounts(entries: readonly PromptEntry[]): { name: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of entries) for (const c of e.categories) counts.set(c, (counts.get(c) ?? 0) + 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'fr'));
}
