import { useMemo } from 'react';
import { entries, entriesById } from '../data/index.ts';
import { Visual } from '../components/Visual.tsx';
import { StatusBadge } from '../components/StatusBadge.tsx';
import { CopyButton } from '../components/CopyButton.tsx';
import { FavoriteButton } from '../components/FavoriteButton.tsx';
import { PromptGrid } from '../components/PromptGrid.tsx';
import { relatedEntries } from '../utils/related.ts';
import { href } from '../utils/router.ts';
import { KIND_LABELS, LANGUAGE_LABELS, ORIENTATION_LABELS } from '../utils/labels.ts';
import { STATUS_LABELS } from '../utils/visibility.ts';
import { NotFound } from './NotFound.tsx';
import type { PromptEntry } from '../types/library.ts';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function Detail({ id, lookup = entriesById }: { id: string; lookup?: Map<string, PromptEntry> }) {
  const entry = lookup.get(id);
  const related = useMemo(() => (entry ? relatedEntries(entry, entries) : []), [entry]);
  if (!entry) return <NotFound message="Cette fiche n’existe pas ou n’est pas publiée." />;

  const variants = entry.variants.filter((v) => v.role === 'variant');
  const bricks = entry.variants.filter((v) => v.role === 'brick');
  const details = Object.entries(entry.details ?? {});

  return (
    <article className="detail">
      <p className="breadcrumb">
        <a href={href('bibliotheque')}>← Bibliothèque</a>
      </p>
      <div className="detail__layout">
        <div className="detail__visual">
          <Visual entry={entry} size="large" eager />
        </div>
        <div className="detail__content">
          <h1 className="detail__title">{entry.title}</h1>
          <p className="detail__status">
            <StatusBadge status={entry.status} />
          </p>
          {entry.description ? <p className="lede">{entry.description}</p> : null}

          <section aria-labelledby="prompt-title" className="prompt-block">
            <h2 id="prompt-title">Prompt</h2>
            <pre className="prompt-text" lang={entry.language} tabIndex={0} aria-label="Texte du prompt">
              {entry.prompt}
            </pre>
            <div className="prompt-block__actions">
              <CopyButton text={entry.prompt} accessibleName={`Copier le prompt : ${entry.title}`} />
              <FavoriteButton id={entry.id} title={entry.title} withLabel />
            </div>
          </section>

          {variants.length > 0 ? (
            <section aria-labelledby="variants-title">
              <h2 id="variants-title">Variantes ({variants.length})</h2>
              <ul className="variants">
                {variants.map((v) => (
                  <li key={v.id}>
                    <p className="variants__label">
                      {v.label}
                      {v.language ? ` · ${LANGUAGE_LABELS[v.language]}` : ''}
                    </p>
                    <pre className="prompt-text" lang={v.language}>{v.prompt}</pre>
                    <CopyButton text={v.prompt} compact accessibleName={`Copier la variante « ${v.label} » : ${entry.title}`} />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {bricks.length > 0 ? (
            <details className="bricks">
              <summary>Briques recomposables ({bricks.length})</summary>
              <ul className="variants">
                {bricks.map((v) => (
                  <li key={v.id}>
                    <pre className="prompt-text" lang={v.language}>{v.prompt}</pre>
                    <CopyButton text={v.prompt} compact accessibleName={`Copier la brique : ${v.prompt.slice(0, 40)}`} />
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <section aria-labelledby="info-title">
            <h2 id="info-title">Informations</h2>
            <dl className="facts">
              <dt>Statut</dt>
              <dd>
                {STATUS_LABELS[entry.status]}
                {entry.status === 'to-test' ? ' — exploitable, résultat non vérifié' : ''}
              </dd>
              {entry.kind ? (
                <>
                  <dt>Type</dt>
                  <dd>{KIND_LABELS[entry.kind]}</dd>
                </>
              ) : null}
              {entry.categories.length > 0 ? (
                <>
                  <dt>Catégories</dt>
                  <dd>
                    <ul className="inline-list">
                      {entry.categories.map((c) => (
                        <li key={c}>
                          <a href={href('bibliotheque', new URLSearchParams({ category: c }))}>{c}</a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              {entry.tags.length > 0 ? (
                <>
                  <dt>Tags</dt>
                  <dd>
                    <ul className="inline-list">
                      {entry.tags.map((t) => (
                        <li key={t}>
                          <a href={href('bibliotheque', new URLSearchParams({ q: t }))}>{t}</a>
                        </li>
                      ))}
                    </ul>
                  </dd>
                </>
              ) : null}
              <dt>Orientation</dt>
              <dd>{entry.orientation ? ORIENTATION_LABELS[entry.orientation] : 'Non précisée'}</dd>
              {entry.ratio ? (
                <>
                  <dt>Ratio</dt>
                  <dd>{entry.ratio}</dd>
                </>
              ) : null}
              <dt>Langue du prompt</dt>
              <dd>{entry.language ? LANGUAGE_LABELS[entry.language] : 'Non précisée'}</dd>
              <dt>Image de référence</dt>
              <dd>{entry.requiresReference === true ? 'Oui, le prompt en demande une' : entry.requiresReference === false ? 'Non' : 'Non précisé'}</dd>
              {details.map(([k, v]) => (
                <div key={k} className="facts__row">
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section aria-labelledby="source-title" className="source">
            <h2 id="source-title">Source</h2>
            <p>
              {entry.source.url ? (
                <a href={entry.source.url} target="_blank" rel="noopener noreferrer">
                  {entry.source.label}
                  <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
                </a>
              ) : (
                entry.source.label
              )}
              {entry.source.originalId ? <> · référence d’origine <code>{entry.source.originalId}</code></> : null}
              {entry.source.importedAt ? <> · importé le {formatDate(entry.source.importedAt)}</> : null}
            </p>
          </section>
        </div>
      </div>

      {related.length > 0 ? (
        <section aria-labelledby="related-title" className="related">
          <h2 id="related-title">Fiches proches</h2>
          <PromptGrid entries={related} label="Fiches proches" />
        </section>
      ) : null}
    </article>
  );
}
