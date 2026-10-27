/**
 * `matches.club_side`: a club match against an outside team counts only the
 * club's side in the club statistics (player records, the live fold of the
 * club leaderboard, milestone totals) and nothing else changes.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { looksLikeOutsideOpponent } from "~/app/matches/create/match-setup";
import type { LeaderboardData } from "../leaderboard";
import { clubMilestonesFromList } from "./club-milestones";
import { MemoryDataSource, type Doc } from "./datasource";
import {
  canonicalJson,
  clubTeamIdsOf,
  isClubSide,
  summaryTotalsOf,
} from "./derive.mjs";
import { loadScopeLeaderboard, type ScopeMatch } from "./leaderboards";
import { QueryBuilder } from "./query-builder";
import { playerMatchDocs, type PlayerMatchesRow } from "./scorecard";
import { builderContextFor } from "./server-client";
import { rebuildStats } from "./stats.mjs";
import type { ClubSide, InningsRow } from "./types";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const bat = (user_id: string, runs_scored = 10) =>
  ({ user_id, runs_scored, balls_faced: 8, is_out: true }) as never;
const bowl = (user_id: string) =>
  ({ user_id, balls_bowled: 12, runs_conceded: 15, wickets_taken: 1 }) as never;
const catchBy = (fielder_id: string) =>
  ({ fielder_id, dismissal_type: "caught" }) as never;

/** A finished match: A (a1, a2, a3) batted first against B (b1, b2). */
function finished(club_side: ClubSide | null) {
  const match = {
    id: "m",
    club_id: "C",
    tournament_id: "T",
    team1_id: "A",
    team2_id: "B",
    club_side,
  };
  const innings = [
    {
      id: "i1",
      match_id: "m",
      team_id: "A",
      innings_number: 1,
      is_completed: true,
      batting: [bat("a1"), bat("a2")],
      bowling: [bowl("b1")],
      fall_of_wickets: [catchBy("b2")],
    },
    {
      id: "i2",
      match_id: "m",
      team_id: "B",
      innings_number: 2,
      is_completed: true,
      batting: [bat("b1")],
      bowling: [bowl("a1")],
      fall_of_wickets: [catchBy("a3")],
    },
  ];
  return { match, innings };
}

const clubOf = (club_side: ClubSide | null) => {
  const { match, innings } = finished(club_side);
  return Object.fromEntries(
    playerMatchDocs(match, innings, "now").map((d) => [d.user_id, d.club_id]),
  );
};

describe("club side", () => {
  it("is both sides unless one is named", () => {
    const m = { team1_id: "A", team2_id: "B" };
    expect(clubTeamIdsOf(m)).toBeNull();
    expect(clubTeamIdsOf({ ...m, club_side: "both" })).toBeNull();
    expect(clubTeamIdsOf({ ...m, club_side: "team1" })).toEqual(["A"]);
    expect(clubTeamIdsOf({ ...m, club_side: "team2" })).toEqual(["B"]);
    expect(isClubSide("team2")).toBe(true);
    expect(isClubSide("away")).toBe(false);
  });

  it("gives the club only to the club side's batters, bowlers and fielders", () => {
    expect(clubOf(null)).toEqual({ a1: "C", a2: "C", a3: "C", b1: "C", b2: "C" });
    expect(clubOf("team1")).toEqual({
      a1: "C",
      a2: "C",
      a3: "C",
      b1: null,
      b2: null,
    });
    expect(clubOf("team2")).toEqual({
      a1: null,
      a2: null,
      a3: null,
      b1: "C",
      b2: "C",
    });
  });

  it("keeps the outside players' records for their careers", () => {
    const { match, innings } = finished("team1");
    const b1 = playerMatchDocs(match, innings, "now").find(
      (d) => d.user_id === "b1",
    )!;
    expect(b1.tournament_id).toBe("T");
    expect(b1.batting).toHaveLength(1);
    expect(b1.bowling).toHaveLength(1);
  });

  it("totals the club side's runs, the wickets it took and its best innings", () => {
    const entries = [
      { team_id: "A", total_runs: 150, total_wickets: 6, total_overs: 20 },
      { team_id: "B", total_runs: 180, total_wickets: 4, total_overs: 19 },
    ];
    expect(summaryTotalsOf(entries)).toEqual({
      summary_runs: 330,
      summary_wickets: 10,
      best_innings: { runs: 180, wickets: 4, overs: 19, team_id: "B" },
      best_innings_runs: 180,
    });
    expect(summaryTotalsOf(entries, ["A"])).toEqual({
      summary_runs: 150,
      summary_wickets: 4,
      best_innings: { runs: 150, wickets: 6, overs: 20, team_id: "A" },
      best_innings_runs: 150,
    });
  });

  it("leaves the outside side out of the milestones", () => {
    const innings = [
      { team_id: "A", total_runs: 150, total_wickets: 6, total_overs: 20 },
      { team_id: "X", total_runs: 220, total_wickets: 3, total_overs: 20 },
    ];
    const outside = {
      id: "m1",
      team1: { id: "A", name: "Reds" },
      team2: { id: "X", name: "Visitors" },
      club_side: "team1" as const,
      innings,
      status: "completed",
    };
    expect(clubMilestonesFromList([outside])).toEqual({
      totalMatches: 1,
      completedMatches: 1,
      totalRuns: 150,
      totalWickets: 3,
      highestTeamScore: { runs: 150, wickets: 6, overs: 20, teamName: "Reds" },
    });
    expect(
      clubMilestonesFromList([{ ...outside, club_side: null }])
        .highestTeamScore,
    ).toEqual({ runs: 220, wickets: 3, overs: 20, teamName: "Visitors" });
  });

  it("guesses an outside opponent only from a squad new to a club yours has played for", () => {
    const guess = (
      clubId: string,
      ids: string[] | undefined,
      known: boolean | undefined,
      yoursKnown: boolean | undefined = true,
    ) =>
      looksLikeOutsideOpponent({
        clubId,
        opponentPlayerIds: ids,
        yourTeamHasClubRecords: yoursKnown,
        hasClubRecords: known,
      });
    expect(guess("C", ["x1", "x2"], false)).toBe(true);
    expect(guess("C", ["x1", "x2"], true)).toBe(false);
    expect(guess("C", ["x1"], undefined)).toBe(false); // still loading
    expect(guess("C", [], false)).toBe(false); // a team made on the spot
    expect(guess("C", undefined, false)).toBe(false);
    expect(guess("", ["x1"], false)).toBe(false); // not a club match
    // A club nobody has played for yet: no guess.
    expect(guess("C", ["x1"], false, false)).toBe(false);
  });
});

describe("changing a finished match's club side", () => {
  const done = seed.matches!.find(
    (m) => m.status === "completed" && m.club_id,
  )!;
  const club = String(done.club_id);
  const doneInnings = seed.innings!.filter((i) => i.match_id === done.id);
  const team2Innings = doneInnings.find((i) => i.team_id === done.team2_id)!;

  const strip = (docs: Doc[]) =>
    docs
      .map((d) => {
        const c: Record<string, unknown> = { ...d };
        delete c.updated_at;
        delete c.last_updated;
        return canonicalJson(c);
      })
      .sort();

  async function setClubSide(memory: MemoryDataSource, side: ClubSide) {
    const { ctx } = builderContextFor(memory, null);
    await new QueryBuilder(ctx, "matches")
      .update({ club_side: side === "both" ? null : side })
      .eq("id", String(done.id));
  }

  it("moves the opponents out of the club stats and back", async () => {
    const memory = new MemoryDataSource(structuredClone(seed));
    const careers = strip(memory.all("player_career_stats"));

    await setClubSide(memory, "team1");

    // team1's records keep the club, team2's lose it.
    const records = memory
      .all("player_matches")
      .filter((d) => d.match_id === done.id);
    const team2Batters = new Set(
      (team2Innings.batting as { user_id: string }[]).map((b) => b.user_id),
    );
    expect(team2Batters.size).toBeGreaterThan(0);
    for (const r of records) {
      expect(r.club_id).toBe(team2Batters.has(String(r.user_id)) ? null : club);
    }
    // The boards equal a rebuild from the records; careers are untouched.
    const rebuilt = rebuildStats(
      memory.all("player_matches") as unknown as PlayerMatchesRow[],
      new Map(memory.all("users").map((u) => [u.id, u])),
      "x",
    );
    expect(strip(memory.all("leaderboards"))).toEqual(
      strip(rebuilt.leaderboards as Doc[]),
    );
    expect(strip(memory.all("player_career_stats"))).toEqual(careers);
    // Milestone totals: team1's runs only.
    const match = await memory.getById("matches", String(done.id));
    const team1Runs = doneInnings
      .filter((i) => i.team_id === done.team1_id)
      .reduce((sum, i) => sum + Number(i.total_runs ?? 0), 0);
    expect(match?.summary_runs).toBe(team1Runs);

    // Both sides again: everything as before.
    await setClubSide(memory, "both");
    for (const col of ["player_matches", "leaderboards", "player_career_stats"])
      expect(strip(memory.all(col))).toEqual(strip(seed[col] ?? []));
    const restored = await memory.getById("matches", String(done.id));
    expect(restored?.summary_runs).toBe(done.summary_runs);
  });
});

describe("club leaderboard while a match is live", () => {
  // Seed: a live club match, team2 batting in the innings still in play.
  const live = seed.matches!.find(
    (m) => m.status === "live" && m.club_id === seed.clubs![0]!.id,
  )!;
  const club = String(live.club_id);
  const inPlay = seed.innings!.find(
    (i) => i.match_id === live.id && !i.is_completed,
  ) as unknown as InningsRow;

  /** The club board, folding in the live match with `club_side` (or not). */
  async function board(
    club_side?: ClubSide | null,
  ): Promise<LeaderboardData> {
    const memory = new MemoryDataSource(structuredClone(seed));
    const { ctx } = builderContextFor(memory, null);
    const from = (t: string) => new QueryBuilder(ctx, t as "matches");
    const match: ScopeMatch = {
      id: String(live.id),
      team1_id: String(live.team1_id),
      team2_id: String(live.team2_id),
      club_side,
      innings: seed
        .innings!.filter((i) => i.match_id === live.id)
        .map((i) => ({ id: i.id, is_completed: Boolean(i.is_completed) })),
    };
    const listed = club_side === undefined ? [] : [match];
    return loadScopeLeaderboard({ from } as never, "club", club, listed);
  }
  const runs = (data: LeaderboardData, userId: string) =>
    data.batting.find((b) => b.userId === userId)?.runs ?? 0;
  const balls = (data: LeaderboardData, userId: string) =>
    data.bowling.find((b) => b.userId === userId)?.balls ?? 0;

  it("adds only the club side's figures from the innings in play", async () => {
    expect(inPlay.team_id).toBe(live.team2_id);
    const batter = inPlay.batting!.find((b) => (b.runs_scored ?? 0) > 0)!;
    const bowler = inPlay.bowling!.find((b) => (b.balls_bowled ?? 0) > 0)!;
    const stored = await board(); // completed innings only
    const both = await board(null);
    const team1 = await board("team1");
    const team2 = await board("team2");

    // Batting side (team2) in play: counted unless only team1 is the club's.
    expect(runs(both, batter.user_id)).toBeGreaterThan(
      runs(stored, batter.user_id),
    );
    expect(runs(team2, batter.user_id)).toBe(runs(both, batter.user_id));
    expect(runs(team1, batter.user_id)).toBe(runs(stored, batter.user_id));
    // Bowling side (team1): the other way round.
    expect(balls(both, bowler.user_id)).toBeGreaterThan(
      balls(stored, bowler.user_id),
    );
    expect(balls(team1, bowler.user_id)).toBe(balls(both, bowler.user_id));
    expect(balls(team2, bowler.user_id)).toBe(balls(stored, bowler.user_id));
  });
});
