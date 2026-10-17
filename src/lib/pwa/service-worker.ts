/**
 * Browser side of the service worker in `public/sw.js`: when to register it,
 * how to remove it (kill switch / dev), and the helpers the scoring page uses
 * to keep its assets available offline.
 */

/** Prefix of every cache the worker owns (see `public/sw.js`). */
export const SW_CACHE_PREFIX = "cricscore-";

export interface RegistrationEnv {
  nodeEnv: string | undefined;
  /** `NEXT_PUBLIC_SW_DISABLED`. */
  disabledFlag: string | undefined;
  protocol: string;
  hostname: string;
  supported: boolean;
}

/**
 * Only production builds served over https from a real host get a worker.
 * Dev (and any localhost run) never does: a stale worker on localhost:3005
 * has broken dev before.
 */
export function shouldRegisterServiceWorker(env: RegistrationEnv): boolean {
  if (!env.supported) return false;
  if (env.nodeEnv !== "production") return false;
  if (env.disabledFlag === "true") return false;
  if (env.protocol !== "https:") return false;
  const host = env.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost")) return false;
  if (host === "127.0.0.1" || host === "[::1]" || host === "::1") return false;
  return true;
}

/** The script URL; the version makes each deploy install a fresh worker. */
export function serviceWorkerUrl(buildId: string | undefined): string {
  return `/sw.js?v=${encodeURIComponent(buildId || "dev")}`;
}

/**
 * Offer "Reload" for a waiting worker only when nothing is queued: switching
 * versions mid-sync is not worth the risk, so the prompt waits.
 */
export function shouldPromptUpdate(args: {
  hasWaitingWorker: boolean;
  pendingCount: number;
}): boolean {
  return args.hasWaitingWorker && args.pendingCount === 0;
}

/** Unregister every worker on this origin and drop our caches. */
export async function removeServiceWorkers(): Promise<boolean> {
  let removed = false;
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      for (const reg of regs) {
        removed = (await reg.unregister()) || removed;
      }
    }
  } catch {
    // Ignore: nothing to remove.
  }
  await clearAppCaches();
  return removed;
}

/** Delete CricScore caches (all, or only the cached pages). */
export async function clearAppCaches(onlyPages = false): Promise<void> {
  try {
    if (typeof caches === "undefined") return;
    const names = await caches.keys();
    const prefix = onlyPages ? `${SW_CACHE_PREFIX}pages-` : SW_CACHE_PREFIX;
    await Promise.all(
      names.filter((n) => n.startsWith(prefix)).map((n) => caches.delete(n)),
    );
  } catch {
    // Cache storage unavailable.
  }
}

/** Same-origin scripts, styles and fonts this page has loaded so far. */
export function loadedAssetUrls(
  entries: { name: string }[],
  origin: string,
): string[] {
  const urls = new Set<string>();
  for (const e of entries) {
    try {
      const u = new URL(e.name);
      if (u.origin === origin && u.pathname.startsWith("/_next/static/")) {
        urls.add(u.href);
      }
    } catch {
      // Not a URL.
    }
  }
  return [...urls];
}

/**
 * Ask the worker to keep this page and everything it has loaded. Safe to call
 * when no worker is present (does nothing).
 */
export async function cacheCurrentPage(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }
  const reg = await navigator.serviceWorker.getRegistration().catch(() => null);
  const worker = navigator.serviceWorker.controller ?? reg?.active;
  if (!worker) return;
  const entries =
    typeof performance !== "undefined"
      ? performance.getEntriesByType("resource")
      : [];
  const urls = loadedAssetUrls(entries, location.origin);
  worker.postMessage({ type: "CACHE_URLS", urls: [location.href, ...urls] });
}
