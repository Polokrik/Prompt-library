/** Valeurs de remplissage de l'Excel qui ne portent aucune information. */
const EMPTY_MARKERS = new Set([
  'non renseigné',
  'non renseignée',
  'non précisée',
  'non précisé',
  'à confirmer',
  'a confirmer',
  'n/a',
  '-',
]);

export function isPlaceholder(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  const t = String(value).trim().toLowerCase();
  return t === '' || EMPTY_MARKERS.has(t);
}
