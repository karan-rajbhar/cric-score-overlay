import { afterEach, describe, expect, it, vi } from "vitest";
import {
  loadedAssetUrls,
  removeServiceWorkers,
  serviceWorkerUrl,
  shouldPromptUpdate,
  shouldRegisterServiceWorker,
} from "./service-worker";
import { isIosSafari } from "./install-prompt";

const prod = {
  nodeEnv: "production",
  disabledFlag: undefined,
  protocol: "https:",
  hostname: "cricscore.altorstudio.com",
  supported: true,
};

describe("shouldRegisterServiceWorker", () => {
  it("registers in production builds served over https", () => {
    expect(shouldRegisterServiceWorker(prod)).toBe(true);
  });

  it("never registers in dev or test", () => {
    expect(shouldRegisterServiceWorker({ ...prod, nodeEnv: "development" })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...prod, nodeEnv: "test" })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...prod, nodeEnv: undefined })).toBe(false);
  });

  it("never registers on localhost or plain http", () => {
    for (const hostname of ["localhost", "127.0.0.1", "[::1]", "app.localhost"]) {
      expect(shouldRegisterServiceWorker({ ...prod, hostname })).toBe(false);
    }
    expect(shouldRegisterServiceWorker({ ...prod, protocol: "http:" })).toBe(false);
  });

  it("honours the kill switch and unsupported browsers", () => {
    expect(shouldRegisterServiceWorker({ ...prod, disabledFlag: "true" })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...prod, supported: false })).toBe(false);
    expect(shouldRegisterServiceWorker({ ...prod, disabledFlag: "false" })).toBe(true);
  });
});

describe("serviceWorkerUrl", () => {
  it("versions the script by build", () => {
    expect(serviceWorkerUrl("abc-123")).toBe("/sw.js?v=abc-123");
    expect(serviceWorkerUrl(undefined)).toBe("/sw.js?v=dev");
  });
});

describe("shouldPromptUpdate", () => {
  it("offers the update only when nothing is waiting to sync", () => {
    expect(shouldPromptUpdate({ hasWaitingWorker: true, pendingCount: 0 })).toBe(true);
    expect(shouldPromptUpdate({ hasWaitingWorker: true, pendingCount: 2 })).toBe(false);
    expect(shouldPromptUpdate({ hasWaitingWorker: false, pendingCount: 0 })).toBe(false);
  });
});

describe("loadedAssetUrls", () => {
  it("keeps same-origin build assets only", () => {
    const origin = "https://cricscore.altorstudio.com";
    expect(
      loadedAssetUrls(
        [
          { name: `${origin}/_next/static/chunks/a.js` },
          { name: `${origin}/_next/static/chunks/a.js` },
          { name: `${origin}/_next/static/css/b.css` },
          { name: `${origin}/api/auth/session` },
          { name: "https://firestore.googleapis.com/x" },
          { name: "not a url" },
        ],
        origin,
      ),
    ).toEqual([
      `${origin}/_next/static/chunks/a.js`,
      `${origin}/_next/static/css/b.css`,
    ]);
  });
});

describe("removeServiceWorkers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, "serviceWorker");
  });

  it("unregisters every worker and deletes only CricScore caches", async () => {
    const unregister = vi.fn(async () => true);
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { getRegistrations: async () => [{ unregister }, { unregister }] },
    });
    const del = vi.fn(async () => true);
    vi.stubGlobal("caches", {
      keys: async () => ["cricscore-static-1", "cricscore-pages-1", "other"],
      delete: del,
    });

    expect(await removeServiceWorkers()).toBe(true);
    expect(unregister).toHaveBeenCalledTimes(2);
    expect(del.mock.calls.map((c) => (c as unknown[])[0])).toEqual([
      "cricscore-static-1",
      "cricscore-pages-1",
    ]);
  });
});

describe("isIosSafari", () => {
  it("detects iPhone / iPad Safari but not other iOS browsers", () => {
    const safari =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
    const chrome =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
    const ipad =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
    const android =
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36";
    expect(isIosSafari(safari)).toBe(true);
    expect(isIosSafari(chrome)).toBe(false);
    expect(isIosSafari(ipad, 5)).toBe(true);
    expect(isIosSafari(ipad, 0)).toBe(false);
    expect(isIosSafari(android)).toBe(false);
  });
});
