import { describe, expect, it } from 'vitest';
import { normalizeExcel, type RawExcelBatch } from '../scripts/lib/normalize-excel.mts';
import { finalizeEntry } from '../scripts/lib/status.mts';
import type { RawCatalogueRow, RawText } from '../scripts/lib/excel.mts';

const row = (over: Record<string, string | null>): RawCatalogueRow =>
  ({ Entrée_ID: 'ENT-1', Titre: 'Titre', 'Type proposé': 'Prompt', 'Famille proposée': 'Photographie', 'Usages proposés': 'À confirmer',
    'Texte principal_ID': 'TXT-1', _row: 7, ...over }) as unknown as RawCatalogueRow;
const text = (over: Partial<RawText>): RawText => ({ Texte_ID: 'TXT-1', Entrée_ID: 'ENT-1', Rôle: 'Original', 'Texte intégral': 'A complete original prompt for a photo', 'Langue proposée': 'Anglais', _row: 7, ...over });
const batch = (catalogue: RawCatalogueRow[], texts: RawText[]): RawExcelBatch => ({ source: 'prompt-bible', file: 'x.xlsx', importedAt: '2000-01-01T00:00:00.000Z', mode: 'sample', catalogue, texts });
const status = (b: RawExcelBatch) => normalizeExcel(b).map(({ entry, cap }) => finalizeEntry(entry, { verified: false, ...(cap ? { cap } : {}) }).entry);

describe('import Excel : règles de statut', () => {
  it('prompt complet non vérifié -> to-test, id d’origine conservé, langue et catégories normalisées', () => {
    const [e] = status(batch([row({})], [text({})]));
    expect(e).toMatchObject({ id: 'ENT-1', status: 'to-test', language: 'en', categories: ['Photographie'], kind: 'prompt' });
    expect(e!.source.originalId).toBe('ENT-1');
  });

  it('jamais published par défaut, jamais de valeur inventée', () => {
    const [e] = status(batch([row({})], [text({})]));
    expect(e!.status).not.toBe('published');
    expect(e!.requiresReference).toBeUndefined();
    expect(e!.orientation).toBeUndefined();
    expect(e!.image).toBeUndefined();
  });

  it('sans catégorie -> to-confirm ; sans prompt -> to-confirm ; fragment court -> to-confirm', () => {
    expect(status(batch([row({ 'Famille proposée': 'À confirmer' })], [text({})]))[0]!.status).toBe('to-confirm');
    expect(status(batch([row({})], [text({ 'Texte intégral': null })]))[0]!.status).toBe('to-confirm');
    expect(status(batch([row({})], [text({ 'Texte intégral': 'Format libre' })]))[0]!.status).toBe('to-confirm');
  });

  it('style / technique / template -> to-confirm ; note -> hidden ; type à confirmer -> to-confirm', () => {
    for (const t of ['Style', 'Technique', 'Template']) expect(status(batch([row({ 'Type proposé': t })], [text({})]))[0]!.status).toBe('to-confirm');
    const [note] = status(batch([row({ 'Type proposé': 'Note' })], [text({})]));
    expect(note).toMatchObject({ status: 'hidden' });
    expect(note!.hiddenReason).toBeTruthy();
    expect(status(batch([row({ 'Type proposé': 'À confirmer' })], [text({})]))[0]!.status).toBe('to-confirm');
  });

  it('variantes et briques rattachées à la fiche, textes autonomes ignorés', () => {
    const texts = [
      text({}),
      text({ Texte_ID: 'TXT-2', Rôle: 'Variante (libellé Gemini, non vérifié)', 'Langue proposée': 'Français', 'Texte intégral': 'Une variante en français' }),
      text({ Texte_ID: 'TXT-3', Rôle: 'Brique recomposable', 'Texte intégral': 'brick text' }),
      text({ Texte_ID: 'TXT-4', Entrée_ID: null, Rôle: 'Fragment non rattaché', 'Texte intégral': 'orphan' }),
    ];
    const [e] = status(batch([row({})], texts));
    expect(e!.variants.map((v) => [v.id, v.role])).toEqual([['TXT-2', 'variant'], ['TXT-3', 'brick']]);
    expect(e!.variants[0]).toMatchObject({ language: 'fr', label: expect.stringContaining('Gemini') });
  });

  it('orientations contradictoires -> non déduite ; référence « Oui » -> true', () => {
    const [e] = status(batch([row({ 'Orientation mentionnée': 'horizontal ; vertical', 'Référence requise': 'Oui' })], [text({})]));
    expect(e!.orientation).toBeUndefined();
    expect(e!.requiresReference).toBe(true);
    expect(status(batch([row({ 'Orientation mentionnée': 'paysage ; landscape' })], [text({})]))[0]!.orientation).toBe('landscape');
  });
});
