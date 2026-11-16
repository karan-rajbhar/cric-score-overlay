import { describe, expect, it } from "vitest";
import { teamStatsOf } from "./team-stats";

const lions = { id: "L", name: "Lions" };
const tigers = { id: "T", name: "Tigers" };
const hawks = { id: "H", name: "Hawks" };

const inn = (team_id: string, innings_number: number, total_runs: number, total_wickets: number) => ({
  team_id,
  innings_number,
  total_runs,
  total_wickets,
  total_overs: 20,
  is_completed: true,
});

describe("teamStatsOf", () => {
  const matches = [
    // Lions bat first, 168/6, win by 30 runs.
    { id: "m1", status: "completed", winning_team_id: "L", win_margin: 30, win_margin_type: "runs", team1: lions, team2: tigers, innings: [inn("L", 1, 168, 6), inn("T", 2, 138, 9)] },
    // Lions chase 121 and win by 7 wickets.
    { id: "m2", status: "completed", winning_team_id: "L", win_margin: 7, win_margin_type: "wickets", team1: hawks, team2: lions, innings: [inn("H", 1, 120, 10), inn("L", 2, 121, 3)] },
    // Lions bat first, 95 all out, lose.
    { id: "m3", status: "completed", winning_team_id: "T", win_margin: 8, win_margin_type: "wickets", team1: lions, team2: tigers, innings: [inn("L", 1, 95, 10), inn("T", 2, 96, 2)] },
    // Not played yet: no figures.
    { id: "m4", status: "scheduled", team1: lions, team2: hawks, innings: [] },
  ];

  it("splits results batting first and chasing", () => {
    const s = teamStatsOf(matches, "L");
    expect(s.matches).toBe(3);
    expect(s.battingFirst).toEqual({ played: 2, won: 1 });
    expect(s.chasing).toEqual({ played: 1, won: 1 });
  });

  it("finds the highest and lowest totals; a won chase is not a low total", () => {
    const s = teamStatsOf(matches, "L");
    expect(s.highest).toMatchObject({ runs: 168, wickets: 6, opponent: "Tigers" });
    expect(s.lowest).toMatchObject({ runs: 95, wickets: 10, opponent: "Tigers" });
    expect(s.average).toBe(Math.round((168 + 121 + 95) / 3));
  });

  it("keeps the biggest win each way", () => {
    const s = teamStatsOf(matches, "L");
    expect(s.biggestByRuns).toEqual({ matchId: "m1", margin: 30, opponent: "Tigers" });
    expect(s.biggestByWickets).toEqual({ matchId: "m2", margin: 7, opponent: "Hawks" });
  });

  it("has nothing to say before a finished match", () => {
    const s = teamStatsOf([matches[3]!], "L");
    expect(s).toMatchObject({ matches: 0, highest: null, lowest: null, average: null });
  });
});
