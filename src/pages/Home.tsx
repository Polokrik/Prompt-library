import { useMemo, useState, type FormEvent } from 'react';
import { SITE } from '../config/site.ts';
import { collections, entries, entriesById } from '../data/index.ts';
import { PromptGrid } from '../components/PromptGrid.tsx';
import { categoryCounts } from '../utils/stats.ts';
import { href } from '../utils/router.ts';

const GATES = 5;
const SELECTION = 6;

export function Home() {
  const [q, setQ] = useState('');
  const gates = useMemo(() => categoryCounts(entries).slice(0, GATES), []);
  // Sélection éditoriale : collections « featured » si elles existent, sinon les premières fiches avec image, puis les premières fiches.
  const selection = useMemo(() => {
    const featured = collections.filter((c) => c.featured).flatMap((c) => c.promptIds);
    const fromCollections = featured.map((id) => entriesById.get(id)).filter((e): e is NonNullable<typeof e> => !!e);
    const pool = fromCollections.length ? fromCollections : [...entries.filter((e) => e.image), ...entries.filter((e) => !e.image)];
    return pool.slice(0, SELECTION);
  }, []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (q.trim()) p.set('q', q.trim());
    window.location.hash = href('bibliotheque', p);
  }

  function surprise() {
    if (entries.length === 0) return;
    const pick = entries[Math.floor(Math.random() * entries.length)]!;
    window.location.hash = href(`fiche/${encodeURIComponent(pick.id)}`);
  }

  return (
    <div className="home">
      <section className="hero" aria-labelledby="hero-title">
        <h1 id="hero-title" className="hero__title">
          {SITE.name}
        </h1>
        <p className="hero__tagline">{SITE.tagline}</p>
        <form className="hero__search" role="search" onSubmit={onSubmit}>
          <label htmlFor="home-search">Rechercher un prompt</label>
          <div className="hero__search-row">
            <input
              id="home-search"
              type="search"
              value={q}
              placeholder={SITE.searchPlaceholder}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
            <button type="submit" className="btn">
              Chercher
            </button>
          </div>
        </form>
        <p className="hero__actions">
          <a className="btn btn--outline" href={href('bibliotheque')}>
            Toute la bibliothèque ({entries.length})
          </a>
          <button type="button" className="btn btn--outline" onClick={surprise} disabled={entries.length === 0}>
            Surprends-moi
          </button>
        </p>
      </section>

      {gates.length > 0 ? (
        <section className="gates" aria-labelledby="gates-title">
          <h2 id="gates-title" className="section-title">
            Par où entrer
          </h2>
          <ul>
            {gates.map((g) => (
              <li key={g.name}>
                <a href={href('bibliotheque', new URLSearchParams({ category: g.name }))}>
                  <span className="gates__name">{g.name}</span>
                  <span className="gates__count">{g.count}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {selection.length > 0 ? (
        <section aria-labelledby="selection-title">
          <h2 id="selection-title" className="section-title">
            {collections.some((c) => c.featured) ? 'Sélection' : 'À découvrir'}
          </h2>
          <PromptGrid entries={selection} label="Sélection de fiches" />
        </section>
      ) : (
        <p className="empty">La bibliothèque est vide pour le moment.</p>
      )}
    </div>
  );
}
