/**
 * npm run a11y
 * Contrôle automatisé raisonnable (axe-core, règles WCAG 2.0/2.1/2.2 A et AA) sur le build local.
 * Prérequis : `npm run build` ; un Chromium pour Playwright (`npx playwright install chromium`,
 * ou CHROMIUM_PATH=/chemin/vers/chromium). Échoue si axe détecte une violation.
 * Un contrôle automatique ne remplace pas un test au clavier et au lecteur d'écran.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { chromium } from 'playwright';
import { PATHS } from './lib/paths.mts';
import { writeJson } from './lib/io.mts';

const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const PORT = 4179;
// Le build peut être servi sous un sous-chemin (BASE_PATH=/nom-du-repo/ sur GitHub Pages).
const BASE_PATH = process.env.BASE_PATH?.startsWith('/') ? process.env.BASE_PATH : '/';
const BASE = `http://127.0.0.1:${PORT}${BASE_PATH}`;

async function waitFor(url: string, tries = 40) {
  for (let i = 0; i < tries; i++) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      /* serveur pas encore prêt */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Serveur de prévisualisation injoignable : ${url}`);
}

async function main() {
  if (!fs.existsSync(path.join(PATHS.root, 'dist', 'index.html'))) throw new Error('dist/ absent : lancer npm run build.');
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: PATHS.root,
    stdio: 'ignore',
  });
  try {
    await waitFor(BASE);
    const publicFile = path.join(PATHS.dataDir, 'prompts.public.json');
    const first = (JSON.parse(fs.readFileSync(publicFile, 'utf8')) as { id: string }[])[0]?.id;
    const routes = ['#/', '#/bibliotheque', '#/bibliotheque?q=photo', '#/favoris', '#/a-propos', '#/composeur', ...(first ? [`#/composeur?from=${first}`] : []), ...(first ? [`#/fiche/${first}`] : []), '#/fiche/ext-103', '#/fiche/ENT-VNHZB48D'];
    const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
    const results: { route: string; scheme: string; viewport: string; violations: unknown[] }[] = [];
    for (const scheme of ['light', 'dark'] as const) {
      for (const viewport of [{ name: 'mobile', width: 375, height: 800 }, { name: 'desktop', width: 1280, height: 900 }]) {
        // Contexte vierge : la fenêtre de choix du niveau d'aide s'ouvre (contrôlée par axe) ; le thème sombre
        // reprend avec le niveau « Je découvre » déjà choisi, ce qui affiche le cadre rapide.
        const ctx = await browser.newContext({ colorScheme: scheme, viewport });
        if (scheme === 'dark') await ctx.addInitScript(() => window.localStorage.setItem('carnet.helpLevel', 'beginner'));
        const page = await ctx.newPage();
        for (const route of routes) {
          await page.goto(`${BASE}${route}`);
          await page.waitForSelector('main');
          await page.addScriptTag({ content: axeSource });
          const out = await page.evaluate(async () => {
            // @ts-expect-error axe est injecté dans la page
            const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] } });
            return r.violations.map((v: { id: string; impact: string; help: string; nodes: { target: unknown[] }[] }) => ({
              id: v.id,
              impact: v.impact,
              help: v.help,
              nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ')),
            }));
          });
          results.push({ route, scheme, viewport: viewport.name, violations: out });
        }
        await ctx.close();
      }
    }
    await browser.close();
    writeJson(path.join(PATHS.reports, 'a11y-report.json'), { generatedAt: new Date().toISOString(), results });
    const bad = results.filter((r) => r.violations.length);
    console.log(`Accessibilité : ${results.length} contrôles (${routes.length} pages × thèmes × tailles), ${bad.length} avec violation(s).`);
    for (const r of bad) console.log(`  ✗ ${r.route} [${r.scheme}/${r.viewport}] ${JSON.stringify(r.violations)}`);
    if (bad.length) process.exitCode = 1;
  } finally {
    server.kill();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
