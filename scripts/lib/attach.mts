import type { PromptEntry, PromptImage } from '../../src/types/library.ts';

/**
 * Rattache l'image optimisée d'une fiche.
 * - Pas d'image : rien ne change.
 * - Image SANS description (alt) : elle n'est pas publiée et la fiche reste telle quelle (visible, sans image) ;
 *   `pending` signale « image prête, description manquante ». Aucun alt n'est jamais inventé.
 * - Image + description : l'image est rattachée, l'outil lu dans le nom du fichier alimente `generator`
 *   (sauf si le mapping l'a déjà défini) et l'orientation est mesurée si la source n'en donne pas.
 */
export function attachImage(
  entry: PromptEntry,
  image: PromptImage | undefined,
  generator?: string,
): { entry: PromptEntry; pending: boolean } {
  if (!image) return { entry, pending: false };
  if (!image.alt.trim()) return { entry, pending: true };
  const next: PromptEntry = { ...entry, image };
  if (generator && !next.generator) next.generator = generator;
  if (!next.orientation && image.width && image.height) {
    const ratio = Math.abs(image.width - image.height) / Math.max(image.width, image.height);
    next.orientation = ratio < 0.05 ? 'square' : image.width > image.height ? 'landscape' : 'portrait';
  }
  return { entry: next, pending: false };
}
