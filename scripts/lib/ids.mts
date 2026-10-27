import { cleanText, sha1, safeFileStem } from './text.mts';

/**
 * Identifiants stables, par ordre de priorité :
 * 1. identifiant fourni par la source externe  -> « ext-<id source> »
 * 2. identifiant fourni par l'Excel            -> repris tel quel (« ENT-… »)
 * 3. à défaut : hash stable de (source + prompt original)
 * Le titre n'entre jamais dans l'identifiant : il peut être corrigé sans casser les liens.
 */
export function externalId(sourceId: string, originalId: string | undefined, prompt: string): string {
  const id = cleanText(originalId);
  if (id) return `ext-${safeFileStem(id)}`;
  return `ext-h${sha1(`${sourceId}\n${cleanText(prompt)}`).slice(0, 10)}`;
}

export function excelId(entryId: string | undefined, sourceId: string, prompt: string): string {
  const id = cleanText(entryId);
  if (id) return safeFileStem(id);
  return `xl-h${sha1(`${sourceId}\n${cleanText(prompt)}`).slice(0, 10)}`;
}
