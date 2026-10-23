/*
 * CricScore service worker (hand-written, no build plugin).
 *
 * Goal: a scorer who opened a match's scoring screen online can reload it,
 * or reopen the installed app, while offline and keep scoring. Scoring
 * actions are queued in localStorage by the page (offline-queue.ts); this
 * worker only keeps the page and its assets available.
 *
 * - /_next/static/**, icons, manifest: cache-first (hashed / versioned).
 * - Navigations to /matches/:id/score: network-first with a short timeout,
 *   falling back to the cached HTML; other navigations fall back to
 *   /offline.html when the network is down.
 * - Everything else (POST / server actions, RSC fetches, /api, /__/auth,
 *   /__/firebase, cross-origin Firestore / Google APIs) is never touched.
 *
 * Push notifications (matches the user follows, see ~/lib/push): `push`
 * shows the message's title and body, one notification per match (tag);
 * a click opens the match on this origin.
 *
 * The build version comes from the registration URL (`/sw.js?v=<build>`), so
 * every deploy installs a new worker with fresh caches. Kill switch: set
 * `"disabled": true` in /sw-config.json (see AGENTS.md, Deploys).
 */

const VERSION =
  (typeof self !== "undefined" &&
    self.location &&
    new URL(self.location.href).searchParams.get("v")) ||
  "dev";
const CACHE_PREFIX = "cricscore-";
const STATIC_CACHE = CACHE_PREFIX + "static-" + VERSION;
const PAGES_CACHE = CACHE_PREFIX + "pages-" + VERSION;
const OFFLINE_URL = "/offline.html";
const CONFIG_URL = "/sw-config.json";
const NAV_TIMEOUT_MS = 3500;
const CONFIG_CHECK_INTERVAL_MS = 5 * 60 * 1000;

/** Small, unhashed files the offline experience needs; fetched on install. */
const PRECACHE_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/icon.svg",
  "/apple-icon.png",
  "/favicon.ico",
];

const STATIC_FILES = new Set(PRECACHE_URLS);

/** Same-origin prefixes that must always go straight to the network. */
const NEVER_INTERCEPT_PREFIXES = ["/api/", "/__/", "/_next/image", "/_next/data/"];
const NEVER_INTERCEPT_FILES = new Set(["/sw.js", CONFIG_URL]);

const SCORE_PAGE = /^\/matches\/[^/]+\/score\/?$/;

/**
 * Decides how a request is handled. Pure, so it can be unit tested.
 * @param {{ method: string, url: string, mode?: string, headers?: { get(name: string): string | null } }} req
 * @param {string} origin The worker's origin.
 * @returns {"bypass" | "static" | "page" | "navigate"}
 *   bypass: never intercepted. static: cache-first. page: network-first,
 *   cached HTML fallback. navigate: network only, offline page fallback.
 */
function classifyRequest(req, origin) {
  if (req.method !== "GET") return "bypass";
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return "bypass";
  }
  if (url.origin !== origin) return "bypass";
  const path = url.pathname;
  if (NEVER_INTERCEPT_FILES.has(path)) return "bypass";
  if (NEVER_INTERCEPT_PREFIXES.some((p) => path.startsWith(p))) return "bypass";
  const header = (name) => (req.headers ? req.headers.get(name) : null);
  // Server actions and RSC / prefetch payloads belong to the network.
  if (header("next-action") || header("rsc") || header("next-router-prefetch"))
    return "bypass";
  if (url.searchParams.has("_rsc")) return "bypass";

  if (path.startsWith("/_next/static/")) return "static";
  if (STATIC_FILES.has(path)) return "static";

  if (req.mode === "navigate") return SCORE_PAGE.test(path) ? "page" : "navigate";
  return "bypass";
}

/** Cache key for a page: path only, so `?tab=` variants share one entry. */
function pageCacheKey(url) {
  const u = new URL(url);
  return u.origin + u.pathname.replace(/\/$/, "");
}

/** Old CricScore caches to delete when this version activates. */
function staleCaches(names, keep) {
  return names.filter((n) => n.startsWith(CACHE_PREFIX) && !keep.includes(n));
}

/** A response worth keeping: complete, same-origin, not a redirect. */
function isCacheable(res) {
  return Boolean(res) && res.ok && res.status === 200 && res.type === "basic" && !res.redirected;
}

/** A same-origin URL to open for a notification (else the home page). */
function notificationUrl(value, origin) {
  try {
    const u = new URL(typeof value === "string" ? value : "/", origin);
    return u.origin === origin ? u.href : origin + "/";
  } catch {
    return origin + "/";
  }
}

/**
 * The notification for a push message's JSON ({ title, body, url, tag }),
 * or null when it has no title.
 */
function notificationFromPush(data, origin) {
  if (!data || typeof data !== "object") return null;
  const title = typeof data.title === "string" ? data.title.slice(0, 120) : "";
  if (!title) return null;
  const tag = typeof data.tag === "string" && data.tag ? data.tag.slice(0, 64) : undefined;
  return {
    title,
    options: {
      body: typeof data.body === "string" ? data.body.slice(0, 300) : "",
      icon: "/icon-192.png",
      tag,
      // A later message for the same match replaces the last one and alerts again.
      renotify: Boolean(tag),
      data: { url: notificationUrl(data.url, origin) },
    },
  };
}

// --- Exports for tests (no `module` inside a real worker) ---------------
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    notificationFromPush,
    notificationUrl,
    classifyRequest,
    pageCacheKey,
    staleCaches,
    isCacheable,
    PRECACHE_URLS,
    STATIC_CACHE,
    PAGES_CACHE,
  };
}

// --- Worker wiring ------------------------------------------------------
if (typeof self !== "undefined" && typeof self.addEventListener === "function" && typeof module === "undefined") {
  let disabled = false;
  let lastConfigCheck = 0;

  const killSelf = async () => {
    disabled = true;
    const names = await caches.keys();
    await Promise.all(
      names.filter((n) => n.startsWith(CACHE_PREFIX)).map((n) => caches.delete(n)),
    );
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: "window" });
    for (const c of clients) c.postMessage({ type: "SW_DISABLED" });
  };

  const checkConfig = async (force) => {
    const now = Date.now();
    if (!force && now - lastConfigCheck < CONFIG_CHECK_INTERVAL_MS) return;
    lastConfigCheck = now;
    try {
      const res = await fetch(CONFIG_URL, { cache: "no-store" });
      if (!res.ok) return;
      const cfg = await res.json();
      if (cfg && cfg.disabled === true) await killSelf();
    } catch {
      // Offline or missing config: keep working.
    }
  };

  self.addEventListener("install", (event) => {
    event.waitUntil(
      caches.open(STATIC_CACHE).then((cache) =>
        // One missing optional file must not fail the whole install.
        Promise.all(PRECACHE_URLS.map((u) => cache.add(u).catch(() => undefined))),
      ),
    );
    // No skipWaiting here: an update waits until the page asks for it.
  });

  self.addEventListener("activate", (event) => {
    event.waitUntil(
      (async () => {
        const names = await caches.keys();
        await Promise.all(
          staleCaches(names, [STATIC_CACHE, PAGES_CACHE]).map((n) => caches.delete(n)),
        );
        await self.clients.claim();
        await checkConfig(true);
      })(),
    );
  });

  const cacheFirst = async (request) => {
    const cache = await caches.open(STATIC_CACHE);
    const hit = await cache.match(request, { ignoreVary: true });
    if (hit) return hit;
    const res = await fetch(request);
    if (isCacheable(res)) await cache.put(request, res.clone()).catch(() => undefined);
    return res;
  };

  const offlinePage = async () =>
    (await caches.match(OFFLINE_URL)) ||
    new Response("You're offline.", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });

  const networkFirstPage = async (event) => {
    const key = pageCacheKey(event.request.url);
    const cache = await caches.open(PAGES_CACHE);
    const network = fetch(event.request).then(async (res) => {
      if (isCacheable(res)) await cache.put(key, res.clone()).catch(() => undefined);
      return res;
    });
    // Keep the cache update alive even if the cached copy wins the race.
    event.waitUntil(network.catch(() => undefined));
    const timeout = new Promise((resolve) => setTimeout(() => resolve(null), NAV_TIMEOUT_MS));
    try {
      const first = await Promise.race([network, timeout]);
      if (first) return first;
      const cached = await cache.match(key);
      return cached || (await network);
    } catch {
      return (await cache.match(key)) || offlinePage();
    }
  };

  const navigate = async (event) => {
    try {
      return await fetch(event.request);
    } catch {
      return offlinePage();
    }
  };

  self.addEventListener("fetch", (event) => {
    if (disabled) return;
    const kind = classifyRequest(event.request, self.location.origin);
    if (kind === "bypass") return;
    if (kind === "static") {
      event.respondWith(cacheFirst(event.request));
      return;
    }
    event.waitUntil(checkConfig(false));
    event.respondWith(kind === "page" ? networkFirstPage(event) : navigate(event));
  });

  /**
   * Pages post the assets they loaded before this worker controlled them
   * (and the dialogs they preloaded) so a later offline visit has them all.
   */
  const cacheUrls = async (urls) => {
    const staticCache = await caches.open(STATIC_CACHE);
    const pagesCache = await caches.open(PAGES_CACHE);
    const origin = self.location.origin;
    await Promise.all(
      urls.slice(0, 500).map(async (u) => {
        try {
          const asNav = classifyRequest({ method: "GET", url: u, mode: "navigate" }, origin);
          if (asNav === "page") {
            const res = await fetch(u, { credentials: "same-origin", headers: { Accept: "text/html" } });
            if (isCacheable(res)) await pagesCache.put(pageCacheKey(u), res);
            return;
          }
          if (classifyRequest({ method: "GET", url: u }, origin) !== "static") return;
          if (await staticCache.match(u)) return;
          const res = await fetch(u, { credentials: "same-origin" });
          if (isCacheable(res)) await staticCache.put(u, res);
        } catch {
          // Best effort.
        }
      }),
    );
  };

  self.addEventListener("push", (event) => {
    if (disabled) return;
    let data = null;
    try {
      data = event.data ? event.data.json() : null;
    } catch {
      data = null;
    }
    const note = notificationFromPush(data, self.location.origin);
    if (!note) return;
    event.waitUntil(
      Promise.all([
        self.registration.showNotification(note.title, note.options),
        checkConfig(false),
      ]),
    );
  });

  self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const url = notificationUrl(
      event.notification.data && event.notification.data.url,
      self.location.origin,
    );
    event.waitUntil(
      (async () => {
        const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        const open = windows.find((c) => c.url === url);
        if (open && "focus" in open) return open.focus();
        if (self.clients.openWindow) return self.clients.openWindow(url);
        return undefined;
      })(),
    );
  });

  self.addEventListener("message", (event) => {
    const data = event.data || {};
    if (data.type === "SKIP_WAITING") {
      self.skipWaiting();
    } else if (data.type === "CACHE_URLS" && Array.isArray(data.urls)) {
      event.waitUntil(cacheUrls(data.urls.filter((u) => typeof u === "string")));
    } else if (data.type === "CLEAR_PAGES") {
      event.waitUntil(caches.delete(PAGES_CACHE));
    }
  });
}
