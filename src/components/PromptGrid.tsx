import { useSyncExternalStore } from 'react';
import type { PromptEntry } from '../types/library.ts';
import { PromptCard } from './PromptCard.tsx';

/** Mêmes seuils que l'ancienne mise en page : 2 colonnes, 3 dès 40em, 4 dès 64em, 5 dès 96em, 1 sous 22em. */
const QUERIES = ['(max-width: 22em)', '(min-width: 40em)', '(min-width: 64em)', '(min-width: 96em)'] as const;

function columnCount(): number {
  if (typeof window === 'undefined' || !window.matchMedia) return 2;
  if (window.matchMedia(QUERIES[0]).matches) return 1;
  return 2 + QUERIES.slice(1).filter((q) => window.matchMedia(q).matches).length;
}

function subscribe(cb: () => void): () => void {
  const lists = QUERIES.map((q) => window.matchMedia(q));
  lists.forEach((l) => l.addEventListener('change', cb));
  return () => lists.forEach((l) => l.removeEventListener('change', cb));
}

/**
 * Mosaïque en colonnes : chaque fiche est affectée à une colonne selon son rang (rang modulo nombre de colonnes).
 * Ajouter des fiches (« Afficher plus ») n'en déplace donc aucune ; les colonnes CSS, elles, rééquilibraient tout.
 */
export function PromptGrid({ entries, label }: { entries: readonly PromptEntry[]; label: string }) {
  const count = useSyncExternalStore(subscribe, columnCount, () => 2);
  const columns: PromptEntry[][] = Array.from({ length: count }, () => []);
  entries.forEach((e, i) => columns[i % count]!.push(e));
  return (
    <div className="grid" role="group" aria-label={label}>
      {columns.map((col, c) => (
        <ul className="grid__col" key={c}>
          {col.map((e) => (
            <li key={e.id}>
              <PromptCard entry={e} />
            </li>
          ))}
        </ul>
      ))}
    </div>
  );
}
