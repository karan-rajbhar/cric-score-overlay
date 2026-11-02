import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cachedForMetadata,
  clearMetadataCache,
  TITLE_TTL_MS,
} from "./metadata-cache";

beforeEach(() => {
  clearMetadataCache();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("cachedForMetadata", () => {
  it("reads once however many prefetches ask", async () => {
    const load = vi.fn(async () => "Rohan");
    for (let i = 0; i < 40; i++) {
      expect(await cachedForMetadata("player:1", load)).toBe("Rohan");
    }
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("shares one read between requests arriving together", async () => {
    const load = vi.fn(async () => "Rohan");
    const names = await Promise.all(
      Array.from({ length: 22 }, () => cachedForMetadata("player:1", load)),
    );
    expect(new Set(names)).toEqual(new Set(["Rohan"]));
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("keeps separate documents apart", async () => {
    await cachedForMetadata("player:1", async () => "Rohan");
    expect(await cachedForMetadata("player:2", async () => "Omkar")).toBe(
      "Omkar",
    );
  });

  it("reads again once the value has expired", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => "Rohan");
    await cachedForMetadata("player:1", load);
    vi.advanceTimersByTime(TITLE_TTL_MS + 1);
    await cachedForMetadata("player:1", load);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("takes the expiry from the value", async () => {
    vi.useFakeTimers();
    const load = vi.fn(async () => ({ status: "live" }));
    const ttl = (m: { status: string }) => (m.status === "live" ? 1000 : 9000);
    await cachedForMetadata("match:1", load, ttl);
    vi.advanceTimersByTime(1001);
    await cachedForMetadata("match:1", load, ttl);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("does not remember a document that was not found", async () => {
    const load = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("Rohan");
    expect(await cachedForMetadata("player:1", load)).toBeNull();
    expect(await cachedForMetadata("player:1", load)).toBe("Rohan");
  });

  it("does not remember a failure, and the next request can read", async () => {
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("unavailable"))
      .mockResolvedValueOnce("Rohan");
    await expect(cachedForMetadata("player:1", load)).rejects.toThrow();
    expect(await cachedForMetadata("player:1", load)).toBe("Rohan");
  });
});

/**
 * A prefetch runs `generateMetadata`, and a page cannot tell it is one, so a
 * title read outside the cache costs a read for every link in view. This is
 * what the cost tests cannot see: they call the code, not the browser.
 */
describe("generateMetadata on prefetched pages", () => {
  /** Opened by a plain `<a>` or `window.open`, so never prefetched. */
  const NEVER_PREFETCHED = new Set([
    "src/app/matches/[id]/report/page.tsx",
    "src/app/clubs/[id]/stats-report/page.tsx",
  ]);

  const pages = execFileSync("git", ["ls-files", "src/app"], {
    encoding: "utf8",
  })
    .split("\n")
    .filter((f) => /\/page\.tsx$/.test(f))
    .filter((f) => readFileSync(f, "utf8").includes("generateMetadata"));

  it("finds the pages to check", () => {
    expect(pages.length).toBeGreaterThanOrEqual(7);
  });

  it.each(pages.filter((f) => !NEVER_PREFETCHED.has(f)))(
    "%s reads through cachedForMetadata",
    (file) => {
      expect(readFileSync(file, "utf8")).toContain("cachedForMetadata(");
    },
  );
});
