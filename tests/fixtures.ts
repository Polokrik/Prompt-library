import type { PromptEntry } from '../src/types/library.ts';

/** Fiche synthétique pour les tests uniquement (ne passe jamais dans les données publiées). */
export function makeEntry(over: Partial<PromptEntry> = {}): PromptEntry {
  return {
    id: 'test-1',
    title: 'Titre de test',
    prompt: 'A synthetic prompt used only by unit tests',
    status: 'to-test',
    categories: ['Photographie'],
    tags: ['alpha'],
    variants: [],
    source: { id: 'test-source', label: 'Source de test' },
    ...over,
  };
}

export const withImage = (id = 'test-1', alt = 'Un objet posé sur une table') => ({
  thumbnail: `images/prompts/thumbs/${id}.webp`,
  large: `images/prompts/large/${id}.webp`,
  alt,
});
