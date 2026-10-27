import type { PromptEntry } from '../types/library.ts';
import { PromptCard } from './PromptCard.tsx';

export function PromptGrid({ entries, label }: { entries: readonly PromptEntry[]; label: string }) {
  return (
    <ul className="grid" aria-label={label}>
      {entries.map((e) => (
        <li key={e.id}>
          <PromptCard entry={e} />
        </li>
      ))}
    </ul>
  );
}
