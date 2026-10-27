import { href } from '../utils/router.ts';

export function NotFound({ message = 'Cette page n’existe pas.' }: { message?: string }) {
  return (
    <div className="empty">
      <h1 className="page-title">Introuvable</h1>
      <p>{message}</p>
      <p>
        <a className="btn" href={href('bibliotheque')}>
          Retour à la bibliothèque
        </a>
      </p>
    </div>
  );
}
