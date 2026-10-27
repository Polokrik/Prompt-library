import { toggleFavorite, useFavorites } from '../utils/favorites.ts';
import { announce } from '../utils/announce.ts';

export function FavoriteButton({ id, title, withLabel = false }: { id: string; title: string; withLabel?: boolean }) {
  const favorites = useFavorites();
  const on = favorites.has(id);
  return (
    <button
      type="button"
      className={`btn btn--ghost ${withLabel ? '' : 'btn--icon'}`}
      aria-pressed={on}
      aria-label={withLabel ? `${on ? 'Dans mes favoris' : 'Ajouter aux favoris'} : ${title}` : `Favori : ${title}`}
      onClick={() => {
        toggleFavorite(id);
        announce(on ? 'Retiré des favoris' : 'Ajouté aux favoris');
      }}
    >
      <span aria-hidden="true">{on ? '♥' : '♡'}</span>
      {withLabel ? <span> {on ? 'Dans mes favoris' : 'Ajouter aux favoris'}</span> : null}
    </button>
  );
}
