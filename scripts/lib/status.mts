import type { PromptEntry, PromptStatus } from '../../src/types/library.ts';
import { tokens } from '../../src/utils/text.ts';

export interface StatusVerdict {
  status: PromptStatus;
  notes: string[];
}

const MIN_WORDS = 3;

/**
 * Règles de statut automatiques (voir README) :
 * - to-confirm : prompt/titre/catégorie manquant, fragment, image sans texte alternatif ;
 * - to-test    : exploitable mais non vérifié, ou image absente ;
 * - published  : complet (image + alt) ET source considérée comme vérifiée.
 * `hidden` n'est jamais produit ici : il vient d'une décision (mapping ou règle de nature).
 */
export function deriveStatus(
  e: Pick<PromptEntry, 'title' | 'prompt' | 'categories' | 'image'>,
  opts: { verified: boolean },
): StatusVerdict {
  const notes: string[] = [];
  if (!e.prompt.trim()) notes.push('Prompt absent');
  else if (tokens(e.prompt).length < MIN_WORDS) notes.push('Prompt très court : ressemble à un fragment');
  if (!e.title.trim()) notes.push('Titre absent');
  if (e.categories.length === 0) notes.push('Catégorie absente');
  if (e.image && !e.image.alt.trim()) notes.push('Image sans texte alternatif fiable');
  if (notes.length > 0) return { status: 'to-confirm', notes };

  if (!e.image) {
    notes.push('Image absente : fiche affichée sans visuel');
    return { status: 'to-test', notes };
  }
  if (!opts.verified) {
    notes.push('Résultat non vérifié');
    return { status: 'to-test', notes };
  }
  return { status: 'published', notes };
}

/** Problèmes empêchant un niveau de statut donné (utilisé pour borner un statut forcé par le mapping). */
export function blockers(e: PromptEntry, target: PromptStatus): string[] {
  const out: string[] = [];
  if (target === 'hidden') return out;
  if (!e.prompt.trim()) out.push('prompt absent');
  if (!e.title.trim()) out.push('titre absent');
  if (e.categories.length === 0) out.push('catégorie absente');
  if (e.image && !e.image.alt.trim()) out.push('texte alternatif absent');
  if (target === 'published' && !e.image) out.push('image absente');
  return out;
}

/**
 * Invariants finaux : un statut ne peut pas dépasser ce que la fiche permet.
 * Renvoie le statut effectif et, si besoin, la note expliquant le rétrogradage.
 */
export function enforceInvariants(e: PromptEntry): { status: PromptStatus; note?: string } {
  if (e.status === 'hidden') return { status: 'hidden' };
  const hard = blockers(e, 'to-test');
  if (hard.length > 0 && e.status !== 'to-confirm') {
    return { status: 'to-confirm', note: `Rétrogradée en « à confirmer » : ${hard.join(', ')}` };
  }
  if (e.status === 'published') {
    const pub = blockers(e, 'published');
    if (pub.length > 0) return { status: 'to-test', note: `Rétrogradée en « à tester » : ${pub.join(', ')}` };
  }
  return { status: e.status };
}

export interface NatureCap {
  status: 'hidden' | 'to-confirm';
  note: string;
  hiddenReason?: string;
}

export interface FinalizeOptions {
  verified: boolean;
  forced?: PromptStatus;
  cap?: NatureCap;
}

/**
 * Priorité : statut du mapping > plafond lié à la nature de la fiche > règles automatiques.
 * Le résultat passe ensuite par `enforceInvariants` : un statut forcé ne peut pas dépasser ce que la
 * fiche permet (le rétrogradage est consigné dans reviewNotes et signalé en avertissement).
 */
export function finalizeEntry(entry: PromptEntry, opts: FinalizeOptions): { entry: PromptEntry; warnings: string[] } {
  const warnings: string[] = [];
  const derived = deriveStatus(entry, { verified: opts.verified });
  let status = derived.status;
  let notes = derived.notes;
  const next: PromptEntry = { ...entry };

  if (opts.forced) {
    status = opts.forced;
    notes = [`Statut « ${opts.forced} » fixé dans le mapping éditorial`];
  } else if (opts.cap) {
    status = opts.cap.status;
    notes = [opts.cap.note, ...derived.notes.filter((n) => n !== 'Résultat non vérifié')];
    if (opts.cap.hiddenReason && !next.hiddenReason) next.hiddenReason = opts.cap.hiddenReason;
  }
  next.status = status;
  const inv = enforceInvariants(next);
  if (inv.status !== status) {
    next.status = inv.status;
    if (inv.note) {
      notes = [...notes, inv.note];
      if (opts.forced) warnings.push(`${entry.id} : ${inv.note}`);
    }
  }
  if (next.status === 'published') delete next.reviewNotes;
  else next.reviewNotes = notes;
  return { entry: next, warnings };
}
