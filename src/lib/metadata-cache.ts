import { LruMicroCache } from "./match-cache";

/**
 * What a detail page's `generateMetadata` needs, kept across requests.
 *
 * Next.js runs `generateMetadata` for every prefetch of a route with a
 * `loading.tsx`, so each link in view costs a Firestore read for a title
 * nobody may see, and Next.js hides the prefetch headers from `headers()` and
 * `proxy`, so a page cannot tell a prefetch and skip it. Remembering the
 * result here makes repeats free. The page itself always reads fresh, so a
 * stale value can only be a tab title or link preview, for at most its TTL.
 * Per server instance, and gone with it, which is fine for this.
 *
 * `load` should go through the page's own React `cache()` loader, so a real
 * visit that misses here still reads the document only once.
 */

/** A name rarely changes, and only the tab title can lag behind. */
export const TITLE_TTL_MS = 30 * 60 * 1000;

/** A match in play: its link preview carries the score. */
export const LIVE_METADATA_TTL_MS = 60 * 1000;

const store = new LruMicroCache();

/**
 * The value under `key`, from `load` when there is none. Nothing found is not
 * remembered, so a document created a moment later shows at once.
 */
export async function cachedForMetadata<T>(
  key: string,
  load: () => Promise<T | null | undefined>,
  ttlMs: number | ((value: T) => number) = TITLE_TTL_MS,
): Promise<T | null> {
  const hit = store.get<T>(key);
  if (hit !== null) return hit;
  const inFlight = store.getPending<T | null>(key);
  if (inFlight) return inFlight;

  const loading = (async () => {
    const value = (await load()) ?? null;
    if (value !== null) {
      store.set(key, value, typeof ttlMs === "function" ? ttlMs(value) : ttlMs);
    }
    return value;
  })();
  store.setPending(key, loading);
  try {
    return await loading;
  } finally {
    store.clearPending(key);
  }
}

/** Empties the cache (tests). */
export function clearMetadataCache(): void {
  store.invalidate();
}
