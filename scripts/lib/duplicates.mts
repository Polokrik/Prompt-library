import type { DuplicateCandidate, PromptEntry, PromptStatus } from '../../src/types/library.ts';
import { comparable } from './text.mts';

export const NEAR_THRESHOLD = 0.85;
export const VARIANT_THRESHOLD = 0.7;
const MIN_TOKENS_FOR_SIMILARITY = 5;

const RANK: Record<PromptStatus, number> = { published: 3, 'to-test': 2, 'to-confirm': 1, hidden: 0 };

/**
 * Règle du candidat canonique d'un groupe de doublons exacts (déterministe) :
 * 1. une décision éditoriale : une fiche du groupe désignée par `canonicalId` d'une autre ;
 * 2. statut le plus avancé (published > to-test > to-confirm) ;
 * 3. présence d'une image ;
 * 4. nombre de catégories + tags ;
 * 5. identifiant le plus petit (ordre alphabétique).
 */
export function pickCanonical(group: PromptEntry[]): PromptEntry {
  const ids = new Set(group.map((e) => e.id));
  const designated = group.find((e) => e.canonicalId && ids.has(e.canonicalId))?.canonicalId;
  if (designated) return group.find((e) => e.id === designated)!;
  return [...group].sort(
    (a, b) =>
      RANK[b.status] - RANK[a.status] ||
      Number(!!b.image) - Number(!!a.image) ||
      b.categories.length + b.tags.length - (a.categories.length + a.tags.length) ||
      a.id.localeCompare(b.id),
  )[0]!;
}

function excerpt(e: PromptEntry) {
  const t = e.prompt.replace(/\s+/g, ' ');
  return { id: e.id, text: t.length > 160 ? `${t.slice(0, 157)}…` : t };
}

function tokenSet(text: string): Set<string> {
  const c = comparable(text);
  return new Set(c ? c.split(' ') : []);
}

export function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  const [small, big] = a.size < b.size ? [a, b] : [b, a];
  for (const t of small) if (big.has(t)) inter++;
  return inter / (a.size + b.size - inter);
}

/**
 * Détection des doublons. Rien n'est supprimé ni fusionné : chaque candidat est un constat
 * assorti d'une suggestion. `imageKey` renvoie une empreinte d'image (ou undefined).
 */
export function detectDuplicates(
  all: readonly PromptEntry[],
  imageKey: (e: PromptEntry) => string | undefined = () => undefined,
): DuplicateCandidate[] {
  const entries = all.filter((e) => e.status !== 'hidden' && e.prompt.trim());
  const out: DuplicateCandidate[] = [];
  const exactPairs = new Set<string>();
  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

  // 1 & 4. Même prompt (texte comparable identique)
  const byPrompt = new Map<string, PromptEntry[]>();
  for (const e of entries) {
    const key = comparable(e.prompt);
    if (!key) continue;
    byPrompt.set(key, [...(byPrompt.get(key) ?? []), e]);
  }
  for (const group of byPrompt.values()) {
    if (group.length < 2) continue;
    for (let i = 0; i < group.length; i++)
      for (let j = i + 1; j < group.length; j++) exactPairs.add(pairKey(group[i]!.id, group[j]!.id));
    const keys = group.map(imageKey);
    const allWithImage = keys.every((k) => k !== undefined);
    const distinctImages = allWithImage && new Set(keys).size === group.length;
    if (distinctImages) {
      out.push({
        type: 'same-prompt-different-image',
        ids: group.map((e) => e.id),
        reason: 'Prompt identique, images différentes',
        excerpts: group.map(excerpt),
        suggestion: 'Probablement deux résultats du même prompt : garder les deux, ou en faire des variantes d’une fiche.',
      });
      continue;
    }
    const canonical = pickCanonical(group);
    out.push({
      type: 'exact',
      ids: group.map((e) => e.id),
      reason: 'Prompt identique (casse, accents, ponctuation et espaces ignorés)',
      excerpts: group.map(excerpt),
      canonicalId: canonical.id,
      suggestion: `Conserver « ${canonical.id} » ; pour les autres, ajouter { "canonicalId": "${canonical.id}", "status": "hidden" } dans le mapping, ou les garder comme variantes.`,
    });
  }

  // 3. Même image, prompts différents
  const byImage = new Map<string, PromptEntry[]>();
  for (const e of entries) {
    const k = imageKey(e);
    if (k) byImage.set(k, [...(byImage.get(k) ?? []), e]);
  }
  for (const group of byImage.values()) {
    if (group.length < 2) continue;
    if (new Set(group.map((e) => comparable(e.prompt))).size < 2) continue;
    out.push({
      type: 'same-image-different-prompt',
      ids: group.map((e) => e.id),
      reason: 'Même image associée à des prompts différents',
      excerpts: group.map(excerpt),
      suggestion: 'Vérifier l’association image/prompt ; si c’est la même fiche, fusionner via canonicalId.',
    });
  }

  // 2 & 5. Textes proches, variantes probables
  const sets = entries.map((e) => tokenSet(e.prompt));
  const variantTexts = entries.map((e) => new Set(e.variants.map((v) => comparable(v.prompt))));
  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i]!;
      const b = entries[j]!;
      if (exactPairs.has(pairKey(a.id, b.id))) continue;
      const aInB = variantTexts[j]!.has(comparable(a.prompt));
      const bInA = variantTexts[i]!.has(comparable(b.prompt));
      if (aInB || bInA) {
        out.push({
          type: 'probable-variant',
          ids: [a.id, b.id],
          reason: 'Le prompt d’une fiche est une variante de l’autre',
          excerpts: [excerpt(a), excerpt(b)],
          suggestion: 'Regrouper en une fiche avec variantes (canonicalId sur la fiche secondaire).',
        });
        continue;
      }
      const sa = sets[i]!;
      const sb = sets[j]!;
      if (sa.size < MIN_TOKENS_FOR_SIMILARITY || sb.size < MIN_TOKENS_FOR_SIMILARITY) continue;
      if (Math.min(sa.size, sb.size) / Math.max(sa.size, sb.size) < VARIANT_THRESHOLD) continue;
      const score = jaccard(sa, sb);
      if (score >= NEAR_THRESHOLD) {
        out.push({
          type: 'near',
          ids: [a.id, b.id],
          score: Number(score.toFixed(3)),
          reason: `Textes très proches (similarité ${score.toFixed(2)})`,
          excerpts: [excerpt(a), excerpt(b)],
          suggestion: 'Comparer à la main ; aucune fusion automatique.',
        });
      } else if (score >= VARIANT_THRESHOLD) {
        out.push({
          type: 'probable-variant',
          ids: [a.id, b.id],
          score: Number(score.toFixed(3)),
          reason: `Formulations voisines (similarité ${score.toFixed(2)})`,
          excerpts: [excerpt(a), excerpt(b)],
          suggestion: 'Possible variante d’une même idée ; à regrouper si pertinent.',
        });
      }
    }
  }
  return out;
}

/** Fiches visibles qui sont, dans un groupe exact, autre chose que la fiche canonique. */
export function untreatedExactDuplicates(
  entries: readonly PromptEntry[],
  candidates: readonly DuplicateCandidate[],
): { id: string; canonicalId: string }[] {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const out: { id: string; canonicalId: string }[] = [];
  for (const c of candidates) {
    if (c.type !== 'exact' || !c.canonicalId) continue;
    for (const id of c.ids) {
      const e = byId.get(id);
      if (e && id !== c.canonicalId && (e.status === 'published' || e.status === 'to-test')) {
        out.push({ id, canonicalId: c.canonicalId });
      }
    }
  }
  return out;
}
