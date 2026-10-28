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

  // 2 & 5. Textes proches, variantes probables.
  // Tout est précalculé une fois par fiche ; les paires candidates viennent d'un index inversé
  // (mots rares partagés), jamais d'une double boucle sur toutes les fiches.
  const n = entries.length;
  const compared = entries.map((e) => comparable(e.prompt));
  const sets = compared.map((c) => new Set(c ? c.split(' ') : []));
  const variantTexts = entries.map((e) => new Set(e.variants.map((v) => comparable(v.prompt))));
  const seenPair = new Set<string>();
  const push = (i: number, j: number, c: DuplicateCandidate) => {
    const k = pairKey(entries[i]!.id, entries[j]!.id);
    if (seenPair.has(k) || exactPairs.has(k)) return;
    seenPair.add(k);
    out.push(c);
  };

  // 5a. le prompt d'une fiche est une variante de l'autre (table texte de variante -> fiches, O(n))
  const byVariantText = new Map<string, number[]>();
  variantTexts.forEach((set, j) => set.forEach((t) => byVariantText.set(t, [...(byVariantText.get(t) ?? []), j])));
  compared.forEach((c, i) => {
    if (!c) return;
    for (const j of byVariantText.get(c) ?? []) {
      if (j === i) continue;
      const [x, y] = i < j ? [i, j] : [j, i];
      push(x, y, {
        type: 'probable-variant',
        ids: [entries[x]!.id, entries[y]!.id],
        reason: 'Le prompt d’une fiche est une variante de l’autre',
        excerpts: [excerpt(entries[x]!), excerpt(entries[y]!)],
        suggestion: 'Regrouper en une fiche avec variantes (canonicalId sur la fiche secondaire).',
      });
    }
  });

  // 5b/2. similarité par index inversé : mots présents dans au plus 20 % des fiches
  const postings = new Map<string, number[]>();
  sets.forEach((set, i) => {
    if (set.size < MIN_TOKENS_FOR_SIMILARITY) return;
    for (const t of set) postings.set(t, [...(postings.get(t) ?? []), i]);
  });
  const maxDf = Math.max(20, Math.floor(n * 0.2));
  const shared = new Map<number, Map<number, number>>();
  for (const list of postings.values()) {
    if (list.length < 2 || list.length > maxDf) continue;
    for (let x = 0; x < list.length; x++) {
      for (let y = x + 1; y < list.length; y++) {
        const i = list[x]!;
        const j = list[y]!;
        const row = shared.get(i) ?? new Map<number, number>();
        row.set(j, (row.get(j) ?? 0) + 1);
        shared.set(i, row);
      }
    }
  }
  for (const [i, row] of shared) {
    for (const [j, count] of row) {
      if (count < 3) continue;
      const sa = sets[i]!;
      const sb = sets[j]!;
      if (Math.min(sa.size, sb.size) / Math.max(sa.size, sb.size) < VARIANT_THRESHOLD) continue;
      const score = jaccard(sa, sb);
      const a = entries[i]!;
      const b = entries[j]!;
      if (score >= NEAR_THRESHOLD) {
        push(i, j, {
          type: 'near',
          ids: [a.id, b.id],
          score: Number(score.toFixed(3)),
          reason: `Textes très proches (similarité ${score.toFixed(2)})`,
          excerpts: [excerpt(a), excerpt(b)],
          suggestion: 'Comparer à la main ; aucune fusion automatique.',
        });
      } else if (score >= VARIANT_THRESHOLD) {
        push(i, j, {
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
