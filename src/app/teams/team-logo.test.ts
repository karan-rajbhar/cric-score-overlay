import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("~/lib/firebase/live-sync", () => ({
  refreshLiveMatchesFor: vi.fn(),
  refreshLiveState: vi.fn(),
  notifySquadChanged: vi.fn(),
}));
const state: { client: unknown } = { client: null };
vi.mock("~/lib/firebase/server", () => ({
  createServerClient: async () => state.client,
}));

import type { AppUser } from "~/lib/firebase/auth-types";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import { serverClientFor } from "~/lib/firebase/server-client";
import { updateTeamLogo } from "./actions";

const upload = vi.fn(async () => ({ data: {}, error: null }));
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0];

let ds: MemoryDataSource;

beforeEach(() => {
  upload.mockClear();
  ds = new MemoryDataSource({
    teams: [{ id: "t1", name: "Lions", created_by: "cap" }],
  });
  state.client = serverClientFor({
    ds,
    db: null,
    getUser: async () =>
      ({ id: "cap", email: null, phone: null, user_metadata: {} }) as AppUser,
    storage: {
      from: () => ({
        upload,
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://files.example/${path}` },
        }),
      }),
    } as never,
  });
});

describe("updateTeamLogo", () => {
  it("stores the type its bytes show, whatever the browser declared", async () => {
    const file = new File([new Uint8Array(PNG)], "crest.jpg", {
      type: "image/jpeg",
    });
    const res = await updateTeamLogo("t1", file);
    expect(res.error).toBeNull();
    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^t1\/logo-\d+\.png$/),
      expect.any(Uint8Array),
      expect.objectContaining({ contentType: "image/png", immutable: true }),
    );
    expect((await ds.getById("teams", "t1"))?.logo_url).toMatch(/\.png$/);
  });

  it("refuses a scripted SVG and HTML declared as an image", async () => {
    const svg = new File(
      ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
      "crest.svg",
      { type: "image/svg+xml" },
    );
    const html = new File(["<html><body>hi</body></html>"], "crest.png", {
      type: "image/png",
    });
    expect((await updateTeamLogo("t1", svg)).error).toMatch(/scripts/);
    expect((await updateTeamLogo("t1", html)).error).toMatch(/Use a PNG/);
    expect(upload).not.toHaveBeenCalled();
    expect((await ds.getById("teams", "t1"))?.logo_url ?? null).toBeNull();
  });
});
