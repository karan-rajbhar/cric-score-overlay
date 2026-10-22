/**
 * The year-long Cache-Control on write-once uploads
 * (`scripts/migrate-storage-cache-headers.mjs`): the plan picks only the
 * logos and banners still on another header, and finds nothing once
 * applied.
 */

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  IMMUTABLE_CACHE_CONTROL,
  bucketCandidates,
  filesNeedingCacheControl,
} from "../../../scripts/lib/storage-cache-headers.mjs";
import { IMMUTABLE_CACHE_CONTROL as UPLOAD_CACHE_CONTROL } from "./storage";

describe("storage Cache-Control migration", () => {
  it("sets what new uploads get", () => {
    expect(IMMUTABLE_CACHE_CONTROL).toBe(UPLOAD_CACHE_CONTROL);
  });

  it("plans the uploads still on another header, and nothing else", () => {
    const files = [
      {
        name: "team-logos/t1/logo-1.png",
        cacheControl: "public, max-age=3600",
      },
      { name: "club-assets/c1/banner-2.jpg", cacheControl: null },
      { name: "club-assets/c1/logo-3.svg" },
      {
        name: "team-logos/t2/logo-4.webp",
        cacheControl: IMMUTABLE_CACHE_CONTROL,
      },
      { name: "team-logos/", cacheControl: null },
      { name: "sponsors/s1.png", cacheControl: "public, max-age=3600" },
    ];
    const pending = filesNeedingCacheControl(files);
    expect(pending).toEqual([
      "team-logos/t1/logo-1.png",
      "club-assets/c1/banner-2.jpg",
      "club-assets/c1/logo-3.svg",
    ]);
    // Idempotent: once applied, nothing is left.
    const applied = files.map((f) =>
      pending.includes(f.name)
        ? { ...f, cacheControl: IMMUTABLE_CACHE_CONTROL }
        : f,
    );
    expect(filesNeedingCacheControl(applied)).toEqual([]);
  });

  it("tries the configured bucket of this project, then the defaults", () => {
    expect(
      bucketCandidates(
        "cricscore-prod-7411",
        "cricscore-prod-7411.firebasestorage.app",
      ),
    ).toEqual([
      "cricscore-prod-7411.firebasestorage.app",
      "cricscore-prod-7411.appspot.com",
    ]);
    // A bucket from another project's .env.local is never used.
    expect(bucketCandidates("p1", "dev-project.appspot.com")).toEqual([
      "p1.firebasestorage.app",
      "p1.appspot.com",
    ]);
  });
});
