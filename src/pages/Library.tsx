import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { PAGE_SIZE } from '../config/site.ts';
import { entries } from '../data/index.ts';
import { PromptGrid } from '../components/PromptGrid.tsx';
import { applyFilters, countActiveFilters, filtersFromParams, filtersToParams, type Filters } from '../utils/filters.ts';
import { buildIndex, search } from '../utils/search.ts';
import { categoryCounts } from '../utils/stats.ts';
import { replaceHash, useRoute } from '../utils/router.ts';
import { useFavorites } from '../utils/favorites.ts';
import { LANGUAGE_LABELS, ORIENTATION_LABELS } from '../utils/labels.ts';

const index = buildIndex(entries);
const categories = categoryCounts(entries);

export function Library({ favoritesView = false }: { favoritesView?: boolean }) {
  const route = useRoute();
  const favorites = useFavorites();
  const base = filtersFromParams(route.params);
  const filters: Filters = favoritesView ? { ...base, favoritesOnly: true } : base;
  const routePath = favoritesView ? 'favoris' : 'bibliotheque';
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [moreOpen, setMoreOpen] = useState(() => countActiveFilters(filters) - Number(!!filters.category) > 0);

  const deferredQuery = useDeferredValue(filters.q);
  const key = JSON.stringify(filters);
  useEffect(() => setLimit(PAGE_SIZE), [key]);

  const results = useMemo(
    () => applyFilters(search(index, deferredQuery), filters, favorites),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [deferredQuery, key, favorites],
  );

  function update(patch: Partial<Filters>) {
    const next = { ...filters, ...patch };
    if (favoritesView) next.favoritesOnly = false; // implicite sur cette route
    replaceHash(routePath, filtersToParams(next));
  }
  const reset = () => replaceHash(routePath, new URLSearchParams());
  const active = countActiveFilters(favoritesView ? { ...filters, favoritesOnly: false } : filters) + Number(!!filters.q);
  const shown = results.slice(0, limit);

  return (
    <div className="library">
      <h1 className="page-title">{favoritesView ? 'Mes favoris' : 'Bibliothèque'}</h1>
      {favoritesView ? (
        <p className="lede">Enregistrés dans ce navigateur uniquement (aucune synchronisation).</p>
      ) : null}

      <form className="toolbar" role="search" aria-label="Recherche et filtres" onSubmit={(e) => e.preventDefault()}>
        <div className="field field--grow">
          <label htmlFor="q">Rechercher</label>
          <input id="q" type="search" value={filters.q} onChange={(e) => update({ q: e.target.value })} autoComplete="off" placeholder="Titre, prompt, tag…" />
        </div>
        <div className="field">
          <label htmlFor="category">Catégorie</label>
          <select id="category" value={filters.category} onChange={(e) => update({ category: e.target.value })}>
            <option value="">Toutes</option>
            {categories.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="sort">Trier</label>
          <select id="sort" value={filters.sort} onChange={(e) => update({ sort: e.target.value as Filters['sort'] })}>
            <option value="relevance">{filters.q ? 'Pertinence' : 'Par défaut'}</option>
            <option value="title-asc">Titre A → Z</option>
            <option value="title-desc">Titre Z → A</option>
          </select>
        </div>
        <details className="more" open={moreOpen} onToggle={(e) => setMoreOpen(e.currentTarget.open)}>
          <summary>Plus de filtres</summary>
          <div className="more__fields">
            <div className="field">
              <label htmlFor="orientation">Orientation</label>
              <select id="orientation" value={filters.orientation} onChange={(e) => update({ orientation: e.target.value as Filters['orientation'] })}>
                <option value="">Toutes</option>
                {Object.entries(ORIENTATION_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="language">Langue du prompt</label>
              <select id="language" value={filters.language} onChange={(e) => update({ language: e.target.value as Filters['language'] })}>
                <option value="">Toutes</option>
                {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="status">Statut</label>
              <select id="status" value={filters.status} onChange={(e) => update({ status: e.target.value as Filters['status'] })}>
                <option value="all">Tous</option>
                <option value="published">Publiées</option>
                <option value="to-test">À tester</option>
              </select>
            </div>
            <div className="field field--check">
              <input id="reference" type="checkbox" checked={filters.reference === 'yes'} onChange={(e) => update({ reference: e.target.checked ? 'yes' : '' })} />
              <label htmlFor="reference">Avec image de référence requise</label>
            </div>
            {!favoritesView ? (
              <div className="field field--check">
                <input id="fav" type="checkbox" checked={filters.favoritesOnly} onChange={(e) => update({ favoritesOnly: e.target.checked })} />
                <label htmlFor="fav">Favoris seulement</label>
              </div>
            ) : null}
          </div>
        </details>
        <div className="toolbar__foot">
          <p className="count" role="status" aria-live="polite" aria-atomic="true">
            {results.length} résultat{results.length > 1 ? 's' : ''}
            {results.length !== entries.length ? ` sur ${entries.length}` : ''}
          </p>
          <button type="button" className="btn btn--ghost" onClick={reset} disabled={active === 0}>
            Réinitialiser les filtres
          </button>
        </div>
      </form>

      {results.length === 0 ? (
        <div className="empty">
          <p>
            {favoritesView && favorites.size === 0
              ? 'Aucun favori pour le moment. Utilisez ♡ sur une fiche pour la retrouver ici.'
              : 'Aucune fiche ne correspond à cette recherche.'}
          </p>
          {active > 0 ? (
            <p>
              <button type="button" className="btn" onClick={reset}>
                Effacer la recherche et les filtres
              </button>
            </p>
          ) : null}
        </div>
      ) : (
        <>
          <PromptGrid entries={shown} label="Résultats" />
          {shown.length < results.length ? (
            <p className="more-results">
              <button type="button" className="btn btn--outline" onClick={() => setLimit(limit + PAGE_SIZE)}>
                Afficher {Math.min(PAGE_SIZE, results.length - shown.length)} fiches de plus ({shown.length}/{results.length})
              </button>
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

