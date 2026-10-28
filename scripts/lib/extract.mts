import { cleanText, safeUrl } from './text.mts';
import type { RawExternalEntry } from './normalize-external.mts';

/**
 * Heuristiques d'extraction pour la source externe. Aucun code trouvé dans la page n'est exécuté :
 * on ne fait que lire du JSON (balises <script type="application/json">, littéraux JSON assignés
 * dans du JavaScript, fichiers .json). Un littéral JavaScript non JSON est signalé, pas évalué.
 */

export interface CandidateArray {
  path: string;
  items: Record<string, unknown>[];
  score: number;
  keys: string[];
}

export type FieldName = 'originalId' | 'title' | 'prompt' | 'categories' | 'tags' | 'imageUrl' | 'pageUrl' | 'language' | 'alt';
export type FieldMap = Partial<Record<FieldName, string>>;

const ALIASES: Record<FieldName, string[]> = {
  originalId: ['id', 'slug', 'uid', 'key', 'identifier', 'ref'],
  title: ['title', 'titre', 'name', 'nom', 'label', 'libelle'],
  prompt: ['prompt', 'prompttext', 'promptfr', 'texte', 'text', 'content', 'contenu', 'description'],
  categories: ['categories', 'category', 'categorie', 'cat', 'cats', 'type', 'theme', 'themes'],
  tags: ['tags', 'tag', 'keywords', 'motscles', 'mots', 'labels'],
  imageUrl: ['image', 'imageurl', 'img', 'src', 'thumbnail', 'thumb', 'photo', 'picture', 'visual', 'visuel', 'file', 'fichier'],
  pageUrl: ['url', 'link', 'href', 'permalink', 'page'],
  language: ['lang', 'language', 'langue'],
  alt: ['alt', 'alttext', 'alt_text', 'imagealt', 'caption', 'legende'],
};

const norm = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '');

export function guessFieldMap(keys: string[]): FieldMap {
  const map: FieldMap = {};
  const taken = new Set<string>();
  for (const field of Object.keys(ALIASES) as FieldName[]) {
    for (const alias of ALIASES[field]) {
      const hit = keys.find((k) => norm(k) === norm(alias) && !taken.has(k));
      if (hit) {
        map[field] = hit;
        taken.add(hit);
        break;
      }
    }
  }
  return map;
}

function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const part of path.split('.')) {
    if (cur && typeof cur === 'object') cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return cur;
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Tableaux d'objets qui ressemblent à un catalogue de prompts illustrés. */
export function findCandidateArrays(value: unknown, path = '$', depth = 0, out: CandidateArray[] = []): CandidateArray[] {
  if (depth > 6) return out;
  if (Array.isArray(value)) {
    const objs = value.filter(isObject);
    if (objs.length >= 5 && objs.length >= value.length * 0.9) {
      const keys = [...new Set(objs.flatMap((o) => Object.keys(o)))];
      const map = guessFieldMap(keys);
      const score = (map.prompt ? 3 : 0) + (map.imageUrl ? 2 : 0) + (map.title ? 1 : 0) + (map.categories ? 1 : 0) + Math.min(objs.length / 100, 2);
      if (map.prompt || map.imageUrl) out.push({ path, items: objs, score, keys });
    }
    value.slice(0, 50).forEach((v, i) => findCandidateArrays(v, `${path}[${i}]`, depth + 1, out));
  } else if (isObject(value)) {
    for (const [k, v] of Object.entries(value)) findCandidateArrays(v, `${path}.${k}`, depth + 1, out);
  }
  return out;
}

/** Extrait des blobs JSON d'un texte HTML/JS sans rien évaluer. */
export function extractJsonBlobs(text: string, maxBlobs = 40): unknown[] {
  const blobs: unknown[] = [];
  // 1. <script type="application/json|ld+json"> ... </script>
  const scriptRe = /<script[^>]*type=["']application\/(?:ld\+)?json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of text.matchAll(scriptRe)) {
    try {
      blobs.push(JSON.parse(m[1]!));
    } catch {
      /* ignoré : signalé par l'appelant s'il ne trouve rien */
    }
  }
  // 2. littéraux JSON assignés ou passés en argument dans du JS
  const startRe = /[=:(,]\s*([[{])/g;
  let m: RegExpExecArray | null;
  let guard = 0;
  while ((m = startRe.exec(text)) && blobs.length < maxBlobs && guard++ < 5000) {
    const start = m.index + m[0].length - 1;
    const end = scanBalanced(text, start);
    if (end < 0) continue;
    const slice = text.slice(start, end + 1);
    if (slice.length < 200) continue;
    try {
      blobs.push(JSON.parse(slice));
      startRe.lastIndex = end + 1;
    } catch {
      /* littéral JS non JSON : on ne l'évalue jamais */
    }
  }
  return blobs;
}

function scanBalanced(text: string, start: number): number {
  const open = text[start];
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr: string | null = null;
  const limit = Math.min(text.length, start + 4_000_000);
  for (let i = start; i < limit; i++) {
    const c = text[i]!;
    if (inStr) {
      if (c === '\\') i++;
      else if (c === inStr) inStr = null;
      continue;
    }
    if (c === '"' || c === "'" || c === '`') inStr = c;
    else if (c === open) depth++;
    else if (c === close && --depth === 0) return i;
  }
  return -1;
}

export function bestCandidate(blobs: unknown[]): CandidateArray | undefined {
  return blobs
    .flatMap((b) => findCandidateArrays(b))
    .sort((a, b) => b.score - a.score || b.items.length - a.items.length)[0];
}

function asText(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function asStringOrList(value: unknown): string | string[] | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const out = value
      .map((v) => (typeof v === 'string' ? v : isObject(v) ? asText(v.name ?? v.title ?? v.label) : undefined))
      .filter((v): v is string => !!v);
    return out;
  }
  if (isObject(value)) return asText(value.name ?? value.title ?? value.label);
  return undefined;
}

function asUrl(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (isObject(value)) return asText(value.url ?? value.src ?? value.large ?? value.full);
  if (Array.isArray(value)) return asUrl(value[0]);
  return undefined;
}

/** Objet source -> entrée brute : valeurs copiées telles quelles, champs absents omis. */
export function toRawEntry(obj: Record<string, unknown>, order: number, map: FieldMap): RawExternalEntry {
  const pick = (f: FieldName) => (map[f] ? getPath(obj, map[f]!) : undefined);
  const entry: RawExternalEntry = { order, original: obj };
  const id = asText(pick('originalId'));
  const title = asText(pick('title'));
  const prompt = asText(pick('prompt'));
  const categories = asStringOrList(pick('categories'));
  const tags = asStringOrList(pick('tags'));
  const imageUrl = asUrl(pick('imageUrl'));
  const pageUrl = asText(pick('pageUrl'));
  const language = asText(pick('language'));
  const alt = asText(pick('alt'));
  if (id !== undefined) entry.originalId = id;
  if (title !== undefined) entry.title = title;
  if (prompt !== undefined) entry.prompt = prompt;
  if (categories !== undefined) entry.categories = categories;
  if (tags !== undefined) entry.tags = tags;
  if (imageUrl !== undefined) entry.imageUrl = imageUrl;
  if (pageUrl !== undefined) entry.pageUrl = pageUrl;
  if (language !== undefined) entry.language = language;
  if (alt !== undefined) entry.alt = alt;
  return entry;
}

export interface HtmlLinks {
  scripts: string[];
  stylesheets: string[];
  jsonLinks: string[];
  images: string[];
  anchors: string[];
}

function attrs(html: string, tag: string, attr: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*?\\s${attr}\\s*=\\s*["']([^"']+)["']`, 'gi');
  return [...html.matchAll(re)].map((m) => m[1]!);
}

export function listLinks(html: string, base: string): HtmlLinks {
  const abs = (list: string[]) => [...new Set(list.map((u) => safeUrl(u, base)).filter((u): u is string => !!u))];
  const anchors = abs(attrs(html, 'a', 'href'));
  const links = abs(attrs(html, 'link', 'href'));
  return {
    scripts: abs(attrs(html, 'script', 'src')),
    stylesheets: links.filter((u) => /\.css(\?|$)/i.test(u)),
    jsonLinks: [...new Set([...links, ...anchors].filter((u) => /\.json(\?|$)/i.test(u)))],
    images: abs(attrs(html, 'img', 'src')),
    anchors,
  };
}

export function imageExtension(url: string): string {
  try {
    const m = /\.([a-z0-9]{2,5})$/i.exec(new URL(url).pathname);
    return m ? m[1]!.toLowerCase() : '(sans extension)';
  } catch {
    return '(inconnu)';
  }
}

export function summarizeCandidate(c: CandidateArray, map: FieldMap) {
  const fields = Object.keys(ALIASES) as FieldName[];
  const present = fields.filter((f) => map[f]);
  const absent = fields.filter((f) => !map[f]);
  const unmapped = c.keys.filter((k) => !Object.values(map).includes(k));
  const cats = new Set<string>();
  if (map.categories) {
    for (const it of c.items) {
      const v = asStringOrList(getPath(it, map.categories));
      for (const x of Array.isArray(v) ? v : v ? [v] : []) cats.add(cleanText(x));
    }
  }
  const imageExt: Record<string, number> = {};
  if (map.imageUrl) {
    for (const it of c.items) {
      const u = asUrl(getPath(it, map.imageUrl));
      if (u) imageExt[imageExtension(u)] = (imageExt[imageExtension(u)] ?? 0) + 1;
    }
  }
  return { present, absent, unmapped, categories: [...cats].sort().slice(0, 100), imageExt };
}

/** Aperçu lisible de la forme d'un JSON : clés, types, longueurs et un exemple (textes tronqués). */
export function describeShape(value: unknown, depth = 0): unknown {
  const clip = (t: string) => (t.length > 160 ? `${t.slice(0, 157)}…` : t);
  if (typeof value === 'string') return clip(value);
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return { _type: 'array', length: value.length, sample: depth < 3 && value.length ? describeShape(value[0], depth + 1) : undefined };
  }
  if (depth >= 3) return { _type: 'object', keys: Object.keys(value as object).slice(0, 30) };
  return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([k, v]) => [k, describeShape(v, depth + 1)]));
}

/** Adresses passées à fetch('…') dans un texte (HTML ou JavaScript), littéraux uniquement. */
export function fetchTargets(text: string): string[] {
  return [...new Set([...text.matchAll(/fetch\(\s*['"`]([^'"`]+)['"`]/g)].map((m) => m[1]!))];
}
