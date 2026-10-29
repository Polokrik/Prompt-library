/**
 * npm run generate:composer
 * Prompt Bible.xlsx -> src/data/composer.json (options du composeur). Lecture seule du classeur ;
 * rien n'est inventé : chaque option vient d'une ligne du catalogue ou de la feuille de méthode.
 *
 * Répartition des lignes « Technique » d'après leur colonne « Style détaillé » :
 *   « Technique éclairage »  -> lumière ;  « Concept de mouvement » -> effets ;  le reste -> techniques.
 */
import path from 'node:path';
import type { ComposerData, ComposerOption, ComposerTerm } from '../src/types/composer.ts';
import { PATHS } from './lib/paths.mts';
import { writeJson } from './lib/io.mts';
import { readRawExcel, readWorkbook, type Cell } from './lib/excel.mts';
import { isPlaceholder } from './lib/placeholders.mts';
import { cleanText } from './lib/text.mts';
import XLSX from 'xlsx';

const METHOD_SHEET = 'MÉTHODE IMAGE 10 BLOCS';
const EXTRA_PLACEHOLDERS = /^(n\/a|non applicable|non défini|non defini|non spécifié|neutre|format libre|à définir)$/i;
const useless = (v: unknown) => isPlaceholder(v) || EXTRA_PLACEHOLDERS.test(cleanText(v));

const { catalogue, texts } = readRawExcel(PATHS.excelFile);
const textById = new Map(texts.map((t) => [t.Texte_ID, t]));
const mainText = (row: { [k: string]: Cell }) => cleanText(textById.get(String(row['Texte principal_ID']))?.['Texte intégral']);

/**
 * `splitHint` : les techniques sont écrites « Terme : explication en français » ; seul le terme entre dans
 * le prompt, l'explication sert d'aide dans la liste.
 */
const option = (row: (typeof catalogue)[number], group?: string, splitHint = false): ComposerOption | undefined => {
  const label = cleanText(row['Titre']);
  const full = mainText(row);
  if (!label || !full) return undefined;
  const colon = splitHint ? full.indexOf(' : ') : -1;
  const text = colon > 0 ? full.slice(0, colon).trim() : full;
  const hint = colon > 0 ? full.slice(colon + 3).trim() : undefined;
  return { id: row.Entrée_ID, label, text, ...(hint ? { hint } : {}), ...(group ? { group } : {}) };
};
const byLabel = (a: ComposerOption, b: ComposerOption) => a.label.localeCompare(b.label, 'fr', { sensitivity: 'base' });

const styles: ComposerOption[] = [];
const lighting: ComposerOption[] = [];
const effects: ComposerOption[] = [];
const techniques: ComposerOption[] = []; // reste des lignes « Technique » : proposées avec les styles
const templates: ComposerOption[] = [];
for (const row of catalogue) {
  const type = cleanText(row['Type proposé']);
  if (type === 'Style') {
    const fam = cleanText(row['Famille proposée']);
    const o = option(row, isPlaceholder(fam) ? 'Autres' : fam);
    if (o) styles.push(o);
  } else if (type === 'Technique') {
    const kind = cleanText(row['Style détaillé']);
    const o = option(row, undefined, true);
    if (!o) continue;
    // Les lignes « Technique » non étiquetées dont le texte parle d'éclairage (« Flash lighting », « Dawn/Dusk lighting »…) vont en lumière.
    if (kind === 'Technique éclairage' || /light/i.test(o.text)) lighting.push(o);
    else if (kind === 'Concept de mouvement') effects.push(o);
    else techniques.push({ ...o, group: 'Techniques' });
  } else if (type === 'Template') {
    const o = option(row);
    if (o) templates.push(o);
  }
}

/** Termes fréquents d'une colonne (valeurs multiples séparées par des virgules), casse regroupée. */
function terms(col: string, split: boolean, min: number, limit: number): ComposerTerm[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const row of catalogue) {
    const raw = cleanText(row[col]);
    if (!raw) continue;
    for (const part of split ? raw.split(/[,;/]/) : [raw]) {
      const t = part.trim();
      if (!t || useless(t) || /^à définir/i.test(t)) continue;
      const key = t.toLowerCase();
      const cur = counts.get(key) ?? { label: t.charAt(0).toUpperCase() + t.slice(1), count: 0 };
      cur.count++;
      counts.set(key, cur);
    }
  }
  return [...counts.values()]
    .filter((t) => t.count >= min)
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'fr'))
    .slice(0, limit);
}

// Feuille de méthode : 10 blocs (lignes « n | Titre / English | consigne ») et contraintes négatives.
const wb = readWorkbook(PATHS.excelFile);
const rows = XLSX.utils.sheet_to_json<Cell[]>(wb.Sheets[METHOD_SHEET]!, { header: 1, defval: null });
const blocks: ComposerData['blocks'] = [];
const exclusions: ComposerOption[] = [];
let section = '';
for (const r of rows) {
  const first = cleanText(r[0]);
  if (/^\d\d \/ /.test(first)) {
    section = first;
    continue;
  }
  if (section.startsWith('01') && typeof r[0] === 'number' && r[1] && r[2]) {
    blocks.push({ n: r[0], label: cleanText(r[1]).split('/')[0]!.trim(), hint: cleanText(r[2]) });
  } else if (section.startsWith('04') && first && (r[1] || r[2])) {
    exclusions.push({ id: `excl-${exclusions.length + 1}`, label: first, text: cleanText(r[2] ?? r[1]) });
  }
}
if (blocks.length !== 10) throw new Error(`Feuille de méthode : ${blocks.length} blocs trouvés au lieu de 10 (structure modifiée ?)`);

const data: ComposerData = {
  source: 'Prompt Bible',
  blocks,
  styles: [...styles, ...techniques].sort((a, b) => (a.group ?? '').localeCompare(b.group ?? '', 'fr') || byLabel(a, b)),
  lighting: lighting.sort(byLabel),
  effects: effects.sort(byLabel),
  templates: templates.sort(byLabel),
  exclusions,
  moods: terms('Ambiance', true, 2, 40),
  eras: terms('Époque / contexte', false, 3, 20),
};
writeJson(path.join(PATHS.dataDir, 'composer.json'), data);
console.log(
  `Composeur : ${data.styles.length} styles, ${data.lighting.length} lumières, ${data.effects.length} effets, ` +
    `${data.templates.length} modèles, ${data.exclusions.length} groupes d'exclusions, ${data.moods.length} ambiances, ${data.eras.length} époques -> src/data/composer.json`,
);
