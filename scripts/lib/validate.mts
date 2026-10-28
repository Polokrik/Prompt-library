import type { PromptEntry, ValidationIssue } from '../../src/types/library.ts';
import { safeUrl } from './text.mts';
import { detectDuplicates, untreatedExactDuplicates } from './duplicates.mts';
import type { DuplicateCandidate } from '../../src/types/library.ts';

const STATUSES = ['published', 'to-test', 'to-confirm', 'hidden'];
const ORIENTATIONS = ['landscape', 'portrait', 'square'];
const LANGUAGES = ['fr', 'en'];
const ABSOLUTE_PATH = /^(\/|[A-Za-z]:[\\/]|file:|\\\\|~)/;
const IMAGE_PATH = /^images\/prompts\/(thumbs|large)\/[A-Za-z0-9._-]+\.webp$/;

export interface ValidateContext {
  /** Vrai si le fichier image existe (relatif à public/). */
  imageExists?: (path: string) => boolean;
  /** Candidats de doublons déjà calculés ; sinon recalculés. */
  duplicates?: DuplicateCandidate[];
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');

/**
 * Validation d'une bibliothèque complète. Les erreurs sont bloquantes seulement lorsqu'elles
 * touchent une fiche visible publiquement (published / to-test) ou la structure même des données.
 * Les manques sur les fiches to-confirm / hidden sont des avertissements : c'est leur raison d'être.
 */
export function validateLibrary(entries: PromptEntry[], ctx: ValidateContext = {}): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (i: ValidationIssue) => issues.push(i);
  const seen = new Map<string, number>();

  for (const e of entries) {
    const id = e.id;
    const visible = e.status === 'published' || e.status === 'to-test';
    const sev = visible ? 'error' : 'warning';
    const need = (ok: boolean, code: string, message: string, fixIn?: ValidationIssue['fixIn']) => {
      if (!ok) add({ severity: sev, code, entryId: id, message, ...(fixIn ? { fixIn } : {}) });
    };

    if (typeof id !== 'string' || !id) {
      add({ severity: 'error', code: 'id-missing', message: 'Fiche sans identifiant' });
      continue;
    }
    seen.set(id, (seen.get(id) ?? 0) + 1);

    if (!STATUSES.includes(e.status)) {
      add({ severity: 'error', code: 'status-invalid', entryId: id, message: `Statut invalide : « ${String(e.status)} »` });
    }
    need(typeof e.title === 'string' && e.title.trim() !== '', 'title-missing', 'Titre absent', 'excel');
    need(typeof e.prompt === 'string' && e.prompt.trim() !== '', 'prompt-missing', 'Prompt absent', 'excel');

    for (const key of ['categories', 'tags', 'variants'] as const) {
      if (!Array.isArray(e[key])) add({ severity: 'error', code: `${key}-malformed`, entryId: id, message: `« ${key} » doit être un tableau` });
    }
    if (isStringArray(e.categories)) {
      need(e.categories.length > 0, 'category-missing', 'Catégorie absente', 'mapping');
    } else if (Array.isArray(e.categories)) {
      add({ severity: 'error', code: 'categories-malformed', entryId: id, message: 'categories doit contenir des chaînes' });
    }
    if (Array.isArray(e.tags) && !isStringArray(e.tags)) {
      add({ severity: 'error', code: 'tags-malformed', entryId: id, message: 'tags doit contenir des chaînes' });
    }

    if (e.orientation !== undefined && !ORIENTATIONS.includes(e.orientation)) {
      add({ severity: 'error', code: 'orientation-invalid', entryId: id, message: `Orientation invalide : « ${String(e.orientation)} »` });
    }
    if (e.language !== undefined && !LANGUAGES.includes(e.language)) {
      add({ severity: 'error', code: 'language-invalid', entryId: id, message: `Langue invalide : « ${String(e.language)} »` });
    }

    if (!e.source || !e.source.id || !e.source.label) {
      add({ severity: 'error', code: 'source-missing', entryId: id, message: 'Source absente ou incomplète', fixIn: 'source' });
    } else if (e.source.url !== undefined && !safeUrl(e.source.url)) {
      add({ severity: 'error', code: 'source-url-invalid', entryId: id, message: `URL source invalide : « ${e.source.url} »`, fixIn: 'source' });
    }

    if (e.source?.originalUrl !== undefined && !safeUrl(e.source.originalUrl)) {
      add({ severity: 'error', code: 'source-original-url-invalid', entryId: id, message: `Lien d'origine invalide : « ${e.source.originalUrl} »`, fixIn: 'source' });
    }
    if (e.source?.license?.url !== undefined && !safeUrl(e.source.license.url)) {
      add({ severity: 'error', code: 'license-url-invalid', entryId: id, message: `URL de licence invalide : « ${e.source.license.url} »`, fixIn: 'source' });
    }
    if (e.status === 'published' && !e.image) {
      add({ severity: 'error', code: 'image-missing', entryId: id, message: 'Fiche « published » sans image', fixIn: 'images' });
    }
    if (e.image) {
      const { thumbnail, large, alt } = e.image;
      for (const [k, p] of [['thumbnail', thumbnail], ['large', large]] as const) {
        if (typeof p !== 'string' || !p) {
          add({ severity: 'error', code: 'image-path-missing', entryId: id, message: `image.${k} absent`, fixIn: 'images' });
        } else if (ABSOLUTE_PATH.test(p)) {
          add({ severity: 'error', code: 'image-path-absolute', entryId: id, message: `image.${k} : chemin absolu ou local interdit (« ${p} »)`, fixIn: 'images' });
        } else if (!IMAGE_PATH.test(p)) {
          add({ severity: 'error', code: 'image-path-invalid', entryId: id, message: `image.${k} : chemin inattendu (« ${p} »)`, fixIn: 'images' });
        } else if (ctx.imageExists && !ctx.imageExists(p)) {
          add({ severity: sev, code: 'image-file-missing', entryId: id, message: `Fichier image introuvable : ${p}`, fixIn: 'images' });
        }
      }
      need(typeof alt === 'string' && alt.trim() !== '', 'alt-missing', 'Texte alternatif absent', 'mapping');
      if (typeof alt === 'string' && alt.trim() && /^(image|photo|illustration)\s+(de|d['’])/i.test(alt.trim())) {
        add({ severity: 'warning', code: 'alt-redundant', entryId: id, message: 'Le texte alternatif commence par « image de… »', fixIn: 'mapping' });
      }
      if (typeof alt === 'string' && alt.trim() && e.title && alt.trim().toLowerCase() === e.title.trim().toLowerCase()) {
        add({ severity: 'warning', code: 'alt-equals-title', entryId: id, message: 'Le texte alternatif répète le titre', fixIn: 'mapping' });
      }
    }

    // Contrôles de chemins : champs techniques seulement (jamais le texte des prompts, qui peut contenir n'importe quoi).
    const technical = [e.image?.thumbnail, e.image?.large, e.source?.id, e.source?.url, e.source?.originalUrl, e.source?.originalId].filter(
      (v): v is string => typeof v === 'string',
    );
    if (technical.some((v) => /\bdemo\b/i.test(v.split('/')[0] ?? '') || /(^|\/)demo(\/|$)/i.test(v)) || /\bdemo\b/i.test(e.source?.id ?? '')) {
      add({ severity: 'error', code: 'demo-data', entryId: id, message: 'Donnée de démonstration détectée dans la bibliothèque finale' });
    }
    if (technical.some((v) => /^[A-Za-z]:[\\/]|^\/(home|Users|root|tmp)\//.test(v))) {
      add({ severity: 'error', code: 'local-path', entryId: id, message: 'Chemin local détecté dans les données' });
    }
    if (e.status === 'hidden' && !e.hiddenReason) {
      add({ severity: 'warning', code: 'hidden-reason-missing', entryId: id, message: 'Fiche masquée sans hiddenReason', fixIn: 'mapping' });
    }
  }

  for (const [id, n] of seen) {
    if (n > 1) add({ severity: 'error', code: 'id-duplicate', entryId: id, message: `Identifiant présent ${n} fois` });
  }

  const dupes = ctx.duplicates ?? detectDuplicates(entries);
  for (const u of untreatedExactDuplicates(entries, dupes)) {
    add({
      severity: 'error',
      code: 'duplicate-untreated',
      entryId: u.id,
      message: `Doublon exact de ${u.canonicalId} non traité (statut visible)`,
      fixIn: 'mapping',
    });
  }
  const nearCount = dupes.filter((d) => d.type !== 'exact').length;
  if (nearCount > 0) {
    add({ severity: 'warning', code: 'duplicates-candidates', message: `${nearCount} candidat(s) de doublon non exact : voir reports/duplicates-report.json` });
  }
  return issues;
}
