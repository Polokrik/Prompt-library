import path from 'node:path';
import { PATHS } from './paths.mts';
import { exists, readJson } from './io.mts';
import type { RawExcelBatch } from './normalize-excel.mts';
import type { RawExternalBatch } from './normalize-external.mts';

export interface Batches {
  mode: 'sample' | 'full';
  excel?: RawExcelBatch;
  external?: RawExternalBatch;
  notes: string[];
}

/** Charge les lots bruts du mode demandé. Un lot absent est signalé, jamais remplacé par autre chose. */
export function loadBatches(full: boolean): Batches {
  const mode = full ? 'full' : 'sample';
  const notes: string[] = [];
  const out: Batches = { mode, notes };
  const excelFile = path.join(PATHS.excelRawDir, `excel-${mode}.json`);
  const externalFile = path.join(PATHS.externalRawDir, `external-${mode}.json`);
  if (exists(excelFile)) out.excel = readJson<RawExcelBatch>(excelFile);
  else notes.push(`Lot Excel absent (${mode}) : lancer npm run import:excel${full ? '' : ':sample'}`);
  if (exists(externalFile)) out.external = readJson<RawExternalBatch>(externalFile);
  else notes.push(`Lot externe absent (${mode}) : lancer npm run import:external${full ? '' : ':sample'} (accès réseau requis)`);
  return out;
}
