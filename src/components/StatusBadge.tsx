import type { PromptStatus } from '../types/library.ts';
import { STATUS_LABELS } from '../utils/visibility.ts';

/** Indicateur de statut : toujours un texte (jamais la couleur seule). Rien pour « published ». */
export function StatusBadge({ status }: { status: PromptStatus }) {
  if (status === 'published') return null;
  return (
    <span className={`badge badge--${status}`} title={status === 'to-test' ? 'Prompt exploitable, résultat non encore vérifié' : undefined}>
      {STATUS_LABELS[status]}
    </span>
  );
}
