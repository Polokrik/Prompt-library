import path from 'node:path';
import { PATHS } from './paths.mts';
import { exists, readJson } from './io.mts';
import type { RawExcelBatch } from './normalize-excel.mts';
import type { RawExternalBatch } from './normalize-external.mts';

export interface Batches {
  mode: 'sample' | 'full' | 'mixed';
  excel?: RawExcelBatch;
  external?: RawExternalBatch;
  notes: string[];
}

/**
 * Charge les lots bruts. Par source, le lot « full » est utilisé s'il existe (import complet déjà fait),
 * sinon le lot « sample ». `forceSample` ignore les lots complets. Un lot absent est signalé,
 * jamais remplacé par autre chose.
 */
export function loadBatches(forceSample = false): Batches {
  const notes: string[] = [];
  const pick = <T,>(dir: string, prefix: string, importCmd: string): { data?: T; mode?: 'sample' | 'full' } => {
    const full = path.join(dir, `${prefix}-full.json`);
    const sample = path.join(dir, `${prefix}-sample.json`);
    if (!forceSample && exists(full)) return { data: readJson<T>(full), mode: 'full' };
    if (exists(sample)) return { data: readJson<T>(sample), mode: 'sample' };
    notes.push(`Lot ${prefix} absent : lancer ${importCmd}`);
    return {};
  };
  const excel = pick<RawExcelBatch>(PATHS.excelRawDir, 'excel', 'npm run import:excel:sample (ou import:excel)');
  const external = pick<RawExternalBatch>(PATHS.externalRawDir, 'external', 'npm run import:external:sample (accès réseau requis)');
  const modes = new Set([excel.mode, external.mode].filter(Boolean));
  return {
    mode: modes.size === 1 ? [...modes][0]! : modes.size === 0 ? 'sample' : 'mixed',
    ...(excel.data ? { excel: excel.data } : {}),
    ...(external.data ? { external: external.data } : {}),
    notes,
  };
}
