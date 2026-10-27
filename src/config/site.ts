/** Nom, phrase et liens du site : un seul endroit à modifier. */
export const SITE = {
  name: 'Carnet d’images',
  tagline: 'Des idées à regarder. Des prompts à détourner.',
  alternativeTagline: 'Trouvez une intention, pas seulement un prompt.',
  searchPlaceholder: 'Un sujet, une matière, une ambiance…',
  inspiration: {
    label: 'La baie des images',
    author: 'Vincent Flibustier',
    url: 'https://vincentflibustier.com/imageia/#bibliotheque',
  },
} as const;

/** Nombre de fiches affichées par page de la bibliothèque. */
export const PAGE_SIZE = 48;
