import { afterEach, describe, expect, it, vi } from "vitest";
import { appRewrites, firebaseAuthProxyRewrites } from "./lib/next-rewrites.mjs";

// Not next.config.mjs itself: App Hosting replaces it at build time with a
// wrapper exporting only the default config (see next-rewrites.mjs).
async function rewrites() {
  return appRewrites();
}

describe("next.config rewrites", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("proxies Firebase auth helpers to firebaseapp.com in production", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATOR", "false");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "cricscore-prod-7411");

    const { beforeFiles } = await rewrites();
    expect(beforeFiles).toEqual([
      {
        source: "/__/auth/:path*",
        destination:
          "https://cricscore-prod-7411.firebaseapp.com/__/auth/:path*",
      },
      {
        source: "/__/firebase/:path*",
        destination:
          "https://cricscore-prod-7411.firebaseapp.com/__/firebase/:path*",
      },
    ]);
  });

  it("adds no proxy when using the emulators", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATOR", "true");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "demo-cricscore");

    expect((await rewrites()).beforeFiles).toEqual([]);
  });

  it("adds no proxy without a project id", async () => {
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_USE_EMULATOR", "false");
    vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "");

    expect(firebaseAuthProxyRewrites()).toEqual([]);
  });

  it("keeps the @handle profile rewrite", async () => {
    expect((await rewrites()).afterFiles).toEqual([
      {
        source: "/:handle(@[a-zA-Z0-9_]{3,30})",
        destination: "/players/:handle",
      },
    ]);
  });
});
