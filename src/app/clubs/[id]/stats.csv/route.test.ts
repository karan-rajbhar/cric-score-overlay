import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const load = vi.fn();
vi.mock("~/lib/firebase/club-stats-data", () => ({
  loadClubStatsExport: (id: string) => load(id),
}));

import { GET } from "./route";

const call = (id: string, query = "") =>
  GET(new Request(`http://x/clubs/${id}/stats.csv${query}`), {
    params: Promise.resolve({ id }),
  });

describe("GET /clubs/[id]/stats.csv", () => {
  beforeEach(() => load.mockReset());

  it("404s for a club that is missing or private to the viewer", async () => {
    load.mockResolvedValue(null);
    expect((await call("nope")).status).toBe(404);
  });

  it("sends the statistics as a download, not cached", async () => {
    load.mockResolvedValue({
      club: { id: "c1", name: "Unity Cricket Club", short_name: "UCC" },
      rows: [],
      matches: 0,
    });
    const res = await call("c1");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/^text\/csv/);
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain(
      encodeURIComponent("Unity Cricket Club – statistics"),
    );
    expect(res.headers.get("cache-control")).toContain("no-store");
    // text() strips the byte order mark Excel needs: check the bytes.
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(new TextDecoder().decode(bytes.slice(3))).toMatch(/^Rank,Player,/);
  });

  it("sends one leaderboard tab with ?tab=", async () => {
    const { leaderboardFromPlayers } = await import("~/lib/leaderboard");
    const { emptyAcc } = await import("~/lib/firebase/stats.mjs");
    const data = leaderboardFromPlayers({
      b: {
        ...emptyAcc(),
        m: 3,
        wi: 3,
        wb: 54,
        rc: 60,
        w: 7,
        wp: 140,
        name: "Bala",
        avatar_url: null,
      },
    });
    load.mockResolvedValue({
      club: { id: "c1", name: "Unity Cricket Club", short_name: null },
      data,
      rows: [],
      matches: 1,
    });
    const res = await call("c1", "?tab=bowling");
    expect(res.headers.get("content-disposition")).toContain(
      encodeURIComponent("Unity Cricket Club – bowling"),
    );
    const text = new TextDecoder().decode(
      new Uint8Array(await res.arrayBuffer()).slice(3),
    );
    expect(text).toMatch(/^Rank,Player,Matches,Innings,Overs/);
    expect(text).toContain("Bala");
    // An unknown tab falls back to the combined statistics.
    const all = await call("c1", "?tab=nonsense");
    expect(all.headers.get("content-disposition")).toContain(
      encodeURIComponent("statistics"),
    );
  });
});
