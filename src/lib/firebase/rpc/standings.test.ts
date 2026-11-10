import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { MemoryDataSource, type Doc } from "../datasource";
import {
  maybeRecalculateStandings,
  recalculateTournamentStandings,
} from "./standings";
import type { MatchesRow } from "../types";

const seed = JSON.parse(
  readFileSync(join(process.cwd(), "firebase/seed/data.json"), "utf8"),
) as Record<string, Doc[]>;

const stripTimes = (docs: Doc[]) =>
  docs
    .map((d) => {
      const c: Record<string, unknown> = { ...d };
      delete c.updated_at;
      delete c.id;
      return JSON.stringify(c, Object.keys(c).sort());
    })
    .sort();

describe("tournament standings", () => {
  const tournamentId = String(
    seed.matches!.find((m) => m.status === "completed" && m.tournament_id)!
      .tournament_id,
  );

  it("uses match summaries (no innings reads) and agrees with the innings", async () => {
    const withSummary = new MemoryDataSource(seed);
    const withoutSummary = new MemoryDataSource({
      ...seed,
      matches: seed.matches!.map((m) => {
        const c = { ...m };
        delete c.innings_summary;
        return c;
      }),
      tournament_standings: [],
    });
    await withoutSummary.insert("tournament_standings", []);
    const fresh = new MemoryDataSource({ ...seed, tournament_standings: [] });

    const before = fresh.billedReads;
    await recalculateTournamentStandings(fresh, tournamentId);
    const summaryReads = fresh.billedReads - before;
    await recalculateTournamentStandings(withoutSummary, tournamentId);
    expect(stripTimes(fresh.all("tournament_standings"))).toEqual(
      stripTimes(withoutSummary.all("tournament_standings")),
    );
    const registrations = seed.tournament_registrations!.filter(
      (r) => r.tournament_id === tournamentId,
    ).length;
    const matches = seed.matches!.filter(
      (m) => m.tournament_id === tournamentId,
    ).length;
    // registrations + matches + (empty) standings query, nothing else
    expect(summaryReads).toBe(registrations + matches + 1);

    // Recomputing an unchanged table writes nothing.
    await recalculateTournamentStandings(withSummary, tournamentId);
    const writes = withSummary.writes;
    await recalculateTournamentStandings(withSummary, tournamentId);
    expect(withSummary.writes).toBe(writes);
  });

  it("skips edits that change none of its inputs", async () => {
    const ds = new MemoryDataSource(seed);
    const match = seed.matches!.find(
      (m) => m.status === "completed" && m.tournament_id,
    ) as unknown as MatchesRow;
    const before = ds.billedReads;
    await maybeRecalculateStandings(ds, match, {
      ...match,
      player_of_the_match_id: "someone",
    });
    expect(ds.billedReads).toBe(before);
    await maybeRecalculateStandings(ds, match, {
      ...match,
      winning_team_id: match.team2_id,
    });
    expect(ds.billedReads).toBeGreaterThan(before);
  });
});

/** Summary entry: team, innings number, runs / wickets off balls. */
const inn = (
  team: string,
  n: number,
  runs: number,
  wickets: number,
  balls: number,
  target: number | null = null,
) => ({
  id: `${team}${n}`,
  team_id: team,
  innings_number: n,
  total_runs: runs,
  total_wickets: wickets,
  total_balls: balls,
  total_overs: 0,
  extras_total: 0,
  is_completed: true,
  target_runs: target,
});

/** Net run rate (and its inputs) of A and B after one completed match. */
async function tableAfter(match: Record<string, unknown>) {
  const ds = new MemoryDataSource({
    tournament_registrations: [
      { id: "r1", tournament_id: "T", team_id: "A", status: "confirmed" },
      { id: "r2", tournament_id: "T", team_id: "B", status: "confirmed" },
    ],
    matches: [
      {
        id: "M",
        tournament_id: "T",
        team1_id: "A",
        team2_id: "B",
        status: "completed",
        result_type: "win",
        overs_per_innings: 20,
        balls_per_over: 6,
        wickets_per_innings: 10,
        ...match,
      },
    ],
  });
  await recalculateTournamentStandings(ds, "T");
  const row = (team: string) =>
    ds.all("tournament_standings").find((s) => s.team_id === team)!;
  return { A: row("A"), B: row("B") };
}

describe("net run rate", () => {
  it("credits the side batting first with the revised target off the chase's overs (DLS)", async () => {
    // A 180/6 in 20; B's target revised to 121 from 12 overs; B 110/7 in 12.
    const { A, B } = await tableAfter({
      winning_team_id: "A",
      dls_revision: { innings_number: 2, target_runs: 121, overs: 12 },
      innings_summary: [inn("A", 1, 180, 6, 120), inn("B", 2, 110, 7, 72, 121)],
    });
    expect(A).toMatchObject({ runs_scored: 120, overs_faced: 12, net_run_rate: 0.83 });
    expect(B).toMatchObject({ runs_scored: 110, overs_faced: 12, net_run_rate: -0.83 });
  });

  it("charges an all-out chase its revised overs, not the match's", async () => {
    // As above, but B are all out for 100 in 11.2.
    const { A, B } = await tableAfter({
      winning_team_id: "A",
      dls_revision: { innings_number: 2, target_runs: 121, overs: 12 },
      innings_summary: [inn("A", 1, 180, 6, 120), inn("B", 2, 100, 10, 68, 121)],
    });
    expect(A.net_run_rate).toBe(1.67);
    expect(B).toMatchObject({ overs_faced: 12, net_run_rate: -1.67 });
  });

  it("uses the target and overs set by hand", async () => {
    // A all out for 120 in 18 of 20; target set to 90 from 12; B 90/3 in 10.
    // 90/10 - 89/12 = 1.58 for the winners, either way it was stored.
    const summary = [inn("A", 1, 120, 10, 108), inn("B", 2, 90, 3, 60, 90)];
    for (const stored of [
      { dls_revision: { innings_number: 2, target_runs: 90, overs: 12 } },
      { overs_per_innings: 12 }, // older matches: the match's overs rewritten
    ]) {
      const { A, B } = await tableAfter({
        winning_team_id: "B",
        innings_summary: summary,
        ...stored,
      });
      expect(B.net_run_rate).toBe(1.58);
      expect(A).toMatchObject({ runs_scored: 89, overs_faced: 12, net_run_rate: -1.58 });
    }
  });

  it("leaves the super over out", async () => {
    // Tied on 150 off 20; super over: B 6/1, then A 7/0 off 3 balls.
    const { A, B } = await tableAfter({
      winning_team_id: "A",
      innings_summary: [
        inn("A", 1, 150, 6, 120),
        inn("B", 2, 150, 8, 120, 151),
        inn("B", 3, 6, 1, 6),
        inn("A", 4, 7, 0, 3, 7),
      ],
    });
    for (const row of [A, B]) {
      expect(row).toMatchObject({
        runs_scored: 150,
        overs_faced: 20,
        runs_conceded: 150,
        overs_bowled: 20,
        net_run_rate: 0,
      });
    }
    expect(A.points).toBe(2);
  });

  it("still charges an all-out side its full overs in a match not revised", async () => {
    // A all out for 150 in 18; B 151/5 in 19: 150/20 - 151/19.
    const { A, B } = await tableAfter({
      winning_team_id: "B",
      innings_summary: [inn("A", 1, 150, 10, 108), inn("B", 2, 151, 5, 114, 151)],
    });
    expect(A).toMatchObject({ overs_faced: 20, net_run_rate: -0.45 });
    expect(B).toMatchObject({ overs_faced: 19, net_run_rate: 0.45 });
  });
});
