/** Données du composeur de prompts, générées depuis le classeur Excel (npm run generate:composer). */
export interface ComposerOption {
  id: string;
  label: string;
  /** Texte inséré dans le prompt composé. */
  text: string;
  /** Explication lisible (ex. « éclairage par l'arrière ») : affichée, jamais insérée dans le prompt. */
  hint?: string;
  /** Regroupement d'affichage (ex. famille visuelle d'un style). */
  group?: string;
}

export interface ComposerTerm {
  label: string;
  count: number;
}

export interface ComposerBlock {
  n: number;
  label: string;
  hint: string;
}

export interface ComposerData {
  source: string;
  /** Les 10 blocs de la méthode (feuille « MÉTHODE IMAGE 10 BLOCS »). */
  blocks: ComposerBlock[];
  styles: ComposerOption[];
  lighting: ComposerOption[];
  effects: ComposerOption[];
  templates: ComposerOption[];
  exclusions: ComposerOption[];
  moods: ComposerTerm[];
  eras: ComposerTerm[];
}
