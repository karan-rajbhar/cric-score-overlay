import { describe, expect, it } from "vitest";
import { allInnings } from "~/lib/match-report";
import type { Match, TeamPlayer } from "~/lib/match-types";
import {
  ballLogStampOf,
  scorecardMatchOf,
  scoringViewFrom,
  type ScoringSide,
} from "./scoring-views";

const player = (team: string, id: string, name: string): TeamPlayer =>
  ({ id: `tp_${id}`, team_id: team, user_id: id, user: { id, full_name: name } }) as TeamPlayer;

const SIDES: ScoringSide[] = [
  {
    id: "riv",
    name: "Riverside",
    players: [
      player("riv", "a", "Arjun Mehta"),
      player("riv", "k", "Kabir Shah"),
      player("riv", "r", "Rohan Iyer"),
      player("riv", "d", "Dev Malhotra"),
    ],
  },
  {
    id: "hil",
    name: "Hilltop",
    players: [
      player("hil", "q", "Imran Qureshi"),
      player("hil", "p", "Pranav Patel"),
    ],
  },
];

/** As the scoring screen holds it: rows named, the fall of wickets as stored. */
const MATCH = {
  id: "m1",
  status: "live",
  current_innings: 1,
  balls_per_over: 6,
  team1_id: "riv",
  team2_id: "hil",
  team1: { id: "riv", name: "Riverside", short_name: "RIV" },
  team2: { id: "hil", name: "Hilltop", short_name: "HIL" },
  innings: [
    {
      id: "i1",
      match_id: "m1",
      innings_number: 1,
      team_id: "riv",
      total_runs: 40,
      total_wickets: 1,
      total_balls: 30,
      is_completed: false,
      batting_performances: [
        { user_id: "r", runs_scored: 12, balls_faced: 10, is_out: true, dismissal_type: "caught", batting_position: 1, user: { id: "r", full_name: "Rohan Iyer" } },
        { user_id: "a", runs_scored: 20, balls_faced: 15, is_out: false, batting_position: 2, user: { id: "a", full_name: "Arjun Mehta" } },
        { user_id: "k", runs_scored: 5, balls_faced: 5, is_out: false, batting_position: 3, user: { id: "k", full_name: "Kabir Shah" } },
      ],
      bowling_performances: [
        { user_id: "q", overs_bowled: 3, balls_bowled: 18, runs_conceded: 22, wickets_taken: 1, user: { id: "q", full_name: "Imran Qureshi" } },
      ],
      // Stored entries: ids only. The fielder neither batted nor bowled.
      fall_of_wickets: [
        { wicket_number: 1, runs_at_fall: 18, overs_at_fall: 2.4, batsman_out_id: "r", bowler_id: "q", fielder_id: "p", dismissal_type: "caught" },
      ],
    },
  ],
} as unknown as Match;

describe("scorecardMatchOf", () => {
  it("names each stored wicket from the squads, the fielder included", () => {
    const [inn] = allInnings(scorecardMatchOf(MATCH, SIDES));
    expect(inn!.batters.map((b) => [b.name, b.dismissal])).toEqual([
      ["Rohan Iyer", "c Pranav Patel b Imran Qureshi"],
      ["Arjun Mehta", "not out"],
      ["Kabir Shah", "not out"],
    ]);
    expect(inn!.fallOfWickets).toEqual([
      { score: "1-18", name: "Rohan Iyer", over: "2.4" },
    ]);
  });

  it("lists who is yet to bat from the batting side's squad", () => {
    const [inn] = allInnings(scorecardMatchOf(MATCH, SIDES));
    expect(inn!.didNotBat).toEqual(["Dev Malhotra"]);
  });

  it("keeps names the rows already carry and leaves the match otherwise as it was", () => {
    const out = scorecardMatchOf(MATCH, []);
    expect(out.innings?.[0]?.fall_of_wickets?.[0]).toMatchObject({
      batsman: { id: "r", full_name: "Rohan Iyer" },
      bowler: { id: "q", full_name: "Imran Qureshi" },
      fielder: null,
    });
    expect(out.status).toBe("live");
    expect(MATCH.innings?.[0]?.fall_of_wickets?.[0]).not.toHaveProperty("batsman");
  });
});

describe("ballLogStampOf", () => {
  const ball = {
    ...MATCH,
    innings: [{ ...MATCH.innings![0]!, total_balls: 31 }],
  } as Match;
  const next = {
    ...MATCH,
    innings: [...MATCH.innings!, { ...MATCH.innings![0]!, id: "i2" }],
  } as Match;

  it("follows live_state's version: any committed change, totals or not", () => {
    // A correction that leaves the figures as they were (who bowled an
    // over, the batters' ends) still moves the version.
    expect(ballLogStampOf(MATCH, 7)).not.toBe(ballLogStampOf(MATCH, 8));
    expect(ballLogStampOf(MATCH, 7)).toBe(ballLogStampOf(MATCH, 7));
    // A predicted ball alone does not: the server's log has it only once
    // it is committed, which moves the version.
    expect(ballLogStampOf(ball, 7)).toBe(ballLogStampOf(MATCH, 7));
    expect(ballLogStampOf(next, 7)).not.toBe(ballLogStampOf(MATCH, 7));
  });

  it("without a version, changes with the figures and a new innings", () => {
    const base = ballLogStampOf(MATCH, null);
    expect(ballLogStampOf(ball, null)).not.toBe(base);
    expect(ballLogStampOf(next, null)).not.toBe(base);
    expect(ballLogStampOf(MATCH, null)).toBe(base);
  });
});

describe("scoringViewFrom", () => {
  it("reads a view's name and falls back to Score", () => {
    expect(scoringViewFrom("balls")).toBe("balls");
    expect(scoringViewFrom("scorecard")).toBe("scorecard");
    expect(scoringViewFrom(null)).toBe("score");
    expect(scoringViewFrom("stats")).toBe("score");
  });
});
