// @vitest-environment node
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../../../public/sw.js", import.meta.url)),
  "utf8",
);
const ORIGIN = "https://cricscore.altorstudio.com";

interface SwExports {
  classifyRequest: (
    req: {
      method: string;
      url: string;
      mode?: string;
      headers?: { get(name: string): string | null };
    },
    origin: string,
  ) => string;
  pageCacheKey: (url: string) => string;
  staleCaches: (names: string[], keep: string[]) => string[];
  isCacheable: (res: unknown) => boolean;
  PRECACHE_URLS: string[];
  STATIC_CACHE: string;
  PAGES_CACHE: string;
}

/** Loads public/sw.js as a module (pure functions only, no listeners). */
function loadPure(version = "build1"): SwExports {
  const cjs = { exports: {} as SwExports };
  vm.runInNewContext(SOURCE, {
    module: cjs,
    URL,
    self: { location: { href: `${ORIGIN}/sw.js?v=${version}` } },
  });
  return cjs.exports;
}

const sw = loadPure();

function req(
  path: string,
  init: { method?: string; mode?: string; headers?: Record<string, string> } = {},
) {
  const headers = new Headers(init.headers ?? {});
  return {
    method: init.method ?? "GET",
    url: path.startsWith("http") ? path : `${ORIGIN}${path}`,
    mode: init.mode ?? "cors",
    headers,
  };
}

describe("sw.js routing", () => {
  it("caches hashed build assets, icons and the manifest first", () => {
    expect(sw.classifyRequest(req("/_next/static/chunks/abc123.js"), ORIGIN)).toBe("static");
    expect(sw.classifyRequest(req("/_next/static/css/app.css"), ORIGIN)).toBe("static");
    expect(sw.classifyRequest(req("/_next/static/media/barlow.woff2"), ORIGIN)).toBe("static");
    expect(sw.classifyRequest(req("/icon-192.png"), ORIGIN)).toBe("static");
    expect(sw.classifyRequest(req("/manifest.webmanifest"), ORIGIN)).toBe("static");
    expect(sw.classifyRequest(req("/offline.html"), ORIGIN)).toBe("static");
  });

  it("serves scoring pages network-first", () => {
    const nav = { mode: "navigate" };
    expect(sw.classifyRequest(req("/matches/m1/score", nav), ORIGIN)).toBe("page");
    expect(sw.classifyRequest(req("/matches/m1/score/", nav), ORIGIN)).toBe("page");
    expect(sw.classifyRequest(req("/matches/m1/score?x=1", nav), ORIGIN)).toBe("page");
  });

  it("sends other navigations to the network with an offline page fallback", () => {
    const nav = { mode: "navigate" };
    expect(sw.classifyRequest(req("/dashboard", nav), ORIGIN)).toBe("navigate");
    expect(sw.classifyRequest(req("/matches/m1", nav), ORIGIN)).toBe("navigate");
    expect(sw.classifyRequest(req("/", nav), ORIGIN)).toBe("navigate");
  });

  it("never intercepts writes, APIs, auth helpers, RSC or other origins", () => {
    const never = [
      req("/matches/m1/score", { method: "POST", mode: "navigate" }),
      req("/matches/m1/score", { method: "POST", headers: { "Next-Action": "abc" } }),
      req("/matches/m1/score", { headers: { RSC: "1" } }),
      req("/matches/m1/score?_rsc=xyz"),
      req("/dashboard", { headers: { "Next-Router-Prefetch": "1" } }),
      req("/api/auth/session"),
      req("/api/auth/session", { mode: "navigate" }),
      // The offline queue's replay batches.
      req("/api/scoring/replay", { method: "POST" }),
      req("/api/scoring/replay"),
      req("/__/auth/handler", { mode: "navigate" }),
      req("/__/auth/iframe.js"),
      req("/__/firebase/init.json"),
      req("/_next/image?url=%2Flogo.png&w=64&q=75"),
      req("/sw.js"),
      req("/sw-config.json"),
      req("https://firestore.googleapis.com/google.firestore.v1.Firestore/Listen"),
      req("https://identitytoolkit.googleapis.com/v1/accounts:lookup"),
      req("https://securetoken.googleapis.com/v1/token"),
      req("https://firebasestorage.googleapis.com/v0/b/x/o/logo.png"),
      req("https://cdn.example.com/_next/static/chunks/a.js"),
      req("/matches/m1/live-data.json"),
    ];
    for (const r of never) {
      expect(sw.classifyRequest(r, ORIGIN), `${r.method} ${r.url}`).toBe("bypass");
    }
  });

  it("keys pages by path so query strings share one cached copy", () => {
    expect(sw.pageCacheKey(`${ORIGIN}/matches/m1/score?tab=x`)).toBe(
      `${ORIGIN}/matches/m1/score`,
    );
    expect(sw.pageCacheKey(`${ORIGIN}/matches/m1/score/`)).toBe(
      `${ORIGIN}/matches/m1/score`,
    );
  });

  it("only caches complete same-origin responses", () => {
    const ok = { ok: true, status: 200, type: "basic", redirected: false };
    expect(sw.isCacheable(ok)).toBe(true);
    expect(sw.isCacheable({ ...ok, redirected: true })).toBe(false);
    expect(sw.isCacheable({ ...ok, type: "opaqueredirect", ok: false, status: 0 })).toBe(false);
    expect(sw.isCacheable({ ...ok, ok: false, status: 404 })).toBe(false);
    expect(sw.isCacheable({ ...ok, status: 206 })).toBe(false);
    expect(sw.isCacheable(null)).toBe(false);
  });

  it("names caches after the build in the registration URL", () => {
    const v2 = loadPure("build2");
    expect(sw.STATIC_CACHE).toBe("cricscore-static-build1");
    expect(v2.PAGES_CACHE).toBe("cricscore-pages-build2");
  });

  it("deletes only older CricScore caches", () => {
    const names = [
      "cricscore-static-build1",
      "cricscore-pages-build1",
      "cricscore-static-build2",
      "cricscore-pages-build2",
      "some-other-app",
    ];
    expect(
      sw.staleCaches(names, ["cricscore-static-build2", "cricscore-pages-build2"]),
    ).toEqual(["cricscore-static-build1", "cricscore-pages-build1"]);
  });
});

describe("sw.js lifecycle", () => {
  function loadWorker(config: { disabled: boolean } = { disabled: false }) {
    const listeners: Record<string, (e: unknown) => void> = {};
    const store = new Map<string, Map<string, unknown>>([
      ["cricscore-static-old", new Map()],
      ["cricscore-pages-old", new Map()],
      ["other-app", new Map()],
    ]);
    const caches = {
      keys: vi.fn(async () => [...store.keys()]),
      delete: vi.fn(async (n: string) => store.delete(n)),
      open: vi.fn(async (n: string) => {
        if (!store.has(n)) store.set(n, new Map());
        const c = store.get(n)!;
        return {
          add: async (u: string) => void c.set(u, "res"),
          match: async (u: string) => c.get(u),
          put: async (u: string, r: unknown) => void c.set(u, r),
        };
      }),
      match: vi.fn(),
    };
    const self = {
      location: { href: `${ORIGIN}/sw.js?v=new`, origin: ORIGIN },
      addEventListener: (type: string, fn: (e: unknown) => void) => {
        listeners[type] = fn;
      },
      skipWaiting: vi.fn(),
      clients: { claim: vi.fn(async () => undefined), matchAll: vi.fn(async () => []) },
      registration: { unregister: vi.fn(async () => true) },
    };
    const fetch = vi.fn(async () => ({ ok: true, json: async () => config }));
    vm.runInNewContext(SOURCE, { self, caches, fetch, URL, Response, setTimeout, Promise });
    const run = async (type: string, data?: unknown) => {
      let done: Promise<unknown> = Promise.resolve();
      listeners[type]!({
        data,
        waitUntil: (p: Promise<unknown>) => {
          done = p;
        },
      });
      await done;
    };
    return { run, store, self, listeners, fetch };
  }

  it("precaches the offline page and icons without skipping the wait", async () => {
    const w = loadWorker();
    await w.run("install");
    expect(w.store.get("cricscore-static-new")?.has("/offline.html")).toBe(true);
    expect(w.self.skipWaiting).not.toHaveBeenCalled();
  });

  it("removes the previous build's caches on activate, leaving other apps' caches", async () => {
    const w = loadWorker();
    await w.run("activate");
    expect([...w.store.keys()]).toEqual(["other-app"]);
    expect(w.self.clients.claim).toHaveBeenCalled();
    expect(w.self.registration.unregister).not.toHaveBeenCalled();
  });

  it("fetches a scoring page the page asks it to keep only when it has none", async () => {
    const w = loadWorker();
    const page = `${ORIGIN}/matches/m1/score`;
    w.store.set("cricscore-pages-new", new Map([[page, "cached"]]));
    await w.run("message", { type: "CACHE_URLS", urls: [`${page}?x=1`] });
    expect(w.fetch).not.toHaveBeenCalled();
    await w.run("message", {
      type: "CACHE_URLS",
      urls: [`${ORIGIN}/matches/m2/score`],
    });
    expect(w.fetch).toHaveBeenCalledTimes(1);
  });

  it("activates a waiting update only when the page asks", async () => {
    const w = loadWorker();
    await w.run("message", { type: "SKIP_WAITING" });
    expect(w.self.skipWaiting).toHaveBeenCalledTimes(1);
  });

  it("unregisters itself and clears its caches when sw-config.json disables it", async () => {
    const w = loadWorker({ disabled: true });
    await w.run("activate");
    expect(w.self.registration.unregister).toHaveBeenCalled();
    expect([...w.store.keys()]).toEqual(["other-app"]);
  });
});
