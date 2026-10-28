import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const p = (...parts: string[]) => path.join(ROOT, ...parts);

export const PATHS = {
  root: ROOT,
  externalDir: p('imports', 'external'),
  externalSource: p('imports', 'external', 'source.json'),
  externalMapping: p('imports', 'external', 'mapping.json'),
  externalRawDir: p('imports', 'external', 'raw'),
  externalOriginals: p('imports', 'external', 'originals'),
  excelFile: p('imports', 'prompt-bible', 'Prompt Bible.xlsx'),
  excelMapping: p('imports', 'prompt-bible', 'mapping.json'),
  excelRawDir: p('imports', 'prompt-bible', 'raw'),
  manualImages: p('imports', 'images'),
  descriptions: p('imports', 'descriptions.txt'),
  thumbs: p('public', 'images', 'prompts', 'thumbs'),
  large: p('public', 'images', 'prompts', 'large'),
  publicDir: p('public'),
  generated: p('generated'),
  reports: p('reports'),
  dataDir: p('src', 'data'),
};

export const SOURCE_IDS = { external: 'external-initial', excel: 'prompt-bible' } as const;
