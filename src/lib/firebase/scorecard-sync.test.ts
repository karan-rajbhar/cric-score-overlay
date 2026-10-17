import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MemoryDataSource, type Doc } from "./datasource";
import { QueryBuilder } from "./query-builder";
import { remapUserId } from "./rpc/profiles";
import {
  rebuildPlayerMatches,
  syncPlayerMatchesAfterWrite,
} from "./scorecard-sync";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;
const LIVE = seed.matches!.find((m) => m.status === "live")!.id;
const DONE = seed.matches!.find((m) => m.status === "completed")!.id;

const ids = (docs: Doc[]) => docs.map((d) => d.id).sort();

describe("rebuildPlayerMatches", () => {
  it("writes nothing when the records are current", async () => {
    const ds = new MemoryDataSource(seed);
    expect(await rebuildPlayerMatches(ds, DONE)).toEqual({
      written: 0,
      deleted: 0,
    });
  });

  it("adds an innings completed outside the engine (abandoned match)", async () => {
    const ds = new MemoryDataSource(seed);
    const before = ds.all("player_matches").filter((d) => d.match_id === LIVE);
    const builder = new QueryBuilder(
      {
        ds,
        afterWrite: (event) => syncPlayerMatchesAfterWrite(ds, event),
      },
      "innings",
    );
    await builder.update({ is_completed: true }).eq("match_id", LIVE);
    const after = ds.all("player_matches").filter((d) => d.match_id === LIVE);
    expect(after.length).toBeGreaterThanOrEqual(before.length);
    const open = seed.innings!.find(
      (i) => i.match_id === LIVE && !i.is_completed,
    )!;
    const batter = (open.batting as { user_id: string }[])[0]!.user_id;
    const record = after.find((d) => d.user_id === batter)!;
    expect(
      (record.batting as { innings_id: string }[]).some(
        (b) => b.innings_id === open.id,
      ),
    ).toBe(true);
  });

  it("follows a match moved to another season", async () => {
    const ds = new MemoryDataSource(seed);
    const builder = new QueryBuilder(
      { ds, afterWrite: (event) => syncPlayerMatchesAfterWrite(ds, event) },
      "matches",
    );
    await builder.update({ season_id: "season-x" }).eq("id", DONE);
    const records = ds.all("player_matches").filter((d) => d.match_id === DONE);
    expect(records.length).toBeGreaterThan(0);
    expect(records.every((d) => d.season_id === "season-x")).toBe(true);
  });
});

describe("remapUserId", () => {
  it("rewrites the player inside scorecards, the ball log and player records", async () => {
    const ds = new MemoryDataSource(seed);
    const oldId = "550e8400-e29b-41d4-a716-446655440003";
    const newId = "auth-uid-1";
    const recordsBefore = ds
      .all("player_matches")
      .filter((d) => d.user_id === oldId);
    expect(recordsBefore.length).toBeGreaterThan(0);

    await remapUserId(ds, oldId, newId);

    const text = JSON.stringify([
      ds.all("innings"),
      ds.all("overs"),
      ds.all("player_matches"),
    ]);
    expect(text).not.toContain(oldId);
    const recordsAfter = ds
      .all("player_matches")
      .filter((d) => d.user_id === newId);
    expect(ids(recordsAfter)).toEqual(
      ids(recordsBefore)
        .map((id) => id.replace(oldId, newId))
        .sort(),
    );
  });
});
