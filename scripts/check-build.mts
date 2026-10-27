/**
 * npm run check:build  (après npm run build)
 * Test du build de production : le dossier dist/ doit être publiable sur GitHub Pages et ne rien
 * embarquer de non public (fiches to-confirm / hidden, vue de revue, notes de revue, démo).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { PromptEntry } from '../src/types/library.ts';
import { PATHS } from './lib/paths.mts';
import { readJson } from './lib/io.mts';

const dist = path.join(PATHS.root, 'dist');
const errors: string[] = [];
const fail = (m: string) => errors.push(m);

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('dist/index.html absent : lancer npm run build.');
  process.exit(1);
}
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const base = process.env.BASE_PATH ?? './';
const refs = [...html.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]!);
for (const r of refs.filter((r) => !/^https?:/.test(r))) {
  if (!r.startsWith(base) ) fail(`Référence hors base « ${base} » : ${r}`);
  const file = path.join(dist, r.slice(base.length));
  if (!fs.existsSync(file)) fail(`Fichier référencé introuvable dans dist/ : ${r}`);
}
if (!refs.some((r) => r.endsWith('.js'))) fail('Aucun script JS référencé par index.html');

const js = walk(dist).filter((f) => f.endsWith('.js')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
const all = readJson<PromptEntry[]>(path.join(PATHS.dataDir, 'prompts.json'));
const privateEntries = all.filter((e) => e.status === 'to-confirm' || e.status === 'hidden');
for (const e of privateEntries) {
  if (js.includes(`"${e.id}"`) || (e.prompt.length > 20 && js.includes(JSON.stringify(e.prompt).slice(1, -1)))) fail(`Fiche non publique embarquée dans le build : ${e.id} (${e.status})`);
}
const publicCount = all.length - privateEntries.length;
if (publicCount > 0 && !js.includes(all.find((e) => e.status === 'to-test' || e.status === 'published')!.id)) fail('Les fiches publiques semblent absentes du build.');
for (const needle of ['reviewNotes', 'hiddenReason', 'Revue (dev)', 'duplicates-report']) {
  if (js.includes(needle)) fail(`Contenu réservé au développement présent dans le build : « ${needle} »`);
}
if (walk(dist).some((f) => /(^|[\\/])demo([\\/]|$)/i.test(path.relative(dist, f)))) fail('Dossier demo présent dans dist/');
const big = walk(dist).filter((f) => fs.statSync(f).size > 1_500_000);
big.forEach((f) => fail(`Fichier trop volumineux dans dist/ : ${path.relative(dist, f)}`));

if (errors.length) {
  console.error(`Build de production : ${errors.length} problème(s)\n${errors.map((e) => `  ✗ ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`Build de production OK (${walk(dist).length} fichiers, base « ${base} », ${privateEntries.length} fiche(s) non publique(s) exclue(s)).`);
