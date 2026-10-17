/**
 * The statistics documents (`player_career_stats`, `leaderboards`) are
 * maintained incrementally; these tests prove they always equal a rebuild
 * from the stored `player_matches` records:
 *
 * 1. stats.mjs: random add / replace / remove sequences (with exact ties on
 *    best innings and spells) folded incrementally equal `accOf`.
 * 2. applyStatsChanges: random record changes across matches, tournaments,
 *    clubs and players, starting with and without stored documents.
 * 3. Golden replays (every synthetic session, including undo across an
 *    innings end, edits to completed innings, super overs and recompute)
 *    played twice in the same tournament / club, so the second match
 *    updates documents the first one built; and every seed match replayed
 *    ball by ball on top of the whole seed.
 * 4. Profile changes refresh leaderboard names, rosters and memberships.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "./datasource";
import { canonicalJson, inningsSummaryOf } from "./derive.mjs";
import { derivedFieldsDataSource } from "./derived-fields";
import { QueryBuilder } from "./query-builder";
import { remapUserId } from "./rpc/profiles";
import { builderContextFor } from "./server-client";
import { DataSourceScoringTx } from "./scoring/tx";
import {
  GoldenReplay,
  replaySeedMatch,
  rostersFrom,
  seedMatchIds,
  SYNTHETIC_ROSTERS,
  SYNTHETIC_SCENARIOS,
  syntheticTables,
  type Seed,
} from "./scoring/__fixtures__/golden";
import { legacySeedOf, stage2Driver } from "./scoring/__fixtures__/stage2";
import { applyStatsChanges } from "./stats-sync";
import {
  accOf,
  applyPlayerMatch,
  emptyAcc,
  rebuildStats,
  replacePlayerMatch,
  type StatsAcc,
} from "./stats.mjs";
import type { PlayerMatchesRow } from "./types";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Seed;

/** Small deterministic PRNG (mulberry32). */
function rng(seedValue: number) {
  let a = seedValue >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Records drawn from few distinct lines, so exact ties are common. */
function randomRecord(
  r: () => number,
  matchId: string,
  userId: string,
  scope: { tournament_id: string | null; club_id: string | null },
): PlayerMatchesRow {
  const pick = <T>(xs: T[]) => xs[Math.floor(r() * xs.length)]!;
  const innings = r() < 0.3 ? ["i1", "i2"] : [pick(["i1", "i2"])];
  const batting =
    r() < 0.75
      ? innings.map((i) => ({
          innings_id: `${matchId}_${i}`,
          innings_number: i === "i1" ? 1 : 2,
          user_id: userId,
          batting_position: 1,
          runs_scored: pick([0, 12, 30, 30, 51, 104]),
          balls_faced: pick([0, 10, 20, 20]),
          minutes_batted: 0,
          fours: pick([0, 2]),
          sixes: pick([0, 1]),
          is_out: r() < 0.6,
          dismissal_type: null,
          bowler_id: null,
          fielder_id: null,
          is_current_batsman: false,
          is_striker: false,
        }))
      : [];
  const bowling =
    r() < 0.6
      ? [
          {
            innings_id: `${matchId}_${pick(["i1", "i2"])}`,
            innings_number: 1,
            user_id: userId,
            overs_bowled: 0,
            balls_bowled: pick([6, 12, 24]),
            runs_conceded: pick([10, 18, 18, 40]),
            wickets_taken: pick([0, 1, 3, 3, 5]),
            maidens: pick([0, 1]),
            wides: 0,
            no_balls: 0,
            is_current_bowler: false,
          },
        ]
      : [];
  return {
    id: `${matchId}_${userId}`,
    user_id: userId,
    match_id: matchId,
    tournament_id: scope.tournament_id,
    club_id: scope.club_id,
    season_id: null,
    match_date: null,
    batting: batting as never,
    bowling: bowling as never,
    fielding: {
      catches: pick([0, 0, 1, 2]),
      stumpings: pick([0, 0, 1]),
      run_outs: pick([0, 1]),
    },
    updated_at: null,
  };
}

function dump(docs: object[]): string[] {
  return docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.last_updated;
      delete c.updated_at;
      return canonicalJson(c);
    })
    .sort();
}

function expectMatchesRebuild(ds: MemoryDataSource) {
  const rebuilt = rebuildStats(
    ds.all("player_matches") as unknown as PlayerMatchesRow[],
    new Map(ds.all("users").map((u) => [u.id, u])),
    "x",
  );
  expect(dump(ds.all("player_career_stats"))).toEqual(dump(rebuilt.careers));
  expect(dump(ds.all("leaderboards"))).toEqual(dump(rebuilt.leaderboards));
}

describe("stats accumulators", () => {
  it("fold, replace and remove exactly (ties and best removal included)", () => {
    const r = rng(7);
    for (let run = 0; run < 200; run += 1) {
      const current = new Map<string, PlayerMatchesRow>();
      let acc: StatsAcc = emptyAcc();
      for (let step = 0; step < 25; step += 1) {
        const matchId = `m${Math.floor(r() * 6)}`;
        const prev = current.get(matchId) ?? null;
        const next =
          r() < 0.25
            ? null
            : randomRecord(r, matchId, "u", {
                tournament_id: "t",
                club_id: null,
              });
        if (next) current.set(matchId, next);
        else current.delete(matchId);
        if (!replacePlayerMatch(acc, prev, next))
          acc = accOf([...current.values()]);
        expect(acc).toEqual(accOf([...current.values()]));
      }
    }
  });

  it("removing every record leaves an empty accumulator", () => {
    const r = rng(3);
    const records = [1, 2, 3].map((i) =>
      randomRecord(r, `m${i}`, "u", { tournament_id: null, club_id: null }),
    );
    const acc = accOf(records);
    for (const rec of records) applyPlayerMatch(acc, rec, -1);
    expect(acc).toEqual(emptyAcc());
  });
});

describe("applyStatsChanges equals a rebuild", () => {
  const scopes = [
    { tournament_id: "t1", club_id: "c1" },
    { tournament_id: "t2", club_id: "c1" },
    { tournament_id: null, club_id: "c2" },
    { tournament_id: null, club_id: null },
  ];
  for (const startEmpty of [true, false]) {
    it(`random changes${startEmpty ? "" : " on stored documents"}`, async () => {
      const r = rng(startEmpty ? 11 : 12);
      const users = ["u1", "u2", "u3", "u4", "u5"].map((id) => ({
        id,
        full_name: `Player ${id}`,
        avatar_url: null,
      }));
      const ds = new MemoryDataSource({ users });
      if (!startEmpty) {
        // Pre-existing records with their statistics already built.
        const pms = Array.from({ length: 12 }, (_, i) =>
          randomRecord(r, `pre${i}`, users[i % 5]!.id, scopes[i % 4]!),
        );
        await ds.insert("player_matches", pms as unknown as Doc[]);
        const built = rebuildStats(
          pms,
          new Map(users.map((u) => [u.id, u])),
          "x",
        );
        await ds.insert(
          "player_career_stats",
          built.careers as unknown as Doc[],
        );
        await ds.insert("leaderboards", built.leaderboards as unknown as Doc[]);
      }
      for (let step = 0; step < 150; step += 1) {
        const t = new DataSourceScoringTx(ds);
        const changes = [];
        const matchId = `m${Math.floor(r() * 5)}`;
        const scope = scopes[Math.floor(r() * scopes.length)]!;
        for (const u of users) {
          if (r() < 0.5) continue;
          const id = `${matchId}_${u.id}`;
          const before = ((await ds.getById("player_matches", id)) ??
            null) as unknown as PlayerMatchesRow | null;
          const after =
            r() < 0.3 ? null : randomRecord(r, matchId, u.id, scope);
          if (!before && !after) continue;
          if (after) t.put("player_matches", id, after);
          else t.delete("player_matches", id);
          changes.push({ before, after });
        }
        await applyStatsChanges(t, changes, "now");
        await t.commit();
        expectMatchesRebuild(ds);
      }
    });
  }
});

describe("incremental statistics through the scoring engine", () => {
  for (const scenario of SYNTHETIC_SCENARIOS) {
    it(`${scenario.name}: played twice in one tournament and club`, async () => {
      const tables = syntheticTables(scenario.overrides);
      const base = tables.matches![0]!;
      base.club_id = "C1";
      const inn = tables.innings![0]!;
      for (const [id, tournament] of [
        ["M2", "T1"],
        ["M3", "T2"],
      ] as const) {
        tables.matches!.push({
          ...structuredClone(base),
          id,
          tournament_id: tournament,
          innings_summary: inningsSummaryOf([{ ...inn, id: `${id}_INN1` }]),
        });
        tables.innings!.push({
          ...structuredClone(inn),
          id: `${id}_INN1`,
          match_id: id,
        });
      }
      tables.tournaments!.push({ id: "T2", name: "Plate" });
      const side = stage2Driver(tables, true);
      for (const matchId of ["M", "M2", "M3"]) {
        const replay = new GoldenReplay(side, matchId, SYNTHETIC_ROSTERS);
        replay.afterStep = async () => expectMatchesRebuild(side.ds);
        for (const step of scenario.steps) {
          if (
            !scenario.continueWhenOver &&
            step.kind === "ball" &&
            (await replay.isOver())
          ) {
            break;
          }
          await replay.step(step);
        }
      }
    }, 60_000);
  }

  const legacy = legacySeedOf(seed);
  for (const matchId of seedMatchIds(legacy)) {
    it(`replays seed match ${matchId.slice(-3)} on top of the whole seed`, async () => {
      const tables: Seed = structuredClone(legacy);
      // Reset the match to its first ball; everything else stays.
      const match = tables.matches!.find((m) => m.id === matchId)!;
      Object.assign(match, {
        status: "live",
        current_innings: 1,
        current_over: 0,
        current_ball: 0,
        last_ball_seq: 0,
        result_type: null,
        result_description: null,
        winning_team_id: null,
        win_margin: null,
        win_margin_type: null,
        created_by: "admin-user",
      });
      const first = tables.innings!.find(
        (i) => i.match_id === matchId && i.innings_number === 1,
      )!;
      Object.assign(first, {
        total_runs: 0,
        total_wickets: 0,
        total_overs: 0,
        total_balls: 0,
        extras_total: 0,
        extras_byes: 0,
        extras_leg_byes: 0,
        extras_wides: 0,
        extras_no_balls: 0,
        extras_penalties: 0,
        extras_bonuses: 0,
        is_completed: false,
        target_runs: null,
      });
      tables.innings = tables.innings!.filter(
        (i) => i.match_id !== matchId || i.id === first.id,
      );
      match.innings_summary = inningsSummaryOf([first]);
      for (const t of [
        "batting_performances",
        "bowling_performances",
        "fall_of_wickets",
        "partnerships",
        "ball_by_ball",
      ]) {
        tables[t] = tables[t]!.filter((row) => row.match_id !== matchId);
      }
      const side = stage2Driver(tables, true);
      // Statistics of everything else, as the migration builds them.
      for (const t of ["player_career_stats", "leaderboards"]) {
        for (const d of side.ds.all(t)) await side.ds.delete(t, d.id);
      }
      const built = rebuildStats(
        side.ds.all("player_matches") as unknown as PlayerMatchesRow[],
        new Map(side.ds.all("users").map((u) => [u.id, u])),
        "x",
      );
      await side.ds.insert(
        "player_career_stats",
        built.careers as unknown as Doc[],
      );
      await side.ds.insert(
        "leaderboards",
        built.leaderboards as unknown as Doc[],
      );

      const replay = new GoldenReplay(side, matchId, rostersFrom(legacy));
      let steps = 0;
      replay.afterStep = async () => {
        steps += 1;
        expectMatchesRebuild(side.ds);
      };
      await replaySeedMatch(replay, legacy, matchId);
      expect(steps).toBeGreaterThan(50);
    }, 120_000);
  }
});

describe("builder writes", () => {
  it("abandoning, moving and deleting matches keep records, statistics and summaries in step", async () => {
    const memory = new MemoryDataSource(structuredClone(seed));
    const { ctx } = builderContextFor(memory, null);
    const from = (t: string) => new QueryBuilder(ctx, t as "matches");
    const live = seed.matches!.find((m) => m.status === "live")!;
    // Abandon: every innings completed (records + statistics follow).
    await from("matches").update({ status: "abandoned" }).eq("id", live.id);
    await from("innings")
      .update({ is_completed: true })
      .eq("match_id", live.id);
    expectMatchesRebuild(memory);
    const match = (await memory.getById("matches", live.id))!;
    expect(match.innings_summary).toEqual(
      inningsSummaryOf(
        memory.all("innings").filter((i) => i.match_id === live.id),
      ),
    );
    // Moving a match to another tournament moves its statistics.
    const other = seed.tournaments!.find((t) => t.id !== live.tournament_id)!;
    await from("matches").update({ tournament_id: other.id }).eq("id", live.id);
    expectMatchesRebuild(memory);
    expect(
      ((await memory.getById("matches", live.id))!.tournament_snapshot as Doc)
        .name,
    ).toBe(other.name);
    // Deleting it removes them.
    await from("matches").delete().eq("id", live.id);
    expect(
      memory.all("player_matches").some((p) => p.match_id === live.id),
    ).toBe(false);
    expectMatchesRebuild(memory);
  });
});

describe("profile changes", () => {
  it("refresh leaderboard names, team rosters and club memberships", async () => {
    const memory = new MemoryDataSource(structuredClone(seed));
    const ds = derivedFieldsDataSource(memory);
    const board = memory.all("leaderboards")[0]!;
    const userId = Object.keys(board.players as object)[0]!;
    await ds.update("users", userId, { full_name: "Renamed Player" });

    const after = (await memory.getById("leaderboards", board.id))!;
    expect((after.players as Record<string, Doc>)[userId]!.name).toBe(
      "Renamed Player",
    );
    for (const team of memory.all("teams")) {
      for (const entry of team.roster as Doc[]) {
        if (entry.user_id === userId) {
          expect((entry.user as Doc).full_name).toBe("Renamed Player");
        }
      }
    }
    for (const m of memory.all("club_memberships")) {
      if (m.user_id === userId) {
        expect((m.user_snapshot as Doc).full_name).toBe("Renamed Player");
      }
    }
    const user = (await memory.getById("users", userId))!;
    expect(user.name_lower).toBe("renamed player");
    expect(user.search_prefixes).toContain("ren");
    expect(user.search_prefixes).toContain("renamed pl");
  });

  it("re-mapping a profile moves its records, statistics and names", async () => {
    const memory = new MemoryDataSource(structuredClone(seed));
    const ds = derivedFieldsDataSource(memory);
    const board = memory.all("leaderboards")[0]!;
    const oldId = Object.keys(board.players as object)[0]!;
    const name = memory.all("users").find((u) => u.id === oldId)!.full_name;
    await remapUserId(ds, oldId, "new-auth-uid");

    expect(memory.all("player_matches").some((p) => p.user_id === oldId)).toBe(
      false,
    );
    expectMatchesRebuild(memory);
    const after = (await memory.getById("leaderboards", board.id))!;
    const players = after.players as Record<string, Doc>;
    expect(players[oldId]).toBeUndefined();
    expect(players["new-auth-uid"]!.name).toBe(name);
    expect(await memory.getById("player_career_stats", oldId)).toBeNull();
    for (const team of memory.all("teams")) {
      for (const entry of team.roster as Doc[]) {
        expect(entry.user_id).not.toBe(oldId);
        if (entry.user_id === "new-auth-uid") {
          expect((entry.user as Doc).full_name).toBe(name);
        }
      }
    }
  });

  it("adding a player to a team refreshes its roster", async () => {
    const memory = new MemoryDataSource(structuredClone(seed));
    const ds = derivedFieldsDataSource(memory);
    const team = memory.all("teams")[0]!;
    const outsider = memory
      .all("users")
      .find((u) => !(team.roster as Doc[]).some((e) => e.user_id === u.id))!;
    await ds.insert("team_players", [
      {
        id: "tp-new",
        team_id: team.id,
        user_id: outsider.id,
        created_at: null,
      },
    ]);
    const roster = (await memory.getById("teams", team.id))!.roster as Doc[];
    const entry = roster.find((e) => e.id === "tp-new")!;
    expect((entry.user as Doc).full_name).toBe(outsider.full_name);
    await ds.delete("team_players", "tp-new");
    const again = (await memory.getById("teams", team.id))!.roster as Doc[];
    expect(again.some((e) => e.id === "tp-new")).toBe(false);
    expect(again).toEqual(team.roster);
  });
});
