import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PromptEntry } from '../src/types/library.ts';

const dir = path.resolve(import.meta.dirname, '..', 'src', 'data');
const read = <T,>(f: string) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) as T;

describe('données générées (intégration)', () => {
  const all = read<PromptEntry[]>('prompts.json');
  const pub = read<PromptEntry[]>('prompts.public.json');

  it('le fichier public ne contient que published et to-test, sans notes de revue', () => {
    expect(pub.every((e) => e.status === 'published' || e.status === 'to-test')).toBe(true);
    expect(pub.some((e) => 'reviewNotes' in e)).toBe(false);
  });
  it('le fichier public est exactement la partie visible du fichier complet', () => {
    expect(pub.map((e) => e.id)).toEqual(all.filter((e) => e.status === 'published' || e.status === 'to-test').map((e) => e.id));
  });
  it('aucune fiche to-confirm / hidden dans le public', () => {
    const hiddenIds = new Set(all.filter((e) => e.status === 'to-confirm' || e.status === 'hidden').map((e) => e.id));
    expect(pub.some((e) => hiddenIds.has(e.id))).toBe(false);
  });
});
