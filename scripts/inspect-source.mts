/**
 * npm run inspect:source
 * Inspection technique (lecture seule) de la page source. Aucun scraping complet :
 * on lit la page, ses scripts et fichiers JSON du même domaine (14 fichiers max), on cherche où
 * se trouvent les données, puis on écrit imports/external/source.json et reports/source-inspection.md.
 * Aucun contournement : robots.txt est respecté, un refus (403, 429…) est simplement rapporté.
 */
import path from 'node:path';
import { PATHS } from './lib/paths.mts';
import { rel, writeJson, writeText } from './lib/io.mts';
import { FetchError, fetchLimited, sleep } from './lib/net.mts';
import {
  bestCandidate,
  describeShape,
  extractJsonBlobs,
  fetchTargets,
  guessFieldMap,
  refineFieldMap,
  listLinks,
  summarizeCandidate,
  type CandidateArray,
  type FieldMap,
} from './lib/extract.mts';
import { safeUrl } from './lib/text.mts';

const SOURCE_URL = 'https://vincentflibustier.com/imageia/#bibliotheque';
const MAX_FILES = 14;

interface SourceFile {
  note: string;
  inspectedAt: string;
  inspectedUrl: string;
  reachable: boolean;
  robots: { checked: boolean; allowed: boolean | null; detail: string };
  strategy: 'embedded-json' | 'json-endpoint' | 'none-found' | 'unreachable' | 'blocked-by-robots';
  dataLocation?: { url: string; kind: 'json' | 'embedded'; candidatePath: string; items: number };
  fieldMap: FieldMap;
  fieldsAvailable: string[];
  fieldsAbsent: string[];
  unmappedKeys: string[];
  imageTypes: Record<string, number>;
  categories: string[];
  filesInspected: { url: string; status: number; bytes: number; contentType: string }[];
  linksFound: { scripts: number; jsonLinks: number; images: number; secondaryPages: string[] };
  shapes: { url: string; shape: unknown }[];
  obstacles: string[];
  recommendedMethod: string;
  localInstructions: string[];
}

function robotsAllows(robotsTxt: string, pathname: string): boolean {
  let applies = false;
  let allowed = true;
  let longest = -1;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const [k, ...rest] = line.split(':');
    const v = rest.join(':').trim();
    if (!k) continue;
    if (/^user-agent$/i.test(k)) applies = v === '*';
    else if (applies && /^(dis)?allow$/i.test(k) && v && pathname.startsWith(v) && v.length > longest) {
      longest = v.length;
      allowed = /^allow$/i.test(k);
    }
  }
  return allowed;
}

const LOCAL_INSTRUCTIONS = [
  'Depuis une machine qui peut joindre vincentflibustier.com : `npm ci` puis `npm run inspect:source`.',
  'Vérifier imports/external/source.json (strategy, dataLocation, fieldMap) et reports/source-inspection.md.',
  'Si strategy = "none-found" : ouvrir la page dans un navigateur, onglet Réseau, repérer l’appel JSON du catalogue, puis renseigner `dataLocation` et `fieldMap` à la main dans source.json (kind = "json", url = l’adresse relevée).',
  'Puis `npm run import:external:sample` (30 entrées max + leurs images) et `npm run refresh`.',
  'Dépendances : Node ≥ 22.21 (aucune autre que celles de package.json).',
];

async function main() {
  const inspectedAt = new Date().toISOString();
  const pageUrl = safeUrl(SOURCE_URL)!;
  const base = pageUrl.split('#')[0]!;
  const origin = new URL(base).origin;
  const out: SourceFile = {
    note: 'Fichier généré par npm run inspect:source. `fieldMap` et `dataLocation` peuvent être corrigés à la main.',
    inspectedAt,
    inspectedUrl: SOURCE_URL,
    reachable: false,
    robots: { checked: false, allowed: null, detail: '' },
    strategy: 'unreachable',
    fieldMap: {},
    fieldsAvailable: [],
    fieldsAbsent: [],
    unmappedKeys: [],
    imageTypes: {},
    categories: [],
    filesInspected: [],
    linksFound: { scripts: 0, jsonLinks: 0, images: 0, secondaryPages: [] },
    shapes: [],
    obstacles: [],
    recommendedMethod: '',
    localInstructions: LOCAL_INSTRUCTIONS,
  };

  const finish = () => {
    writeJson(PATHS.externalSource, out);
    writeText(path.join(PATHS.reports, 'source-inspection.md'), toMarkdown(out));
    console.log(`Stratégie : ${out.strategy}`);
    out.obstacles.forEach((o) => console.log(`  ! ${o}`));
    console.log(`Écrit : ${rel(PATHS.externalSource, PATHS.root)} et reports/source-inspection.md`);
  };

  // 1. robots.txt
  try {
    const r = await fetchLimited(`${origin}/robots.txt`, { timeoutMs: 10_000, maxBytes: 200_000 });
    out.robots.checked = true;
    if (r.ok) {
      out.robots.allowed = robotsAllows(r.body.toString('utf8'), new URL(base).pathname);
      out.robots.detail = out.robots.allowed ? 'Chemin autorisé pour User-agent: *' : 'Chemin interdit par robots.txt';
    } else {
      out.robots.detail = `robots.txt : HTTP ${r.status} (aucune règle applicable)`;
      out.robots.allowed = true;
    }
  } catch (e) {
    out.robots.detail = `robots.txt illisible : ${(e as Error).message}`;
  }
  if (out.robots.allowed === false) {
    out.strategy = 'blocked-by-robots';
    out.obstacles.push('robots.txt interdit ce chemin : aucune requête supplémentaire n’est faite.');
    out.recommendedMethod = 'Ne pas importer automatiquement. Demander l’accord de l’auteur ou saisir manuellement.';
    return finish();
  }

  // 2. page principale
  let html = '';
  try {
    const page = await fetchLimited(base, { maxBytes: 3_000_000, accept: 'text/html' });
    out.filesInspected.push({ url: page.url, status: page.status, bytes: page.body.length, contentType: page.contentType });
    if (!page.ok) {
      out.obstacles.push(`La page renvoie HTTP ${page.status}.`);
      out.recommendedMethod = 'Exécuter l’inspection depuis une machine ayant accès au site (voir localInstructions).';
      return finish();
    }
    html = page.body.toString('utf8');
    out.reachable = true;
  } catch (e) {
    out.obstacles.push(`Page inaccessible depuis cet environnement : ${(e as Error).message}`);
    if (e instanceof FetchError && /403|CONNECT/.test(e.message)) {
      out.obstacles.push('Un refus de tunnel/403 indique une restriction réseau (liste d’hôtes autorisés) : ne pas contourner.');
    }
    out.recommendedMethod =
      'Relancer `npm run inspect:source` depuis un poste ayant accès au site, ou autoriser le domaine dans la politique réseau de l’environnement. Voir localInstructions.';
    return finish();
  }

  // 3. fichiers liés (même origine uniquement)
  const links = listLinks(html, base);
  const sameOrigin = (u: string) => new URL(u).origin === origin;
  out.linksFound = {
    scripts: links.scripts.length,
    jsonLinks: links.jsonLinks.length,
    images: links.images.length,
    secondaryPages: links.anchors.filter((u) => sameOrigin(u) && !/\.(png|jpe?g|webp|gif|svg|css|js|json)(\?|$)/i.test(u)).slice(0, 25),
  };
  const texts: { url: string; kind: 'json' | 'embedded'; blobs: unknown[] }[] = [
    { url: base, kind: 'embedded', blobs: extractJsonBlobs(html) },
  ];
  const rawTexts: string[] = [html];
  for (const u of [...links.jsonLinks, ...links.scripts].filter(sameOrigin).slice(0, MAX_FILES)) {
    await sleep(300);
    try {
      const r = await fetchLimited(u, { maxBytes: 6_000_000 });
      out.filesInspected.push({ url: r.url, status: r.status, bytes: r.body.length, contentType: r.contentType });
      if (!r.ok) continue;
      const text = r.body.toString('utf8');
      if (/\.json(\?|$)/i.test(u) || /json/.test(r.contentType)) {
        try {
          texts.push({ url: u, kind: 'json', blobs: [JSON.parse(text)] });
        } catch {
          out.obstacles.push(`JSON invalide : ${u}`);
        }
      } else {
        texts.push({ url: u, kind: 'embedded', blobs: extractJsonBlobs(text) });
        rawTexts.push(text);
      }
    } catch (e) {
      out.obstacles.push((e as Error).message);
    }
  }

  // 3 bis. appels fetch('…') écrits dans la page ou ses scripts (adresses relatives résolues par rapport à la page)
  const targets = [...new Set(rawTexts.flatMap(fetchTargets).map((t) => safeUrl(t, base)).filter((u): u is string => !!u && sameOrigin(u)))].slice(0, 6);
  for (const u of targets) {
    await sleep(300);
    try {
      const r = await fetchLimited(u, { maxBytes: 30 * 1024 * 1024, accept: 'application/json' });
      out.filesInspected.push({ url: r.url, status: r.status, bytes: r.body.length, contentType: r.contentType });
      if (!r.ok) {
        out.obstacles.push(`HTTP ${r.status} : ${u}`);
        continue;
      }
      const json: unknown = JSON.parse(r.body.toString('utf8'));
      texts.push({ url: u, kind: 'json', blobs: [json] });
      out.shapes.push({ url: u, shape: describeShape(json) });
    } catch (e) {
      out.obstacles.push(`Appel fetch non lisible (${u}) : ${(e as Error).message}`);
    }
  }

  // 4. meilleur candidat
  let best: { c: CandidateArray; url: string; kind: 'json' | 'embedded' } | undefined;
  for (const t of texts) {
    const c = bestCandidate(t.blobs);
    if (c && (!best || c.score > best.c.score)) best = { c, url: t.url, kind: t.kind };
  }
  if (!best) {
    out.strategy = 'none-found';
    out.obstacles.push(
      'Aucun tableau de données exploitable trouvé dans le HTML, les scripts ou les JSON du même domaine (les données sont peut-être construites côté client à partir d’un littéral JavaScript non JSON, ou chargées d’un autre domaine).',
    );
    out.recommendedMethod =
      'Relever l’appel de données dans l’onglet Réseau du navigateur et renseigner dataLocation + fieldMap dans source.json ; sinon, saisir un export manuel en JSON dans imports/external/raw/.';
    return finish();
  }
  const fieldMap = refineFieldMap(guessFieldMap(best.c.keys), best.c.items);
  const sum = summarizeCandidate(best.c, fieldMap);
  out.strategy = best.kind === 'json' ? 'json-endpoint' : 'embedded-json';
  out.dataLocation = { url: best.url, kind: best.kind, candidatePath: best.c.path, items: best.c.items.length };
  out.fieldMap = fieldMap;
  out.fieldsAvailable = sum.present;
  out.fieldsAbsent = sum.absent;
  out.unmappedKeys = sum.unmapped;
  out.imageTypes = sum.imageExt;
  out.categories = sum.categories;
  out.recommendedMethod =
    `Import direct depuis ${best.url} (${best.kind === 'json' ? 'fichier JSON' : 'données incorporées'}), ${best.c.items.length} entrées. ` +
    'Vérifier fieldMap, puis `npm run import:external:sample`.';
  finish();
}

function toMarkdown(s: SourceFile): string {
  const li = (a: string[]) => (a.length ? a.map((x) => `- ${x}`).join('\n') : '- (aucun)');
  return [
    '# Inspection de la source externe',
    '',
    `- Date d’inspection : ${s.inspectedAt}`,
    `- URL inspectée : ${s.inspectedUrl}`,
    `- Accessible depuis l’environnement : ${s.reachable ? 'oui' : 'non'}`,
    `- robots.txt : ${s.robots.detail || 'non vérifié'}`,
    `- Stratégie technique : **${s.strategy}**`,
    s.dataLocation ? `- Données : ${s.dataLocation.url} (${s.dataLocation.kind}, ${s.dataLocation.items} entrées, chemin ${s.dataLocation.candidatePath})` : '',
    '',
    '## Champs',
    `Disponibles : ${s.fieldsAvailable.join(', ') || '—'}`,
    '',
    `Absents : ${s.fieldsAbsent.join(', ') || '—'}`,
    '',
    `Clés non utilisées : ${s.unmappedKeys.join(', ') || '—'}`,
    '',
    '## Images',
    Object.entries(s.imageTypes).map(([k, v]) => `- .${k} : ${v}`).join('\n') || '- (aucune image détectée)',
    '',
    '## Catégories détectées',
    s.categories.join(', ') || '—',
    '',
    '## Fichiers inspectés',
    s.filesInspected.map((f) => `- ${f.url} — HTTP ${f.status}, ${f.bytes} octets`).join('\n') || '- (aucun)',
    '',
    '## Forme des données récupérées (appels fetch)',
    s.shapes.map((x) => `### ${x.url}\n\n\`\`\`json\n${JSON.stringify(x.shape, null, 2)}\n\`\`\``).join('\n\n') || '- (aucun)',
    '',
    '## Obstacles',
    li(s.obstacles),
    '',
    '## Méthode recommandée',
    s.recommendedMethod,
    '',
    '## Procédure locale',
    li(s.localInstructions),
    '',
  ].join('\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
