/** Minuscules, sans accents, espaces compactés : base de la recherche et des comparaisons. */
export function fold(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

export function tokens(text: string): string[] {
  const folded = fold(text);
  return folded ? folded.split(' ') : [];
}
