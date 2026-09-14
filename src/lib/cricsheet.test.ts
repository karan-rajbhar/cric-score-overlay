import { describe, it, expect } from "vitest";
import { buildCricsheetJson, toCricsheetDismissalKind } from "./cricsheet";
import type { Match, BallEvent } from "./match-types";

describe("Cricsheet Exporter", () => {
  const mockMatch: Match = {
    id: "match-uuid-1",
    title: "Championship Final",
    match_format: "t20",
    overs_per_innings: 20,
    status: "completed",
    current_innings: 2,
    current_over: 20,
    current_ball: 0,
    venue: "Lord's Cricket Ground, London",
    umpire1_name: "Richard Kettleborough",
    umpire2_name: "Kumar Dharmasena",
    third_umpire_name: "Marais Erasmus",
    tournament: {
      id: "tourn-1",
      name: "World Premier Trophy",
    },
    team1_id: "t1-uuid",
    team2_id: "t2-uuid",
    team1: {
      id: "t1-uuid",
      name: "Warriors CC",
      short_name: "WAR",
      team_players: [
        {
          id: "tp-1",
          team_id: "t1-uuid",
          user_id: "u-1",
          user: { id: "u-1", full_name: "John Striker" },
        },
        {
          id: "tp-2",
          team_id: "t1-uuid",
          user_id: "u-2",
          user: { id: "u-2", full_name: "David NonStriker" },
        },
        {
          id: "tp-3",
          team_id: "t1-uuid",
          user_id: "u-squad-reserve",
          user: { id: "u-squad-reserve", full_name: "Reserve Player" },
        },
      ],
    },
    team2: {
      id: "t2-uuid",
      name: "Titans CC",
      short_name: "TIT",
      team_players: [
        {
          id: "tp-4",
          team_id: "t2-uuid",
          user_id: "u-bowler",
          user: { id: "u-bowler", full_name: "Sam Bowler" },
        },
        {
          id: "tp-5",
          team_id: "t2-uuid",
          user_id: "u-fielder",
          user: { id: "u-fielder", full_name: "Ben Fielder" },
        },
      ],
    },
    toss_winner_team_id: "t1-uuid",
    toss_decision: "bat",
    winning_team_id: "t1-uuid",
    win_margin: 25,
    win_margin_type: "runs",
    result_description: "Warriors CC won by 25 runs",
    actual_start_time: "2026-09-14T10:00:00Z",
    innings: [
      {
        id: "inn-1",
        match_id: "match-uuid-1",
        team_id: "t1-uuid",
        innings_number: 1,
        total_runs: 165,
        total_wickets: 4,
        total_overs: 20,
        total_balls: 120,
        extras_total: 8,
        extras_byes: 0,
        extras_leg_byes: 2,
        extras_wides: 5,
        extras_no_balls: 1,
        extras_penalties: 0,
        is_completed: true,
        batting_performances: [
          {
            id: "bp-1",
            match_id: "match-uuid-1",
            innings_id: "inn-1",
            user_id: "u-1",
            batting_position: 1,
            runs_scored: 54,
            balls_faced: 38,
            fours: 6,
            sixes: 2,
            is_out: true,
            dismissal_type: "caught",
            user: { id: "u-1", full_name: "John Striker" },
          },
          {
            id: "bp-2",
            match_id: "match-uuid-1",
            innings_id: "inn-1",
            user_id: "u-2",
            batting_position: 2,
            runs_scored: 32,
            balls_faced: 25,
            fours: 3,
            sixes: 1,
            is_out: false,
            user: { id: "u-2", full_name: "David NonStriker" },
          },
        ],
        bowling_performances: [
          {
            id: "bowl-1",
            match_id: "match-uuid-1",
            innings_id: "inn-1",
            user_id: "u-bowler",
            overs_bowled: 4,
            balls_bowled: 24,
            runs_conceded: 28,
            wickets_taken: 2,
            maidens: 0,
            wides: 1,
            no_balls: 0,
            user: { id: "u-bowler", full_name: "Sam Bowler" },
          },
        ],
        ball_by_ball: [
          {
            id: "b-1",
            match_id: "match-uuid-1",
            innings_id: "inn-1",
            over_number: 0,
            ball_number: 1,
            batsman_id: "u-1",
            non_striker_id: "u-2",
            bowler_id: "u-bowler",
            runs_scored: 4,
            extras: 0,
            extra_type: null,
            is_wicket: false,
            batsman: { id: "u-1", full_name: "John Striker" },
            non_striker: { id: "u-2", full_name: "David NonStriker" },
            bowler: { id: "u-bowler", full_name: "Sam Bowler" },
          },
          {
            id: "b-2",
            match_id: "match-uuid-1",
            innings_id: "inn-1",
            over_number: 0,
            ball_number: 2,
            batsman_id: "u-1",
            non_striker_id: "u-2",
            bowler_id: "u-bowler",
            runs_scored: 0,
            extras: 1,
            extra_type: "wide",
            is_wicket: false,
            batsman: { id: "u-1", full_name: "John Striker" },
            non_striker: { id: "u-2", full_name: "David NonStriker" },
            bowler: { id: "u-bowler", full_name: "Sam Bowler" },
          },
          {
            id: "b-3",
            match_id: "match-uuid-1",
            innings_id: "inn-1",
            over_number: 0,
            ball_number: 3,
            batsman_id: "u-1",
            non_striker_id: "u-2",
            bowler_id: "u-bowler",
            fielder_id: "u-fielder",
            runs_scored: 0,
            extras: 0,
            extra_type: null,
            is_wicket: true,
            dismissal_type: "caught",
            dismissed_player_id: "u-1",
            dismissed_player: { id: "u-1", full_name: "John Striker" },
            batsman: { id: "u-1", full_name: "John Striker" },
            non_striker: { id: "u-2", full_name: "David NonStriker" },
            bowler: { id: "u-bowler", full_name: "Sam Bowler" },
            fielder: { id: "u-fielder", full_name: "Ben Fielder" },
          },
        ],
      },
    ],
  };

  it("generates Cricsheet v1.2.0 standard metadata, venue, officials, and event", () => {
    const json = buildCricsheetJson(mockMatch);

    expect(json.meta.data_version).toBe("1.2.0");
    expect(json.info.balls_per_over).toBe(6);
    expect(json.info.match_type).toBe("T20");
    expect(json.info.overs).toBe(20);
    expect(json.info.venue).toBe("Lord's Cricket Ground, London");
    expect(json.info.event?.name).toBe("World Premier Trophy");
    expect(json.info.officials?.umpires).toEqual([
      "Richard Kettleborough",
      "Kumar Dharmasena",
    ]);
    expect(json.info.officials?.tv_umpires).toEqual(["Marais Erasmus"]);
    expect(json.info.teams).toEqual(["Warriors CC", "Titans CC"]);
    expect(json.info.toss.winner).toBe("Warriors CC");
    expect(json.info.toss.decision).toBe("bat");
    expect(json.info.outcome?.winner).toBe("Warriors CC");
    expect(json.info.outcome?.by?.runs).toBe(25);
  });

  it("registers player IDs and full squad roster including non-batting reserves", () => {
    const json = buildCricsheetJson(mockMatch);

    expect(json.info.registry.people["John Striker"]).toBe("u-1");
    expect(json.info.registry.people["David NonStriker"]).toBe("u-2");
    expect(json.info.registry.people["Sam Bowler"]).toBe("u-bowler");
    expect(json.info.registry.people["Ben Fielder"]).toBe("u-fielder");
    expect(json.info.registry.people["Reserve Player"]).toBe("u-squad-reserve");

    expect(json.info.players["Warriors CC"]).toContain("John Striker");
    expect(json.info.players["Warriors CC"]).toContain("David NonStriker");
    expect(json.info.players["Warriors CC"]).toContain("Reserve Player");
    expect(json.info.players["Titans CC"]).toContain("Sam Bowler");
    expect(json.info.players["Titans CC"]).toContain("Ben Fielder");
  });

  it("correctly encodes deliveries with real non-striker names and fielder attribution", () => {
    const json = buildCricsheetJson(mockMatch);
    const inn = json.innings[0]!;
    expect(inn.team).toBe("Warriors CC");

    const over0 = inn.overs[0]!;
    expect(over0.over).toBe(0);
    expect(over0.deliveries.length).toBe(3);

    // Ball 1: 4 runs off bat, real non-striker
    const d1 = over0.deliveries[0]!;
    expect(d1.batter).toBe("John Striker");
    expect(d1.bowler).toBe("Sam Bowler");
    expect(d1.non_striker).toBe("David NonStriker");
    expect(d1.runs.batter).toBe(4);
    expect(d1.runs.extras).toBe(0);
    expect(d1.runs.total).toBe(4);

    // Ball 2: 1 wide extra
    const d2 = over0.deliveries[1]!;
    expect(d2.runs.batter).toBe(0);
    expect(d2.runs.extras).toBe(1);
    expect(d2.runs.total).toBe(1);
    expect(d2.extras?.wides).toBe(1);

    // Ball 3: Wicket caught with fielder attribution
    const d3 = over0.deliveries[2]!;
    expect(d3.wickets?.[0]?.player_out).toBe("John Striker");
    expect(d3.wickets?.[0]?.kind).toBe("caught");
    expect(d3.wickets?.[0]?.fielders).toEqual([{ name: "Ben Fielder" }]);
  });

  it("attaches external ball log when match object lacks embedded ball_by_ball", () => {
    const matchWithoutEmbeddedBalls: Match = {
      ...mockMatch,
      innings: [
        {
          ...mockMatch.innings![0]!,
          ball_by_ball: undefined,
        },
      ],
    };

    const externalBalls: BallEvent[] = [
      {
        id: "b-ext-1",
        match_id: "match-uuid-1",
        innings_id: "inn-1",
        over_number: 1,
        ball_number: 1,
        seq: 7,
        batsman_id: "u-2",
        non_striker_id: "u-1",
        bowler_id: "u-bowler",
        runs_scored: 6,
        extras: 0,
        extra_type: null,
        is_wicket: false,
        batsman: { id: "u-2", full_name: "David NonStriker" },
        non_striker: { id: "u-1", full_name: "John Striker" },
        bowler: { id: "u-bowler", full_name: "Sam Bowler" },
      },
    ];

    const json = buildCricsheetJson(matchWithoutEmbeddedBalls, externalBalls);
    expect(json.innings[0]!.overs.length).toBe(1);
    expect(json.innings[0]!.overs[0]!.over).toBe(1);
    expect(json.innings[0]!.overs[0]!.deliveries[0]!.runs.batter).toBe(6);
    expect(json.innings[0]!.overs[0]!.deliveries[0]!.batter).toBe(
      "David NonStriker",
    );
  });

  it("maps internal dismissal types to standard Cricsheet kinds", () => {
    expect(toCricsheetDismissalKind("run_out")).toBe("run out");
    expect(toCricsheetDismissalKind("hit_wicket")).toBe("hit wicket");
    expect(toCricsheetDismissalKind("obstructing")).toBe(
      "obstructing the field",
    );
    expect(toCricsheetDismissalKind("handled_ball")).toBe("hit the ball twice");
    expect(toCricsheetDismissalKind("caught", true)).toBe("caught and bowled");
  });

  it("marks super over innings appropriately", () => {
    const superOverMatch: Match = {
      ...mockMatch,
      innings: [
        ...mockMatch.innings!,
        {
          id: "inn-super",
          match_id: "match-uuid-1",
          team_id: "t2-uuid",
          innings_number: 3,
          total_runs: 14,
          total_wickets: 1,
          total_overs: 1,
          total_balls: 6,
          extras_total: 0,
          extras_byes: 0,
          extras_leg_byes: 0,
          extras_wides: 0,
          extras_no_balls: 0,
          extras_penalties: 0,
          is_completed: true,
          ball_by_ball: [],
        },
      ],
    };

    const json = buildCricsheetJson(superOverMatch);
    expect(json.innings[0]!.super_over).toBeUndefined();
    expect(json.innings[1]!.super_over).toBe(true);
  });
});
