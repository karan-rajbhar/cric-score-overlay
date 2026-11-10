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
    expect(json.info.toss?.winner).toBe("Warriors CC");
    expect(json.info.toss?.decision).toBe("bat");
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
    expect(toCricsheetDismissalKind("handled_ball")).toBe("handled the ball");
    expect(toCricsheetDismissalKind("hit_the_ball_twice")).toBe(
      "hit the ball twice",
    );
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

// A match whose log has every kind of event (see `first` and `second`).
const fx = (() => {
  const people = {
    a: { id: "a", full_name: "Asha" },
    b: { id: "b", full_name: "Bela" },
    x: { id: "x", full_name: "Xavi" },
    y: { id: "y", full_name: "Yuri" },
    z: { id: "z", full_name: "Zed" },
  };
  let seq = 0;
  const entry = (
    inningsId: string,
    over: number,
    fields: Partial<BallEvent> & { penalty_team_id?: string },
  ): BallEvent => {
    seq += 1;
    return {
      id: `e${seq}`,
      match_id: "m",
      innings_id: inningsId,
      over_number: over,
      ball_number: seq,
      seq,
      batsman_id: "a",
      non_striker_id: "b",
      bowler_id: "x",
      runs_scored: 0,
      extras: 0,
      extra_type: null,
      is_wicket: false,
      ...fields,
    } as BallEvent;
  };
  const innings = (
    id: string,
    team: string,
    n: number,
    runs: number,
    balls: BallEvent[],
    extra: Record<string, unknown> = {},
  ) => ({
    id,
    match_id: "m",
    team_id: team,
    innings_number: n,
    total_runs: runs,
    total_wickets: 0,
    total_balls: 2,
    total_overs: 0.2,
    extras_total: 0,
    extras_byes: 0,
    extras_leg_byes: 0,
    extras_wides: 0,
    extras_no_balls: 0,
    extras_penalties: 0,
    is_completed: true,
    ball_by_ball: balls,
    ...extra,
  });
  const base: Match = {
    id: "m",
    title: "The Nineties XI vs Rovers",
    match_format: "custom",
    overs_per_innings: 10,
    status: "completed",
    current_innings: 2,
    current_over: 0,
    current_ball: 0,
    team1_id: "t1",
    team2_id: "t2",
    team1: { id: "t1", name: "The Nineties XI", short_name: "NIN" },
    team2: { id: "t2", name: "Rovers", short_name: "ROV" },
    toss_winner_team_id: "t2",
    toss_decision: "bowl",
    result_type: "win",
    winning_team_id: "t1",
    win_margin_type: "runs",
    win_margin: 12,
    result_description: "The Nineties XI won by 12 runs",
    scheduled_at: "2026-11-09T19:00:00.000Z",
  };

  // Innings 1 (t1): a single, Asha retires hurt, 5 penalty runs to t1,
  // 5 to t2 (who have not batted: carried into their innings), 2 bonus
  // runs, a dot. 2 balls, 8 runs.
  const first = [
    entry("i1", 0, { runs_scored: 1, batsman: people.a, bowler: people.x }),
    entry("i1", 0, {
      bowler_id: null,
      non_striker_id: "b",
      is_wicket: true,
      dismissal_type: "retired_hurt",
      dismissed_player_id: "a",
      dismissed_player: people.a,
    }),
    entry("i1", 0, { extras: 5, extra_type: "penalty" }),
    entry("i1", 0, {
      bowler_id: null,
      batsman_id: undefined as never,
      non_striker_id: null,
      extras: 5,
      extra_type: "penalty",
      penalty_team_id: "t2",
    }),
    entry("i1", 0, { extras: 2, extra_type: "bonus" }),
    entry("i1", 0, { batsman_id: "b", non_striker_id: "a" }),
  ];
  // Innings 2 (t2): the carried 5 first, then a three. 8 runs.
  const second = [
    entry("i2", 0, {
      bowler_id: null,
      batsman_id: undefined as never,
      non_striker_id: null,
      extras: 5,
      extra_type: "penalty",
      penalty_team_id: "t2",
    }),
    entry("i2", 0, {
      batsman_id: "y",
      non_striker_id: "z",
      bowler_id: "a",
      runs_scored: 3,
    }),
  ];
  const match: Match = {
    ...base,
    innings: [
      innings("i1", "t1", 1, 8, first, { extras_penalties: 5, extras_bonuses: 2 }),
      innings("i2", "t2", 2, 8, second, { extras_penalties: 5, target_runs: 9 }),
    ],
  };

  return { innings, match };
})();
const { match } = fx;

const deliveriesOf = (inn: { overs: { deliveries: unknown[] }[] }) =>
  inn.overs.flatMap((o) => o.deliveries) as Array<{
    runs: { total: number };
    extras?: { penalty?: number };
    wickets?: Array<{ player_out: string; kind: string }>;
  }>;

describe("Cricsheet export of events", () => {
  it("exports deliveries only, with penalties once and retirements on a ball", () => {
    const json = buildCricsheetJson(match);
    const [one, two] = json.innings;
    const d1 = deliveriesOf(one!);
    // Legal balls plus wides and no-balls.
    expect(d1).toHaveLength(2);
    expect(d1.some((d) => JSON.stringify(d).includes("Unknown"))).toBe(false);
    expect(d1[0]!.wickets).toEqual([
      { player_out: "Asha", kind: "retired hurt" },
    ]);
    expect(d1[0]!.extras?.penalty).toBe(7);
    const sum = (inn: typeof one) =>
      deliveriesOf(inn!).reduce((s, d) => s + d.runs.total, 0) +
      (inn!.penalty_runs?.pre ?? 0) +
      (inn!.penalty_runs?.post ?? 0);
    expect(sum(one)).toBe(8);
    expect(one!.penalty_runs).toBeUndefined();
    expect(deliveriesOf(two!)).toHaveLength(1);
    expect(two!.penalty_runs).toEqual({ pre: 5 });
    expect(sum(two)).toBe(8);
  });
});

describe("Cricsheet match info", () => {
  const { innings } = fx;

  it("takes the outcome from the result, not its wording", () => {
    expect(buildCricsheetJson(match).info.outcome).toEqual({
      winner: "The Nineties XI",
      by: { runs: 12 },
    });
    const tie = buildCricsheetJson({
      ...match,
      result_type: "tie",
      winning_team_id: null,
      win_margin: null,
      win_margin_type: null,
    });
    expect(tie.info.outcome).toEqual({ result: "tie" });
  });

  it("names a super over's winner as the eliminator of a tie", () => {
    const json = buildCricsheetJson({
      ...match,
      winning_team_id: "t2",
      win_margin_type: "wickets",
      win_margin: 2,
      result_description: "Rovers won by 2 wickets (Super Over)",
      innings: [
        ...match.innings!,
        innings("i3", "t1", 3, 7, []),
        innings("i4", "t2", 4, 8, [], { target_runs: 8 }),
      ],
    });
    expect(json.info.outcome).toEqual({ result: "tie", eliminator: "Rovers" });
    expect(json.innings[3]!.target).toEqual({ runs: 8, overs: 1 });
  });

  it("names the method and the overs of a DLS revision", () => {
    const json = buildCricsheetJson({
      ...match,
      dls_revision: { innings_number: 2, target_runs: 9, overs: 6 },
      result_description: "The Nineties XI won by 12 runs (revised target)",
    });
    expect(json.info.outcome).toMatchObject({ method: "D/L" });
    expect(json.innings[1]!.target).toEqual({ runs: 9, overs: 6 });
  });

});

describe("Cricsheet match info: abandoned, date and toss", () => {
  it("gives an abandoned match awarded to a side as won by award", () => {
    const json = buildCricsheetJson({
      ...match,
      status: "abandoned",
      result_type: "win",
      winning_team_id: "t2",
      win_margin: null,
      win_margin_type: null,
    });
    expect(json.info.outcome).toEqual({ winner: "Rovers", method: "Awarded" });
    expect(
      buildCricsheetJson({
        ...match,
        status: "abandoned",
        result_type: "abandoned",
        winning_team_id: null,
      }).info.outcome,
    ).toEqual({ result: "no result" });
  });

  it("takes the balls per over, the local date and the toss from the match", () => {
    const json = buildCricsheetJson(
      { ...match, balls_per_over: 8 },
      undefined,
      { timeZone: "Asia/Kolkata" },
    );
    expect(json.info.balls_per_over).toBe(8);
    // 00:30 on 10 November in India is 19:00 UTC on the 9th.
    expect(json.info.dates).toEqual(["2026-11-10"]);
    expect(json.info.toss).toEqual({ winner: "Rovers", decision: "field" });
    const noToss = buildCricsheetJson({
      ...match,
      toss_winner_team_id: null,
      toss_decision: null,
    });
    expect(noToss.info.toss).toBeUndefined();
  });
});
