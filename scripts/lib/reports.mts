import path from 'node:path';
import { PATHS } from './paths.mts';
import { readJson, writeJson } from './io.mts';
import type { ImportReport } from '../../src/types/library.ts';

export const IMPORT_REPORT = path.join(PATHS.reports, 'import-report.json');

export interface ImportReportFile {
  note: string;
  /** Dernier rapport par source et par mode, ex. « prompt-bible:sample ». */
  runs: Record<string, ImportReport>;
}

/** Conserve le dernier rapport de chaque couple source/mode (les autres ne sont pas écrasés). */
export function recordImportReport(report: ImportReport): void {
  const file = readJson<ImportReportFile>(IMPORT_REPORT, {
    note: 'Dernier rapport de chaque import, par source et par mode.',
    runs: {},
  });
  file.runs[`${report.source}:${report.mode}`] = report;
  writeJson(IMPORT_REPORT, file);
}
