import { useSyncExternalStore } from 'react';
import { readStorage, writeStorage } from './storage.ts';

const KEY = 'prompt-library:favorites:v1';
const listeners = new Set<() => void>();
let cache: ReadonlySet<string> | null = null;

export function parseFavorites(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const data: unknown = JSON.parse(raw);
    return new Set(Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

function snapshot(): ReadonlySet<string> {
  cache ??= parseFavorites(readStorage(KEY));
  return cache;
}

export function toggleFavorite(id: string): void {
  const next = new Set(snapshot());
  if (!next.delete(id)) next.add(id);
  cache = next;
  writeStorage(KEY, JSON.stringify([...next]));
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useFavorites(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot, snapshot);
}
