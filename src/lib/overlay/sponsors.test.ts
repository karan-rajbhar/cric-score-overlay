import { describe, expect, it, vi } from "vitest";
import { MemoryDataSource } from "~/lib/firebase/datasource";
import type { Sponsor } from "~/lib/firebase/types";
import {
  addSponsor,
  canManageSponsors,
  overlaySponsorItems,
  removeSponsor,
  resolveMatchSponsors,
  updateSponsors,
  type SponsorLogoStore,
} from "./sponsors";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fakeStore() {
  const files = new Map<string, string>();
  const store: SponsorLogoStore = {
    upload: vi.fn(async (path: string, _bytes: Uint8Array, type: string) => {
      files.set(path, type);
      return `https://cdn.example/${path}`;
    }),
    remove: vi.fn(async (paths: string[]) => {
      for (const p of paths) files.delete(p);
    }),
  };
  return { store, files };
}

const sponsor = (id: string, slots: Sponsor["slots"] = ["corner"]) => ({
  id,
  name: id.toUpperCase(),
  logo_url: `https://cdn.example/${id}.png`,
  slots,
});

describe("sponsor logos", () => {
  it("uploads a checked logo once and appends the sponsor", async () => {
    const ds = new MemoryDataSource({ clubs: [{ id: "C1", owner_id: "o" }] });
    const { store, files } = fakeStore();
    const list = await addSponsor(ds, store, "club", "C1", {
      name: "  Acme  Paints ",
      slots: ["break", "bogus", "corner", "corner"],
      bytes: PNG,
    });
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      name: "Acme Paints",
      slots: ["corner", "break"],
    });
    expect(list[0]!.logo_url).toBe(
      `https://cdn.example/club/C1/${list[0]!.id}.png`,
    );
    expect([...files.values()]).toEqual(["image/png"]);
    expect((await ds.getById("clubs", "C1"))!.sponsors).toEqual(list);
  });

  it("refuses a bad file before storing anything", async () => {
    const ds = new MemoryDataSource({ clubs: [{ id: "C1" }] });
    const { store } = fakeStore();
    await expect(
      addSponsor(ds, store, "club", "C1", {
        name: "X",
        slots: [],
        bytes: new TextEncoder().encode("<svg onload='x()'/>"),
      }),
    ).rejects.toThrow(/scripts/);
    expect(store.upload).not.toHaveBeenCalled();
  });

  it("renames, re-slots and reorders, keeping the stored logo URLs", async () => {
    const ds = new MemoryDataSource({
      tournaments: [{ id: "T1", sponsors: [sponsor("a"), sponsor("b")] }],
    });
    const out = await updateSponsors(ds, "tournament", "T1", [
      { id: "b", name: "Bee", slots: ["over_end"] },
      { id: "a", name: "A", slots: [] },
    ]);
    expect(out.map((s) => [s.id, s.name, s.slots, s.logo_url])).toEqual([
      ["b", "Bee", ["over_end"], "https://cdn.example/b.png"],
      ["a", "A", [], "https://cdn.example/a.png"],
    ]);
    // A stale or partial list is refused rather than dropping sponsors.
    await expect(
      updateSponsors(ds, "tournament", "T1", [{ id: "a", name: "A", slots: [] }]),
    ).rejects.toThrow(/changed meanwhile/);
  });

  it("removes a sponsor and its file", async () => {
    const ds = new MemoryDataSource({
      clubs: [{ id: "C1", sponsors: [sponsor("a"), sponsor("b")] }],
    });
    const { store } = fakeStore();
    const out = await removeSponsor(ds, store, "club", "C1", "a");
    expect(out.map((s) => s.id)).toEqual(["b"]);
    expect(store.remove).toHaveBeenCalledWith(
      expect.arrayContaining(["club/C1/a.png", "club/C1/a.svg"]),
    );
  });

  it("lets club admins and tournament organisers manage them", async () => {
    const ds = new MemoryDataSource({
      clubs: [{ id: "C1", owner_id: "owner" }],
      club_memberships: [
        {
          id: "cm",
          club_id: "C1",
          user_id: "admin",
          role: "admin",
          status: "active",
        },
      ],
      tournaments: [{ id: "T1", created_by: "organiser", club_id: "C1" }],
    });
    expect(await canManageSponsors(ds, "club", "C1", "owner")).toBe(true);
    expect(await canManageSponsors(ds, "club", "C1", "admin")).toBe(true);
    expect(await canManageSponsors(ds, "club", "C1", "fan")).toBe(false);
    expect(await canManageSponsors(ds, "tournament", "T1", "organiser")).toBe(
      true,
    );
    expect(await canManageSponsors(ds, "tournament", "T1", "admin")).toBe(true);
    expect(await canManageSponsors(ds, "tournament", "T1", "fan")).toBe(false);
  });
});

describe("resolveMatchSponsors", () => {
  const tables = () => ({
    clubs: [
      { id: "C1", sponsors: [sponsor("club-a")] },
      { id: "C2", sponsors: [sponsor("cup-club")] },
      { id: "C3", sponsors: [] },
    ],
    tournaments: [
      { id: "T1", club_id: "C2", sponsors: [sponsor("cup", ["break"])] },
      { id: "T2", club_id: "C2", sponsors: [] },
    ],
    matches: [
      { id: "m-tour", club_id: "C1", tournament_id: "T1" },
      { id: "m-club", club_id: "C1", tournament_id: "T2" },
      { id: "m-tclub", club_id: null, tournament_id: "T2" },
      { id: "m-none", club_id: "C3", tournament_id: null },
    ],
  });

  it("prefers the tournament's sponsors", async () => {
    const ds = new MemoryDataSource(tables());
    const out = await resolveMatchSponsors(ds, "m-tour");
    expect(out.source).toBe("tournament");
    expect(out.sourceId).toBe("T1");
    expect(out.sponsors.map((s) => s.id)).toEqual(["cup"]);
  });

  it("falls back to the match's club, then the tournament's club", async () => {
    const ds = new MemoryDataSource(tables());
    expect(await resolveMatchSponsors(ds, "m-club")).toMatchObject({
      source: "club",
      sourceId: "C1",
    });
    expect(await resolveMatchSponsors(ds, "m-tclub")).toMatchObject({
      source: "club",
      sourceId: "C2",
    });
  });

  it("has none when nobody uploaded any, or the match is gone", async () => {
    const ds = new MemoryDataSource(tables());
    const none = { source: null, sourceId: null, sponsors: [] };
    expect(await resolveMatchSponsors(ds, "m-none")).toEqual(none);
    expect(await resolveMatchSponsors(ds, "missing")).toEqual(none);
  });

  it("costs at most 3 reads, 2 with the match loaded", async () => {
    const ds = new MemoryDataSource(tables());
    await resolveMatchSponsors(ds, "m-tclub");
    expect(ds.billedReads).toBe(3);
    const before = ds.billedReads;
    await resolveMatchSponsors(ds, {
      id: "m-club",
      club_id: "C1",
      tournament_id: "T2",
    });
    expect(ds.billedReads - before).toBe(2);
  });

  it("maps sponsors to overlay items, optionally for one slot", () => {
    const list = [sponsor("a", ["corner"]), sponsor("b", ["break"])];
    expect(overlaySponsorItems(list)).toEqual([
      { id: "a", name: "A", logoUrl: "https://cdn.example/a.png" },
      { id: "b", name: "B", logoUrl: "https://cdn.example/b.png" },
    ]);
    expect(overlaySponsorItems(list, "break").map((s) => s.id)).toEqual(["b"]);
  });
});
