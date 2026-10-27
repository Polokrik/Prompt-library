import type {
  PromptEntry,
  PromptKind,
  PromptLanguage,
  PromptOrientation,
  PromptVariant,
} from '../../src/types/library.ts';
import type { RawCatalogueRow, RawText } from './excel.mts';
import { cleanText, splitMulti, unique } from './text.mts';
import { excelId } from './ids.mts';
import { isPlaceholder } from './placeholders.mts';
import { SOURCE_IDS } from './paths.mts';
import type { NatureCap } from './status.mts';

export interface RawExcelBatch {
  source: string;
  file: string;
  importedAt: string;
  mode: 'sample' | 'full';
  catalogue: RawCatalogueRow[];
  texts: RawText[];
}

/** Descriptions génériques de l'Excel (consignes de classeur, pas du contenu) : non republiées comme description. */
const GENERIC_DESCRIPTION = [
  /^Référence de style à utiliser comme brique\.?$/i,
  /^Modèle à adapter/i,
  /^Brique technique à intégrer/i,
  /^Idée visuelle à revoir\s*:/i,
];

const DETAIL_COLUMNS: [string, string][] = [
  ['Style détaillé', 'Style'],
  ['Technique détaillée', 'Technique'],
  ['Époque / contexte', 'Époque'],
  ['Ambiance', 'Ambiance'],
  ['Composition / cadrage', 'Composition'],
  ['Sujet / action', 'Sujet'],
  ['Décor', 'Décor'],
  ['Couleurs / lumière', 'Lumière et couleurs'],
  ['Format détaillé', 'Format'],
  ['Fichier mentionné', 'Fichier'],
];

const KIND_BY_TYPE: Record<string, PromptKind> = {
  Prompt: 'prompt',
  Template: 'template',
  Style: 'style',
  Technique: 'technique',
  Note: 'note',
};

export function toLanguage(value: unknown): PromptLanguage | undefined {
  const t = cleanText(value).toLowerCase();
  if (['anglais', 'english', 'en'].includes(t)) return 'en';
  if (['français', 'francais', 'french', 'fr'].includes(t)) return 'fr';
  return undefined;
}

export function toOrientation(value: unknown): PromptOrientation | undefined {
  const found = new Set<PromptOrientation>();
  for (const part of splitMulti(value)) {
    const t = part.toLowerCase();
    if (['horizontal', 'paysage', 'landscape'].includes(t)) found.add('landscape');
    else if (['vertical', 'portrait'].includes(t)) found.add('portrait');
    else if (['carré', 'carre', 'square'].includes(t)) found.add('square');
  }
  // Mentions contradictoires (ex. « horizontal ; vertical ») : on ne tranche pas.
  return found.size === 1 ? [...found][0] : undefined;
}

function toVariant(t: RawText): PromptVariant | undefined {
  const text = cleanText(t['Texte intégral']);
  if (!text) return undefined;
  const role = cleanText(t.Rôle);
  const language = toLanguage(t['Langue proposée']);
  const base = { id: t.Texte_ID, prompt: text, ...(language ? { language } : {}) };
  if (role === 'Brique recomposable') return { ...base, label: 'Brique recomposable', role: 'brick' };
  const model = /libellé\s+([^,)]+)/i.exec(role)?.[1]?.trim();
  if (role.startsWith('Variante')) {
    return { ...base, label: model ? `Variante (libellé ${model}, non vérifié)` : 'Variante', role: 'variant' };
  }
  return { ...base, label: role || 'Autre texte', role: 'variant' };
}

/** Plafond de statut lié à la nature de la fiche (voir README « Règles de statut Excel »). */
export function natureCap(kind: PromptKind | undefined): NatureCap | undefined {
  switch (kind) {
    case 'note':
      return {
        status: 'hidden',
        note: 'Note pédagogique : pas une fiche de galerie',
        hiddenReason: 'Note pédagogique, conservée dans les données mais non publiée',
      };
    case 'style':
    case 'technique':
    case 'template':
      return {
        status: 'to-confirm',
        note: 'Brique ou modèle à recomposer : pas une fiche de galerie tant qu’un exemple abouti n’est pas associé (mapping : status)',
      };
    case undefined:
      return { status: 'to-confirm', note: 'Type de contenu à confirmer dans l’Excel' };
    default:
      return undefined;
  }
}

export interface ExcelDraft {
  entry: PromptEntry;
  cap?: NatureCap;
}

/** Données brutes Excel -> fiches « brouillon » (sans statut définitif ni image). */
export function normalizeExcel(batch: RawExcelBatch): ExcelDraft[] {
  const textsById = new Map(batch.texts.map((t) => [t.Texte_ID, t]));
  const textsByEntry = new Map<string, RawText[]>();
  for (const t of batch.texts) {
    if (!t.Entrée_ID) continue;
    const list = textsByEntry.get(t.Entrée_ID) ?? [];
    list.push(t);
    textsByEntry.set(t.Entrée_ID, list);
  }

  return batch.catalogue.map((row): ExcelDraft => {
    const mainId = cleanText(row['Texte principal_ID']);
    const main = textsById.get(mainId);
    const prompt = cleanText(main?.['Texte intégral']);
    const id = excelId(row.Entrée_ID, SOURCE_IDS.excel, prompt);

    const variants = (textsByEntry.get(row.Entrée_ID) ?? [])
      .filter((t) => t.Texte_ID !== mainId)
      .map(toVariant)
      .filter((v): v is PromptVariant => v !== undefined);

    const famille = cleanText(row['Famille proposée']);
    const categories = unique([
      ...(isPlaceholder(famille) ? [] : [famille]),
      ...splitMulti(row['Usages proposés']).filter((u) => !isPlaceholder(u)),
    ]);

    const tags = unique(
      [
        ...splitMulti(row['Ambiance'], /[,;]/),
        ...(isPlaceholder(row['Époque / contexte']) ? [] : [cleanText(row['Époque / contexte'])]),
      ].filter((t) => !isPlaceholder(t) && !/^à définir/i.test(t)),
    ).filter((t, i, a) => a.findIndex((x) => x.toLowerCase() === t.toLowerCase()) === i);

    const details: Record<string, string> = {};
    for (const [col, label] of DETAIL_COLUMNS) {
      const v = cleanText(row[col]);
      if (!isPlaceholder(v)) details[label] = v;
    }
    const title = cleanText(row['Titre']);
    const initialLabel = cleanText(row['Libellé initial']);
    if (!isPlaceholder(initialLabel) && initialLabel !== title) details['Libellé initial'] = initialLabel;

    const description = cleanText(row['Description de travail']);
    const kind = KIND_BY_TYPE[cleanText(row['Type proposé'])];
    const language = toLanguage(main?.['Langue proposée']);
    const orientation = toOrientation(row['Orientation mentionnée']);
    const ratio = cleanText(row['Ratio explicite']);
    const ref = cleanText(row['Référence requise']);

    const entry: PromptEntry = {
      id,
      title,
      prompt,
      ...(description && !GENERIC_DESCRIPTION.some((r) => r.test(description)) ? { description } : {}),
      status: 'to-confirm',
      categories,
      tags,
      ...(orientation ? { orientation } : {}),
      ...(language ? { language } : {}),
      ...(ref === 'Oui' ? { requiresReference: true } : ref === 'Non' ? { requiresReference: false } : {}),
      ...(!isPlaceholder(ratio) ? { ratio } : {}),
      ...(kind ? { kind } : {}),
      variants,
      ...(Object.keys(details).length ? { details } : {}),
      source: {
        id: SOURCE_IDS.excel,
        label: 'Prompt Bible',
        originalId: row.Entrée_ID,
        importedAt: batch.importedAt,
      },
    };
    const cap = natureCap(kind);
    return { entry, ...(cap ? { cap } : {}) };
  });
}
