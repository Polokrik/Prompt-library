import type { PromptEntry } from '../../src/types/library.ts';
import { cleanText, safeUrl, splitMulti, stripHtml, unique } from './text.mts';
import { externalId } from './ids.mts';
import { toLanguage } from './normalize-excel.mts';
import { SOURCE_IDS } from './paths.mts';

/**
 * Entrée brute de la source externe : champs extraits SANS transformation (`original` conserve
 * l'objet tel que fourni par la source). Seuls les champs réellement présents sont écrits.
 */
export interface RawExternalEntry {
  order: number;
  originalId?: string;
  title?: string;
  prompt?: string;
  categories?: string | string[];
  tags?: string | string[];
  imageUrl?: string;
  pageUrl?: string;
  language?: string;
  alt?: string;
  author?: string;
  license?: { label: string; url?: string };
  /** Lien vers la publication d'origine (post X, dépôt…). */
  postUrl?: string;
  /** Libellé de la première image (ex. « GPT-4o · archive »). */
  imageLabel?: string;
  origin?: string;
  original: Record<string, unknown>;
}

export interface RawExternalBatch {
  source: string;
  sourceUrl: string;
  importedAt: string;
  mode: 'sample' | 'full';
  entries: RawExternalEntry[];
}

export const EXTERNAL_LABEL = 'La baie des images';

export function externalEntryId(raw: RawExternalEntry): string {
  return externalId(SOURCE_IDS.external, raw.originalId, raw.prompt ?? '');
}

function list(value: string | string[] | undefined): string[] {
  return unique(splitMulti(value, /[,;|]/).map((s) => cleanText(stripHtml(s))).filter(Boolean));
}

/** Textes de remplissage de la source, jamais republiés comme valeur éditoriale. */
const PLACEHOLDER_AUTHOR = [/^créateur cité dans la source$/i, /^anonyme?$/i, /^inconnu/i];

export function normalizeExternal(batch: RawExternalBatch): { entry: PromptEntry; alt?: string }[] {
  return batch.entries.map((raw) => {
    const prompt = cleanText(stripHtml(raw.prompt ?? ''));
    const language = toLanguage(raw.language);
    const alt = cleanText(stripHtml(raw.alt ?? ''));
    const author = cleanText(raw.author);
    const postUrl = safeUrl(raw.postUrl);
    const entry: PromptEntry = {
      id: externalEntryId(raw),
      title: cleanText(stripHtml(raw.title ?? '')),
      prompt,
      status: 'to-confirm',
      categories: list(raw.categories),
      tags: list(raw.tags),
      ...(language ? { language } : {}),
      variants: [],
      source: {
        id: SOURCE_IDS.external,
        label: EXTERNAL_LABEL,
        // Lien vers la compilation (le site source) ; le post d'origine est dans originalUrl.
        url: safeUrl(batch.sourceUrl) ?? batch.sourceUrl,
        ...(raw.originalId ? { originalId: cleanText(raw.originalId) } : {}),
        ...(author && !PLACEHOLDER_AUTHOR.some((r) => r.test(author)) ? { author } : {}),
        ...(postUrl ? { originalUrl: postUrl } : {}),
        ...(raw.license?.label ? { license: { label: cleanText(raw.license.label), ...(safeUrl(raw.license.url) ? { url: safeUrl(raw.license.url)! } : {}) } } : {}),
        importedAt: batch.importedAt,
      },
    };
    return { entry, ...(alt ? { alt } : {}) };
  });
}
