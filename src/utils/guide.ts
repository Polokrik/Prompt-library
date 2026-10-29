/**
 * Aide à l'usage d'un prompt : séparer le prompt de base de ses « précisions » ajoutées à l'import,
 * repérer les zones à remplir et détecter les prompts qui attendent une image fournie par l'utilisateur.
 * Rien n'est modifié dans les données : tout est calculé à l'affichage.
 */

const DETAIL_MARKER = /\n\s*\n(?=DIRECTION DÉTAILLÉE\b)/;

export interface SplitPrompt {
  /** Le prompt à copier par défaut. */
  base: string;
  /** Précisions optionnelles (bloc « DIRECTION DÉTAILLÉE ») ; absentes de la plupart des prompts courts. */
  detail?: string;
}

export function splitPrompt(prompt: string): SplitPrompt {
  const m = DETAIL_MARKER.exec(prompt);
  if (!m) return { base: prompt.trim() };
  return { base: prompt.slice(0, m.index).trim(), detail: prompt.slice(m.index + m[0].length).trim() };
}

export interface PromptField {
  /** Texte exact à remplacer dans le prompt (ex. « [SUBJECT] » ou « {argument name="x" default="y"} »). */
  token: string;
  /** Intitulé lisible du champ. */
  label: string;
  /** Valeur proposée par défaut (variables Raycast `{argument … default="…"}`). */
  defaultValue?: string;
}

const ARGUMENT = /\{argument\s+name\s*=\s*\\?"([^"\\]*)\\?"(?:\s+default\s*=\s*\\?"((?:[^"\\]|\\.)*?)\\?")?\s*\}/g;
const BRACKET = /\[([^\][{}"\n:]{2,60})\]/g;
/** Consigne adressée à l'IA, pas un champ pour l'utilisateur (« [AI inserts … ] »). */
const AI_INSTRUCTION = /^\s*(AI|IA)\b/i;

/** Champs à remplir, dans l'ordre d'apparition, sans doublon. */
export function findFields(text: string): PromptField[] {
  const found: { index: number; field: PromptField }[] = [];
  for (const m of text.matchAll(ARGUMENT)) {
    found.push({ index: m.index ?? 0, field: { token: m[0], label: m[1]!.trim(), defaultValue: m[2]?.replace(/\\"/g, '"') } });
  }
  for (const m of text.matchAll(BRACKET)) {
    const inner = m[1]!.trim();
    if (AI_INSTRUCTION.test(inner) || /^\d+$/.test(inner)) continue;
    found.push({ index: m.index ?? 0, field: { token: m[0], label: inner } });
  }
  found.sort((a, b) => a.index - b.index);
  const seen = new Set<string>();
  const out: PromptField[] = [];
  for (const { field } of found) {
    if (seen.has(field.token)) continue;
    seen.add(field.token);
    out.push(field);
  }
  return out;
}

/** Remplace les champs renseignés ; une variable Raycast vide reprend sa valeur par défaut ; un crochet vide reste tel quel. */
export function fillPrompt(text: string, fields: readonly PromptField[], values: Readonly<Record<string, string>>): string {
  let out = text;
  for (const f of fields) {
    const v = (values[f.token] ?? '').trim();
    const replacement = v || f.defaultValue;
    if (replacement !== undefined && replacement !== '') out = out.split(f.token).join(replacement);
  }
  return out;
}

/** Nombre de champs encore non renseignés (hors valeur par défaut), pour avertir avant de copier. */
export function unfilledCount(fields: readonly PromptField[], values: Readonly<Record<string, string>>): number {
  return fields.filter((f) => !(values[f.token] ?? '').trim() && f.defaultValue === undefined).length;
}

const REFERENCE_HINT =
  /\b(uploaded|upload(?:ed)? (?:a |an |the |your )?(?:photo|image|picture|selfie)|reference (?:image|photo|picture)|attached|my (?:face|photo|selfie)|this (?:photo|portrait|person|picture)|the (?:photo|image|portrait) (?:provided|above|attached)|selfie|image (?:jointe|fournie|de référence)|photo (?:jointe|fournie|de référence)|portrait (?:joint|fourni)|(?:ma|cette|la) photo)\b/i;

/** Le prompt semble attendre une image que l'utilisateur doit fournir (détection indicative, à confirmer à la lecture). */
export function mentionsReference(text: string): boolean {
  return REFERENCE_HINT.test(text);
}

/** Prompt court : peu de matière pour guider l'IA (le composeur peut l'étoffer). */
export const SHORT_PROMPT_CHARS = 200;
export function isShort(base: string): boolean {
  return base.length < SHORT_PROMPT_CHARS;
}
