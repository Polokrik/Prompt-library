import type { ReactNode } from 'react';
import { SITE } from '../config/site.ts';
import { href } from '../utils/router.ts';
import { useFavorites } from '../utils/favorites.ts';
import { useAnnouncement } from '../utils/announce.ts';

export function Layout({ current, children }: { current: string; children: ReactNode }) {
  const favorites = useFavorites();
  const status = useAnnouncement();
  const link = (path: string, label: string, key: string) => (
    <a href={href(path)} aria-current={current === key ? 'page' : undefined}>
      {label}
    </a>
  );
  return (
    <>
      <a className="skip-link" href="#contenu" onClick={(e) => { e.preventDefault(); document.getElementById('contenu')?.focus(); }}>
        Aller au contenu
      </a>
      <header className="site-header">
        <a className="site-header__brand" href={href('')}>
          {SITE.name}
        </a>
        <nav aria-label="Navigation principale">
          <ul>
            <li>{link('bibliotheque', 'Bibliothèque', 'bibliotheque')}</li>
            <li>{link('composeur', 'Composeur', 'composeur')}</li>
            <li>{link('favoris', `Favoris${favorites.size ? ` (${favorites.size})` : ''}`, 'favoris')}</li>
            <li>{link('a-propos', 'À propos', 'a-propos')}</li>
            {import.meta.env.DEV ? <li>{link('revue', 'Revue (dev)', 'revue')}</li> : null}
          </ul>
        </nav>
      </header>
      <main id="contenu" tabIndex={-1}>
        {children}
      </main>
      <footer className="site-footer">
        <p>
          Expérience personnelle, sans compte ni suivi. Les résultats varient selon les outils.{' '}
          <a href={href('a-propos')}>Sources et inspirations</a>.
        </p>
      </footer>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">
        {status}
      </div>
    </>
  );
}
