import { useSyncExternalStore } from 'react';

/**
 * Routage minimal par hash (#/chemin?query) : aucune réécriture serveur nécessaire,
 * compatible GitHub Pages sous n'importe quel sous-chemin.
 */
export interface Route {
  path: string[];
  params: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [pathPart = '', query = ''] = raw.split('?');
  return {
    path: pathPart.split('/').filter(Boolean).map(decodeURIComponent),
    params: new URLSearchParams(query),
  };
}

let lastHash = '';
let lastRoute: Route = parseHash('');

function snapshot(): Route {
  if (window.location.hash !== lastHash) {
    lastHash = window.location.hash;
    lastRoute = parseHash(lastHash);
  }
  return lastRoute;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, snapshot, () => lastRoute);
}

export function href(path: string, params?: URLSearchParams): string {
  const q = params && [...params.keys()].length ? `?${params.toString()}` : '';
  return `#/${path.replace(/^\/+/, '')}${q}`;
}

/** Remplace l'entrée d'historique (utile pour les filtres : pas une page par frappe). */
export function replaceHash(path: string, params?: URLSearchParams): void {
  const target = href(path, params);
  if (window.location.hash !== target) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
}
