/**
 * Modèle de données de la bibliothèque.
 *
 * Règle unique pour les valeurs absentes : la propriété est OMISE (jamais `null`,
 * jamais une chaîne vide, jamais une valeur inventée). Les tableaux sont toujours présents
 * pour `categories`, `tags` et `variants`, éventuellement vides.
 *
 * Les chemins d'image sont relatifs à la racine du site (sans « / » initial) afin de
 * fonctionner sous https://utilisateur.github.io/nom-du-repository/.
 */

export type PromptStatus = 'published' | 'to-test' | 'to-confirm' | 'hidden';
export type PromptOrientation = 'landscape' | 'portrait' | 'square';
export type PromptLanguage = 'fr' | 'en';
/** Nature de l'entrée, quand la source la précise (Excel : colonne « Type proposé »). */
export type PromptKind = 'prompt' | 'template' | 'style' | 'technique' | 'note';

export interface PromptImage {
  thumbnail: string;
  large: string;
  alt: string;
  width?: number;
  height?: number;
}

export interface PromptSource {
  /** Identifiant de lot : « external-initial », « prompt-bible »… */
  id: string;
  label: string;
  url?: string;
  originalId?: string;
  /** Auteur du prompt, tel que fourni par la source (jamais déduit). */
  author?: string;
  /** Lien vers la publication d'origine (post, dépôt…). */
  originalUrl?: string;
  license?: { label: string; url?: string };
  /** Date ISO du dernier import de ce lot (jamais inventée). */
  importedAt?: string;
}

export interface PromptVariant {
  id: string;
  label: string;
  prompt: string;
  language?: PromptLanguage;
  /** « variant » : autre formulation ; « brick » : brique recomposable. */
  role: 'variant' | 'brick';
}

export interface PromptEntry {
  id: string;
  title: string;
  prompt: string;
  description?: string;
  image?: PromptImage;
  status: PromptStatus;
  categories: string[];
  tags: string[];
  orientation?: PromptOrientation;
  language?: PromptLanguage;
  /** Absent = inconnu. `false` n'est écrit que si la source l'affirme. */
  requiresReference?: boolean;
  ratio?: string;
  kind?: PromptKind;
  variants: PromptVariant[];
  /** Détails supplémentaires issus de la source (style, technique, ambiance…). */
  details?: Record<string, string>;
  source: PromptSource;
  /** Raison éditoriale d'un masquage (mapping ou règle automatique). */
  hiddenReason?: string;
  /** Fiche canonique dont celle-ci est un doublon. */
  canonicalId?: string;
  collectionIds?: string[];
  /** Outil IA utilisé pour générer l'image (« Midjourney », « Sora »…), tel que fourni. */
  generator?: string;
  /** Notes de revue : pourquoi le statut n'est pas « published ». Retirées du build public. */
  reviewNotes?: string[];
  createdAt?: string;
  updatedAt?: string;
}

export interface PromptCollection {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  promptIds: string[];
  order: number;
  featured?: boolean;
}

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  code: string;
  entryId?: string;
  message: string;
  /** Fichier à modifier pour corriger le problème. */
  fixIn?: 'excel' | 'mapping' | 'images' | 'source' | 'categories';
}

export type DuplicateType =
  | 'exact'
  | 'near'
  | 'same-image-different-prompt'
  | 'same-prompt-different-image'
  | 'probable-variant';

export interface DuplicateCandidate {
  type: DuplicateType;
  ids: string[];
  /** Score de similarité entre 0 et 1, ou motif lisible. */
  score?: number;
  reason: string;
  excerpts: { id: string; text: string }[];
  /** Candidat canonique proposé (doublons exacts uniquement). */
  canonicalId?: string;
  suggestion: string;
}

export interface ImportReport {
  source: string;
  mode: 'sample' | 'full';
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  analysed: number;
  imported: number;
  missingPrompt: string[];
  missingImage: string[];
  missingTitle: string[];
  networkErrors: { url: string; error: string }[];
  exactDuplicatesInBatch: string[][];
  problematicCharacters: { id: string; field: string; issue: string }[];
  notes: string[];
  output?: string;
}

/** Corrections éditoriales persistantes (mapping.json), indexées par id de fiche. */
export interface EditorialOverride {
  title?: string;
  /**
   * Prompt retravaillé pour le Carnet. Le prompt d'origine est conservé tel quel dans une variante « Prompt d'origine » ;
   * les précisions ajoutées à l'import (« DIRECTION DÉTAILLÉE ») restent attachées au nouveau texte.
   */
  prompt?: string;
  description?: string;
  status?: PromptStatus;
  categories?: string[];
  tags?: string[];
  orientation?: PromptOrientation;
  language?: PromptLanguage;
  requiresReference?: boolean;
  image?: { alt?: string };
  hiddenReason?: string;
  canonicalId?: string;
  collectionIds?: string[];
  generator?: string;
}
export type EditorialMapping = Record<string, EditorialOverride>;
