import { describe, expect, it } from "vitest";
import {
  planMergePlayers,
  verifyStats,
} from "../../../scripts/lib/merge-players.mjs";
import { applyStage3, planStage3 } from "../../../scripts/lib/stage3.mjs";
import type { Doc } from "./datasource";

const KEEP = "keep-1";
const DUP = "dup-1";
const user = (id: string, name: string): Doc => ({
  id,
  full_name: name,
  username: id,
  name_lower: name.toLowerCase(),
});
const batting = (userId: string, runs: number) => ({
  user_id: userId,
  runs_scored: runs,
  balls_faced: runs,
});
const pm = (matchId: string, userId: string, runs: number): Doc => ({
  id: `${matchId}_${userId}`,
  match_id: matchId,
  user_id: userId,
  batting: [{ runs_scored: runs, is_out: true, balls_faced: runs }],
});

/** The data with the statistics documents the app would have stored. */
function data(): Record<string, Doc[]> {
  const raw = rawData();
  return applyStage3(raw, planStage3(raw)) as Record<string, Doc[]>;
}

function rawData(): Record<string, Doc[]> {
  return {
    users: [user(KEEP, "Amit"), user(DUP, "Amit"), user("x", "Xavier")],
    users_private: [{ id: DUP, email: "a@players.local" }],
    teams: [{ id: "t1", name: "T1" }],
    team_players: [
      { id: "tp1", team_id: "t1", user_id: KEEP },
      { id: "tp2", team_id: "t1", user_id: DUP },
      { id: "tp3", team_id: "t2", user_id: DUP },
    ],
    matches: [{ id: "m1" }, { id: "m2" }],
    innings: [
      { id: "i1", match_id: "m1", batting: [batting(KEEP, 30)] },
      { id: "i2", match_id: "m2", batting: [batting(DUP, 12)] },
    ],
    overs: [{ id: "i2_0", balls: [{ striker_id: DUP }] }],
    player_matches: [pm("m1", KEEP, 30), pm("m2", DUP, 12)],
    player_career_stats: [],
  };
}

describe("planMergePlayers", () => {
  const plan = planMergePlayers(data(), { [DUP]: KEEP });
  const after = (t: string) => plan.after[t] ?? [];

  it("points every record at the survivor and removes the duplicate", () => {
    expect(plan.conflicts).toEqual([]);
    expect(JSON.stringify(plan.after)).not.toContain(DUP);
    expect(
      after("users")
        .map((u) => u.id)
        .sort(),
    ).toEqual([KEEP, "x"]);
    expect(after("overs")[0]!.balls[0].striker_id).toBe(KEEP);
    expect(
      after("player_matches")
        .map((p) => p.id)
        .sort(),
    ).toEqual([`m1_${KEEP}`, `m2_${KEEP}`]);
  });

  it("keeps one squad row per team and moves the rest", () => {
    const rows = after("team_players");
    expect(rows.filter((r) => r.team_id === "t1")).toHaveLength(1);
    expect(rows.find((r) => r.team_id === "t2")!.user_id).toBe(KEEP);
  });

  it("rebuilds career stats as the sum of the parts", () => {
    const career = after("player_career_stats").find((c) => c.id === KEEP)!;
    expect(career.total_runs).toBe(42);
    expect(career.total_matches).toBe(2);
    expect(verifyStats(data(), plan.after, { [DUP]: KEEP })).toEqual([]);
  });

  it("deletes what it renamed or removed, and writes what changed", () => {
    const gone = plan.deletes.map((d) => `${d.table}/${d.id}`);
    expect(gone).toEqual(
      expect.arrayContaining([
        `users/${DUP}`,
        `users_private/${DUP}`,
        `player_matches/m2_${DUP}`,
        "team_players/tp2",
      ]),
    );
    expect(plan.writes.map((w) => `${w.table}/${w.doc.id}`)).toContain(
      `player_matches/m2_${KEEP}`,
    );
  });

  it("is a no-op once merged (idempotent)", () => {
    const merged = applyStage3(plan.after, plan.stage3);
    const again = planMergePlayers(merged, { [DUP]: KEEP });
    expect(again.conflicts.length).toBeGreaterThan(0); // duplicate is gone
  });

  it("refuses a pair that played the same match", () => {
    const d = data();
    d.player_matches = [pm("m1", KEEP, 30), pm("m1", DUP, 5)];
    const bad = planMergePlayers(d, { [DUP]: KEEP });
    expect(bad.conflicts.join("\n")).toMatch(/twice|played together/);
  });

  it("refuses a missing survivor or a chain", () => {
    expect(
      planMergePlayers(data(), { [DUP]: "nobody" }).conflicts.join(),
    ).toMatch(/not a user/);
    expect(
      planMergePlayers(data(), { [DUP]: KEEP, [KEEP]: "x" }).conflicts.join(),
    ).toMatch(/both a survivor and a duplicate/);
  });

  it("merges a common player who played for both sides into one record", () => {
    const d = data();
    d.innings = [
      {
        id: "i1",
        match_id: "m1",
        innings_number: 1,
        bowling: [bowl(KEEP, "i1", 1)],
      },
      {
        id: "i2",
        match_id: "m1",
        innings_number: 2,
        bowling: [bowl(DUP, "i2", 2)],
      },
    ];
    d.player_matches = [
      {
        id: `m1_${KEEP}`,
        match_id: "m1",
        user_id: KEEP,
        batting: [],
        bowling: [bowl(KEEP, "i1", 1)],
      },
      {
        id: `m1_${DUP}`,
        match_id: "m1",
        user_id: DUP,
        batting: [],
        bowling: [bowl(DUP, "i2", 2)],
      },
    ];
    d.overs = [];
    const before = applyStage3(d, planStage3(d)) as Record<string, Doc[]>;
    const both = planMergePlayers(before, { [DUP]: KEEP });
    expect(both.conflicts).toEqual([]);
    const rec = both.after.player_matches!.filter((p) => p.match_id === "m1");
    expect(rec).toHaveLength(1);
    expect(
      rec[0]!.bowling.map((b: { innings_number: number }) => b.innings_number),
    ).toEqual([1, 2]);
    expect(verifyStats(before, both.after, { [DUP]: KEEP })).toEqual([]);
  });

  it("still refuses the same innings twice", () => {
    const d = data();
    d.innings = [
      {
        id: "i1",
        match_id: "m1",
        bowling: [bowl(KEEP, "i1", 1), bowl(DUP, "i1", 1)],
      },
    ];
    d.player_matches = [
      {
        id: `m1_${KEEP}`,
        match_id: "m1",
        user_id: KEEP,
        bowling: [bowl(KEEP, "i1", 1)],
      },
      {
        id: `m1_${DUP}`,
        match_id: "m1",
        user_id: DUP,
        bowling: [bowl(DUP, "i1", 1)],
      },
    ];
    expect(
      planMergePlayers(d, { [DUP]: KEEP }).conflicts.length,
    ).toBeGreaterThan(0);
  });
});

function bowl(userId: string, inningsId: string, n: number) {
  return {
    user_id: userId,
    innings_id: inningsId,
    innings_number: n,
    balls_bowled: 6,
    runs_conceded: 8,
    wickets_taken: 0,
    maidens: 0,
  };
}
