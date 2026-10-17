import { afterEach, describe, expect, it, vi } from "vitest";
import config, { firebaseAuthProxyRewrites } from "../next.config.mjs";

type RewriteGroups = {
  beforeFiles: { source: string; destination: string }[];
  afterFiles: { source: string; destination: string }[];
};

async function rewrites(): Promise<RewriteGroups> {
  return (await config.rewrites!()) as unknown as RewriteGroups;
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
