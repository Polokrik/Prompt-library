import { SITE } from '../config/site.ts';
import { entries, sources } from '../data/index.ts';
import { href } from '../utils/router.ts';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}

export function About() {
  const toTest = entries.filter((e) => e.status === 'to-test').length;
  return (
    <div className="prose">
      <h1 className="page-title">À propos</h1>
      <p className="lede">
        {SITE.name} est une expérience personnelle : une bibliothèque d’idées de prompts pour créer des images, à parcourir
        comme un moodboard.
      </p>

      <h2>Ce que c’est</h2>
      <p>
        Le projet rassemble et structure des prompts visuels venus de plusieurs sources, présentés dans une seule
        bibliothèque. Il n’y a ni compte, ni commentaires, ni statistiques de visite. Les favoris restent dans votre navigateur.
      </p>

      <h2>À garder en tête</h2>
      <ul>
        <li>Les résultats varient selon les outils et les versions : un prompt n’est pas une recette garantie.</li>
        <li>
          Certaines fiches sont marquées <strong>À tester</strong> : le prompt paraît exploitable, mais son résultat n’a pas encore été vérifié
          {toTest > 0 ? ` (${toTest} fiche${toTest > 1 ? 's' : ''} actuellement)` : ''}.
        </li>
        <li>Les fiches sans image affichent un extrait du prompt : aucune image n’est inventée.</li>
      </ul>

      <h2>Inspiration et sources</h2>
      <p>
        L’expérience est notamment inspirée par{' '}
        <a href={SITE.inspiration.url} target="_blank" rel="noopener noreferrer">
          {SITE.inspiration.label}
          <span className="sr-only"> (s’ouvre dans un nouvel onglet)</span>
        </a>{' '}
        de {SITE.inspiration.author}. Les sources sont conservées dans la mesure du possible : chaque fiche indique son origine.
      </p>
      {sources.length > 0 ? (
        <ul>
          {sources.map((s) => (
            <li key={s.id}>
              <strong>{s.label}</strong> — {s.count} fiche{s.count > 1 ? 's' : ''} dans les données
              {s.importedAt ? `, dernier import le ${formatDate(s.importedAt)}` : ''}.
            </li>
          ))}
        </ul>
      ) : null}
      <p>
        <a className="btn" href={href('bibliotheque')}>
          Parcourir la bibliothèque
        </a>
      </p>
    </div>
  );
}
