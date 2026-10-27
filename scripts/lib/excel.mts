import fs from 'node:fs';
import XLSX from 'xlsx';


export const CATALOGUE_SHEET = 'CATALOGUE';
export const TEXTS_SHEET = 'TEXTES';
/** Les premières lignes de ces feuilles sont un titre, une consigne et des compteurs ; l'en-tête est en ligne 6. */
export const HEADER_ROW_INDEX = 5;

export type Cell = string | number | boolean | null;
export type Row = Record<string, Cell>;

export interface RawText {
  Texte_ID: string;
  Entrée_ID: string | null;
  Rôle: string | null;
  'Texte intégral': string | null;
  'Langue proposée': string | null;
  /** Numéro de ligne dans la feuille (1 = première ligne), pour retrouver la cellule dans Excel. */
  _row: number;
}

export interface RawCatalogueRow extends Row {
  Entrée_ID: string;
  _row: number;
}

export interface RawExcel {
  catalogue: RawCatalogueRow[];
  texts: RawText[];
}

export function readWorkbook(file: string): XLSX.WorkBook {
  if (!fs.existsSync(file)) throw new Error(`Fichier Excel introuvable : ${file}`);
  return XLSX.readFile(file, { cellDates: false });
}

function sheetRows(wb: XLSX.WorkBook, name: string): { header: string[]; rows: Cell[][] } {
  const ws = wb.Sheets[name];
  if (!ws) throw new Error(`Feuille « ${name} » absente du classeur (feuilles : ${wb.SheetNames.join(', ')})`);
  const all = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null, blankrows: true });
  const header = (all[HEADER_ROW_INDEX] ?? []).map((h) => (h === null ? '' : String(h)));
  return { header, rows: all.slice(HEADER_ROW_INDEX + 1) };
}

export function rowObjects(wb: XLSX.WorkBook, name: string): Row[] {
  const { header, rows } = sheetRows(wb, name);
  return rows.map((cells, i) => {
    const obj: Row = {};
    header.forEach((h, c) => {
      if (h) obj[h] = cells[c] ?? null;
    });
    obj._row = HEADER_ROW_INDEX + 2 + i;
    return obj;
  });
}

export function headerOf(wb: XLSX.WorkBook, name: string): string[] {
  return sheetRows(wb, name).header.filter(Boolean);
}

export function sheetSizes(wb: XLSX.WorkBook): { name: string; ref: string | undefined; rows: number }[] {
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name]!;
    const rows = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, defval: null });
    return { name, ref: ws['!ref'], rows: rows.length };
  });
}

export function readRawExcel(file: string): RawExcel {
  const wb = readWorkbook(file);
  const catalogue = rowObjects(wb, CATALOGUE_SHEET).filter((r) => r['Entrée_ID']) as RawCatalogueRow[];
  const texts = rowObjects(wb, TEXTS_SHEET).filter((r) => r['Texte_ID']) as unknown as RawText[];
  return { catalogue, texts };
}

/** Natures probables d'une ligne du catalogue (classement indicatif, jamais définitif). */
export type RowNature =
  | 'prompt'
  | 'template'
  | 'style'
  | 'technique'
  | 'variante'
  | 'note pédagogique'
  | 'fragment'
  | 'métadonnée'
  | 'contenu non reconnu';

export function classifyCatalogueRow(row: Row): RowNature {
  switch (row['Type proposé']) {
    case 'Prompt':
      return 'prompt';
    case 'Template':
      return 'template';
    case 'Style':
      return 'style';
    case 'Technique':
      return 'technique';
    case 'Note':
      return 'note pédagogique';
    default:
      return 'contenu non reconnu';
  }
}

export function classifyText(t: RawText): RowNature {
  const role = t.Rôle ?? '';
  if (role === 'Original') return 'prompt';
  if (role.startsWith('Variante')) return 'variante';
  if (role === 'Brique recomposable') return 'fragment';
  if (role === 'Fragment non rattaché') return 'fragment';
  return 'contenu non reconnu';
}

/** Lot pilote déterministe et varié : quotas par type, dans l'ordre du classeur. */
export const SAMPLE_QUOTAS: Record<string, number> = {
  Prompt: 12,
  Template: 5,
  Style: 5,
  Technique: 4,
  Note: 1,
  'À confirmer': 3,
};

export function pickSample(catalogue: RawCatalogueRow[], limit = 30): RawCatalogueRow[] {
  const taken: Record<string, number> = {};
  const out: RawCatalogueRow[] = [];
  // « 1970s panda train » illustre à lui seul variantes et briques : on le garde s'il existe.
  for (const row of catalogue) {
    const type = String(row['Type proposé'] ?? 'À confirmer');
    const quota = SAMPLE_QUOTAS[type] ?? 0;
    if ((taken[type] ?? 0) < quota && out.length < limit) {
      taken[type] = (taken[type] ?? 0) + 1;
      out.push(row);
    }
  }
  return out;
}
