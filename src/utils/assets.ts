/** Résout un chemin public (« images/… ») en tenant compte de `base` (GitHub Pages sous /repo/). */
export function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL;
  return `${base.endsWith('/') ? base : `${base}/`}${path.replace(/^\/+/, '')}`;
}
