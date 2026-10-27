import { memo } from 'react';
import type { PromptEntry } from '../types/library.ts';
import { href } from '../utils/router.ts';
import { Visual } from './Visual.tsx';
import { StatusBadge } from './StatusBadge.tsx';
import { CopyButton } from './CopyButton.tsx';
import { FavoriteButton } from './FavoriteButton.tsx';

const MAX_TAGS = 3;

export const PromptCard = memo(function PromptCard({ entry }: { entry: PromptEntry }) {
  const to = href(`fiche/${encodeURIComponent(entry.id)}`);
  return (
    <article className="card">
      <a className="card__visual" href={to} tabIndex={-1} aria-hidden="true">
        <Visual entry={entry} size="thumb" />
      </a>
      <div className="card__body">
        <p className="card__meta">
          {entry.categories[0] ? <span className="card__category">{entry.categories[0]}</span> : null}
          <StatusBadge status={entry.status} />
        </p>
        <h3 className="card__title">
          <a href={to}>{entry.title}</a>
        </h3>
        {entry.tags.length > 0 ? (
          <ul className="taglist" aria-label="Tags">
            {entry.tags.slice(0, MAX_TAGS).map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        ) : null}
        <div className="card__actions">
          <CopyButton text={entry.prompt} accessibleName={`Copier le prompt : ${entry.title}`} compact />
          <FavoriteButton id={entry.id} title={entry.title} />
        </div>
      </div>
    </article>
  );
});
