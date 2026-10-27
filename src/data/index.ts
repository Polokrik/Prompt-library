import type { PromptCollection, PromptEntry } from '../types/library.ts';
import publicEntries from './prompts.public.json';
import collectionsData from './collections.json';
import sourcesData from './sources.json';

/**
 * Données du site public. `prompts.public.json` ne contient que les fiches « published » et « to-test » :
 * les fiches « to-confirm » et « hidden » ne sont jamais embarquées dans le build de production.
 */
export const entries = publicEntries as unknown as PromptEntry[];
export const collections = (collectionsData as unknown as PromptCollection[]).slice().sort((a, b) => a.order - b.order);
export const sources = sourcesData as unknown as {
  id: string;
  label: string;
  url?: string;
  importedAt?: string;
  count: number;
  byStatus: Record<string, number>;
}[];
export const entriesById = new Map(entries.map((e) => [e.id, e]));
