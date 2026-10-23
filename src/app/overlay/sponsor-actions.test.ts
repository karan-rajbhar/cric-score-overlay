// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";

const state: { ds: MemoryDataSource; uid: string | null } = {
  ds: new MemoryDataSource(),
  uid: null,
};
const uploads: { folder: string; path: string; options: unknown }[] = [];

const storage = {
  from(folder: string) {
    return {
      upload: async (path: string, _body: unknown, options: unknown) => {
        uploads.push({ folder, path, options });
        return { data: { path, fullPath: `${folder}/${path}` }, error: null };
      },
      getPublicUrl: (path: string) => ({
        data: { publicUrl: `https://storage.example/${folder}/${path}` },
      }),
      remove: async (paths: string[]) => ({ data: paths, error: null }),
    };
  },
};

vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () =>
    serverClientFor({
      ds: state.ds,
      db: null,
      getUser: async () =>
        state.uid
          ? ({ id: state.uid, email: null, phone: null, user_metadata: {} } as AppUser)
          : null,
      storage: storage as never,
    }),
}));
vi.mock("~/lib/firebase/server-ds", () => ({
  serverDataSource: () => state.ds,
}));

import { getMatchSponsors, uploadSponsorLogo } from "./sponsor-actions";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function form(fields: Record<string, string | string[]>, file?: Blob) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    for (const value of Array.isArray(v) ? v : [v]) f.append(k, value);
  }
  if (file) f.set("file", file);
  return f;
}

describe("sponsor logo actions", () => {
  beforeEach(() => {
    uploads.length = 0;
    state.uid = "owner";
    state.ds = new MemoryDataSource({
      clubs: [{ id: "C1", owner_id: "owner" }],
      matches: [{ id: "m1", club_id: "C1", tournament_id: null }],
    });
  });

  const fields = { scope: "club", scopeId: "C1", name: "Acme", slots: ["corner"] };

  it("uploads to the public sponsor folder with long cache headers", async () => {
    const res = await uploadSponsorLogo(
      form(fields, new Blob([PNG], { type: "image/png" })),
    );
    expect(res.error).toBeNull();
    expect(res.data).toHaveLength(1);
    expect(uploads).toEqual([
      {
        folder: "sponsor-logos",
        path: expect.stringMatching(/^club\/C1\/[\w-]+\.png$/),
        options: expect.objectContaining({
          contentType: "image/png",
          cacheControl: "public, max-age=31536000, immutable",
        }),
      },
    ]);
    // The control room picks them up for the club's matches.
    expect((await getMatchSponsors("m1")).sponsors).toEqual(res.data);
  });

  it("refuses non-admins, oversized files and scripted SVGs", async () => {
    state.uid = "fan";
    expect(
      (await uploadSponsorLogo(form(fields, new Blob([PNG])))).error,
    ).toMatch(/club admins/);

    state.uid = "owner";
    const big = new Uint8Array(1_000_001);
    big.set(PNG);
    expect((await uploadSponsorLogo(form(fields, new Blob([big])))).error).toBe(
      "Logos must be 1 MB or smaller",
    );
    const svg = new Blob(['<svg><script>alert(1)</script></svg>'], {
      type: "image/png",
    });
    expect((await uploadSponsorLogo(form(fields, svg))).error).toMatch(
      /scripts/,
    );
    expect((await uploadSponsorLogo(form(fields))).error).toBe(
      "Choose a logo file",
    );
    expect(uploads).toEqual([]);
  });
});
