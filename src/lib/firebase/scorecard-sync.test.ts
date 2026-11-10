import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FOLLOWS } from "~/lib/follows/store";
import { BALL_LOGS_COLLECTION } from "./ball-log-archive";
import { MemoryDataSource, type Doc } from "./datasource";
import { derivedFieldsDataSource } from "./derived-fields";
import {
  decodeLiveScorecard,
  LIVE_SCORECARD_COLLECTION,
  type LiveScorecardDoc,
} from "./live-scorecard";
import { matchBallLog } from "./match-ball-log";
import { QueryBuilder } from "./query-builder";
import { remapUserId } from "./rpc/profiles";
import { ensureLiveScorecard } from "./scorecard-refresh";
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

  it("leaves no document naming the old id: archives, live scorecards, follows", async () => {
    const raw = new MemoryDataSource(seed);
    const ds = derivedFieldsDataSource(raw);
    const innings = seed.innings!.filter((i) => i.match_id === DONE);
    const oldId = (innings[0]!.batting as { user_id: string }[])[0]!.user_id;
    const newId = "auth-uid-2";
    // Archives built, live scorecards in place, a follower of the player.
    const before = await matchBallLog({ ds }, DONE);
    expect(JSON.stringify(before)).toContain(oldId);
    expect(raw.all(BALL_LOGS_COLLECTION).length).toBeGreaterThan(0);
    for (const match of [DONE, LIVE]) await ensureLiveScorecard(ds, match);
    await ds.insert(FOLLOWS, [
      {
        id: "fan",
        user_id: "fan",
        targets: ["team:t-1", `player:${oldId}`, "match:m-1"],
      },
    ]);

    await remapUserId(ds, oldId, newId);

    const after = JSON.stringify(await matchBallLog({ ds }, DONE));
    expect(after).not.toContain(oldId);
    expect(after).toContain(newId);
    const tables = [
      ...Object.keys(seed),
      BALL_LOGS_COLLECTION,
      LIVE_SCORECARD_COLLECTION,
      FOLLOWS,
    ];
    const naming = tables.filter((t) =>
      JSON.stringify(raw.all(t)).includes(oldId),
    );
    expect(naming).toEqual([]);
    // The rebuilt scorecard names the player under the new id.
    const card = (await ds.getById(LIVE_SCORECARD_COLLECTION, DONE))!;
    expect(
      decodeLiveScorecard(card as unknown as LiveScorecardDoc).names[newId],
    ).toBe((await ds.getById("users", newId))!.full_name);
    expect((await ds.getById(FOLLOWS, "fan"))!.targets).toEqual([
      "team:t-1",
      `player:${newId}`,
      "match:m-1",
    ]);
  });
});
