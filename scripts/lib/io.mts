import fs from 'node:fs';
import path from 'node:path';

export function exists(file: string): boolean {
  return fs.existsSync(file);
}

export function readJson<T>(file: string, fallback?: T): T {
  if (!fs.existsSync(file)) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Fichier introuvable : ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

/** Écriture JSON lisible et stable (indentation 2, saut de ligne final). */
export function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export function writeText(file: string, text: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, text, 'utf8');
}

export function rel(file: string, root: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}

export function parseArgs(argv: string[]): { flags: Set<string>; values: Record<string, string> } {
  const flags = new Set<string>();
  const values: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith('--')) continue;
    const [k, v] = a.slice(2).split('=');
    if (v !== undefined) values[k!] = v;
    else flags.add(k!);
  }
  return { flags, values };
}
