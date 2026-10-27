import { safeUrl } from './text.mts';

export const USER_AGENT = 'prompt-library-importer/0.1 (+personal project; polite, low rate)';

export interface FetchResult {
  ok: boolean;
  status: number;
  url: string;
  contentType: string;
  body: Buffer;
}

export class FetchError extends Error {}

/**
 * Téléchargement borné : schéma http(s) seulement, délai d'expiration, taille maximale.
 * Aucune authentification, aucun contournement : un refus (403, 429…) est simplement rapporté.
 */
export async function fetchLimited(
  rawUrl: string,
  opts: { timeoutMs?: number; maxBytes?: number; accept?: string } = {},
): Promise<FetchResult> {
  const url = safeUrl(rawUrl);
  if (!url) throw new FetchError(`URL refusée (schéma ou format invalide) : ${rawUrl}`);
  const { timeoutMs = 20_000, maxBytes = 5 * 1024 * 1024, accept = '*/*' } = opts;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: 'follow',
      headers: { 'user-agent': USER_AGENT, accept },
    });
    const declared = Number(res.headers.get('content-length') ?? 0);
    if (declared > maxBytes) throw new FetchError(`Réponse trop volumineuse (${declared} octets) : ${url}`);
    const chunks: Uint8Array[] = [];
    let size = 0;
    if (res.body) {
      for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
        size += chunk.byteLength;
        if (size > maxBytes) throw new FetchError(`Réponse trop volumineuse (> ${maxBytes} octets) : ${url}`);
        chunks.push(chunk);
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      url: res.url || url,
      contentType: res.headers.get('content-type') ?? '',
      body: Buffer.concat(chunks),
    };
  } catch (e) {
    if (e instanceof FetchError) throw e;
    const err = e as Error & { cause?: { message?: string; code?: string } };
    const cause = err.cause?.message ?? err.cause?.code ?? '';
    throw new FetchError(`${err.name === 'AbortError' ? 'Délai dépassé' : err.message}${cause ? ` (${cause})` : ''} : ${url}`);
  } finally {
    clearTimeout(timer);
  }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
