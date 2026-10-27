import { describe, expect, it } from 'vitest';
import { excelId, externalId } from '../scripts/lib/ids.mts';

describe('identifiants stables', () => {
  it('reprend l’identifiant de la source quand il existe, sans dépendre du titre', () => {
    expect(externalId('external-initial', '42', 'prompt A')).toBe('ext-42');
    expect(externalId('external-initial', '42', 'prompt B')).toBe('ext-42');
    expect(excelId('ENT-ABC', 'prompt-bible', 'x')).toBe('ENT-ABC');
  });

  it('retombe sur un hash stable (source + prompt) à défaut d’identifiant', () => {
    const a = externalId('external-initial', undefined, 'same prompt');
    expect(a).toBe(externalId('external-initial', undefined, '  same prompt '));
    expect(a).not.toBe(externalId('other-source', undefined, 'same prompt'));
    expect(a).toMatch(/^ext-h[0-9a-f]{10}$/);
  });

  it('neutralise les identifiants dangereux pour un nom de fichier', () => {
    expect(externalId('s', '../../etc/passwd', '')).not.toContain('/');
    expect(externalId('s', '../../etc/passwd', '')).not.toContain('..');
  });
});
