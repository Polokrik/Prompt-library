import { lazy, Suspense, useEffect, useRef } from 'react';
import { Layout } from './components/Layout.tsx';
import { Home } from './pages/Home.tsx';
import { Library } from './pages/Library.tsx';
import { Detail } from './pages/Detail.tsx';
import { About } from './pages/About.tsx';
import { NotFound } from './pages/NotFound.tsx';
import { useRoute } from './utils/router.ts';
import { SITE } from './config/site.ts';

const Composer = lazy(() => import('./pages/Composer.tsx'));

// La vue de revue n'existe qu'en développement : le bloc est supprimé du build de production.
const Review = import.meta.env.DEV ? lazy(() => import('./features/review/Review.tsx')) : null;

export function App() {
  const route = useRoute();
  const [section = '', param] = route.path;
  const pathKey = route.path.join('/');
  const first = useRef(true);

  // Après un changement de page (pas de simples filtres) : retour en haut et focus sur le contenu.
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    document.getElementById('contenu')?.focus({ preventScroll: true });
  }, [pathKey]);

  useEffect(() => {
    const titles: Record<string, string> = {
      '': '',
      bibliotheque: 'Bibliothèque',
      favoris: 'Favoris',
      'a-propos': 'À propos',
      composeur: 'Composeur',
      fiche: 'Fiche',
      revue: 'Revue',
    };
    const t = titles[section];
    document.title = t ? `${t} — ${SITE.name}` : SITE.name;
  }, [section]);

  let page;
  switch (section) {
    case '':
      page = <Home />;
      break;
    case 'bibliotheque':
      page = <Library />;
      break;
    case 'favoris':
      page = <Library favoritesView />;
      break;
    case 'fiche':
      page = param ? <Detail id={param} /> : <NotFound />;
      break;
    case 'a-propos':
      page = <About />;
      break;
    case 'composeur':
      page = (
        <Suspense fallback={<p>Chargement du composeur…</p>}>
          <Composer />
        </Suspense>
      );
      break;
    case 'revue':
      page = Review ? (
        <Suspense fallback={<p>Chargement…</p>}>
          <Review />
        </Suspense>
      ) : (
        <NotFound />
      );
      break;
    default:
      page = <NotFound />;
  }
  return <Layout current={section}>{page}</Layout>;
}
