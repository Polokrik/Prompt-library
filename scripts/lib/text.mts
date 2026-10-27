import { createHash } from 'node:crypto';

/**
 * Nettoyage non destructif : fins de ligne unifiées, espaces de fin de ligne retirés,
 * lignes vides consécutives limitées à une, caractères de contrôle et espaces insécables
 * de bord retirés. Le contenu textuel et les retours à la ligne utiles sont conservés.
 */
export function cleanText(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F​﻿]/g, '')
    .replace(/[ \t ]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Texte pour comparaison de doublons : casse, accents, ponctuation et espaces neutralisés. */
export function comparable(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function sha1(text: string): string {
  return createHash('sha1').update(text).digest('hex');
}

/** Nom de fichier sûr : jamais de séparateur, de point initial ni de traversée de répertoire. */
export function safeFileStem(id: string): string {
  const stem = id.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+/, '').replace(/\.{2,}/g, '.');
  if (!stem) throw new Error(`Identifiant inutilisable comme nom de fichier : "${id}"`);
  return stem;
}

export function splitMulti(value: unknown, separators = /[;|]/): string[] {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean);
  const text = cleanText(value);
  return text ? text.split(separators).map((s) => s.trim()).filter(Boolean) : [];
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

/** Repère les caractères problématiques (remplacement Unicode, balises HTML, mojibake courant). */
export function textProblems(text: string): string[] {
  const out: string[] = [];
  if (text.includes('�')) out.push('caractère de remplacement Unicode (�)');
  if (/<\/?[a-z][\s\S]*?>/i.test(text)) out.push('balises HTML présentes');
  if (/Ã[\u0080-¿]|â€/.test(text)) out.push('encodage suspect (mojibake)');
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text)) out.push('caractères de contrôle');
  return out;
}

/** Neutralise le HTML d'une valeur importée (le texte reste lisible, jamais interprété). */
export function stripHtml(text: string): string {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

const SAFE_PROTOCOLS = new Set(['http:', 'https:']);

/** Renvoie l'URL normalisée si elle est http(s) valide, sinon undefined. Ne complète rien. */
export function safeUrl(value: unknown, base?: string): string | undefined {
  const text = cleanText(value);
  if (!text) return undefined;
  try {
    const url = new URL(text, base);
    if (!SAFE_PROTOCOLS.has(url.protocol)) return undefined;
    url.hash = url.hash === '#' ? '' : url.hash;
    return url.toString();
  } catch {
    return undefined;
  }
}
