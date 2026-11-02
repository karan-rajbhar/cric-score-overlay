import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Match } from "~/lib/match-types";
import { makeInnings, makeMatch } from "~/test/factories";

const liveState = vi.hoisted(() => ({
  current: null as Record<string, unknown> | null,
}));
vi.mock("~/lib/hooks/useLiveState", () => ({
  useLiveState: () => ({ state: liveState.current, version: 1, loaded: true }),
}));

import { MatchSummary } from "./match-summary";

describe("MatchSummary - Key Moments", () => {
  const baseMatch: Match = {
    id: "match-123",
    title: "Finals 2026",
    match_format: "t20",
    overs_per_innings: 20,
    status: "scheduled",
    current_innings: 1,
    current_over: 0,
    current_ball: 0,
    team1_id: "team-a",
    team2_id: "team-b",
    team1: { id: "team-a", name: "Mumbai Stars" },
    team2: { id: "team-b", name: "Delhi Titans" },
    innings: [],
  };

  it("says what is coming once the match is on, before anything has happened", () => {
    render(<MatchSummary match={{ ...baseMatch, status: "live" }} />);

    expect(screen.getByText("Key moments")).toBeDefined();
    expect(
      screen.getByText(/the toss, wickets and milestones appear here/i),
    ).toBeDefined();
  });

  it("has no key moments before the start, and the match's details open", () => {
    render(<MatchSummary match={baseMatch} />);

    expect(screen.queryByText("Key moments")).toBeNull();
    expect(screen.getByText("Match details").closest("details")).toHaveAttribute(
      "open",
    );
  });

  it("displays toss key moment when toss data exists", () => {
    const matchWithToss: Match = {
      ...baseMatch,
      status: "live",
      toss_winner_team_id: "team-a",
      toss_decision: "bat",
    };

    render(<MatchSummary match={matchWithToss} />);

    expect(
      screen.getByText(/Mumbai Stars won the toss and chose to bat/i),
    ).toBeDefined();
  });

  it("displays milestones and wickets in Key Moments", () => {
    const matchWithMoments: Match = {
      ...baseMatch,
      status: "live",
      innings: [
        {
          id: "inn-1",
          match_id: "match-123",
          innings_number: 1,
          team_id: "team-a",
          total_runs: 165,
          total_wickets: 4,
          total_balls: 120,
          total_overs: 20,
          is_completed: true,
          extras_total: 5,
          extras_byes: 0,
          extras_leg_byes: 0,
          extras_wides: 3,
          extras_no_balls: 2,
          extras_penalties: 0,
          batting_performances: [
            {
              id: "bp-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-1",
              runs_scored: 72,
              balls_faced: 45,
              fours: 6,
              sixes: 3,
              is_out: true,
              user: { id: "u-1", full_name: "Rohit Sharma" },
            },
          ],
          bowling_performances: [
            {
              id: "bowl-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-2",
              overs_bowled: 4,
              balls_bowled: 24,
              runs_conceded: 22,
              wickets_taken: 3,
              maidens: 0,
              wides: 1,
              no_balls: 0,
              user: { id: "u-2", full_name: "Rashid Khan" },
            },
          ],
          fall_of_wickets: [
            {
              id: "fow-1",
              match_id: "match-123",
              innings_id: "inn-1",
              wicket_number: 1,
              runs_at_fall: 42,
              overs_at_fall: 4.3,
              batsman_out_id: "u-3",
              dismissal_type: "bowled",
              batsman: { id: "u-3", full_name: "Ishan Kishan" },
              bowler: { id: "u-2", full_name: "Rashid Khan" },
            },
          ],
        },
      ],
    };

    render(<MatchSummary match={matchWithMoments} />);

    const moments = within(
      screen.getByRole("region", { name: "Key moments" }),
    );
    // Batter milestone (72 runs)
    expect(moments.getByText("Rohit Sharma 72 (45)")).toBeDefined();
    expect(moments.getByText("Fifty")).toBeDefined();
    // Bowler feat (3 wickets)
    expect(moments.getByText("Rashid Khan 3/22")).toBeDefined();
    // Fall of wicket
    expect(moments.getByText("Ishan Kishan b Rashid Khan")).toBeDefined();
    expect(moments.getByText("42/1")).toBeDefined();
  });

  it("words each wicket by the one rule, never as bowled when it was not", () => {
    const fall = (over: number, fields: object) => ({
      id: `w${over}`,
      wicket_number: over,
      runs_at_fall: over * 10,
      overs_at_fall: over,
      batsman: { id: `b${over}`, full_name: `Batter ${over}` },
      bowler_id: "bowler",
      bowler: { id: "bowler", full_name: "Mahadev" },
      ...fields,
    });
    render(
      <MatchSummary
        match={makeMatch({
          status: "completed",
          innings: [
            makeInnings({
              is_completed: true,
              fall_of_wickets: [
                fall(1, {
                  dismissal_type: "run_out",
                  fielder_id: "f",
                  fielder: { id: "f", full_name: "Akashy" },
                }),
                fall(2, {
                  dismissal_type: "caught",
                  fielder_id: "f",
                  fielder: { id: "f", full_name: "Sanket" },
                }),
                fall(3, {
                  dismissal_type: "caught",
                  fielder_id: "bowler",
                  fielder: { id: "bowler", full_name: "Mahadev" },
                }),
              ] as never,
            }),
          ],
        })}
      />,
    );
    const moments = within(screen.getByRole("region", { name: "Key moments" }));
    expect(moments.getByText("Batter 1 run out (Akashy)")).toBeDefined();
    expect(moments.getByText("Batter 2 c Sanket b Mahadev")).toBeDefined();
    expect(moments.getByText("Batter 3 c & b Mahadev")).toBeDefined();
  });

  it("opens a finished match on its player of the match, in one row", () => {
    render(
      <MatchSummary
        match={makeMatch({
          status: "completed",
          player_of_the_match: { id: "t1p", full_name: "Rohan Desai" },
          innings: [
            makeInnings({
              is_completed: true,
              batting_performances: [
                {
                  id: "b",
                  match_id: "m1",
                  innings_id: "inn-1",
                  user_id: "t1p",
                  runs_scored: 36,
                  balls_faced: 11,
                  fours: 1,
                  sixes: 4,
                  is_out: false,
                  user: { id: "t1p", full_name: "Rohan Desai" },
                },
              ],
            }),
          ],
        })}
      />,
    );
    expect(screen.getByText("Player of the match")).toBeDefined();
    expect(screen.getByText("36* (11)")).toBeDefined();
    // The tiles are the report's.
    expect(screen.queryByText("Batting")).toBeNull();
  });

  it("shows both sides like the summary image, then the best performers", () => {
    const completedMatch: Match = {
      ...baseMatch,
      status: "completed",
      winning_team_id: "team-a",
      result_description: "Mumbai Stars won by 15 runs",
      innings: [
        {
          id: "inn-1",
          match_id: "match-123",
          innings_number: 1,
          team_id: "team-a",
          total_runs: 165,
          total_wickets: 4,
          total_balls: 120,
          total_overs: 20,
          is_completed: true,
          extras_total: 5,
          extras_byes: 0,
          extras_leg_byes: 0,
          extras_wides: 3,
          extras_no_balls: 2,
          extras_penalties: 0,
          batting_performances: [
            {
              id: "bp-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-1",
              runs_scored: 72,
              balls_faced: 45,
              fours: 6,
              sixes: 3,
              is_out: false,
              user: { id: "u-1", full_name: "Rohit Sharma" },
            },
          ],
        },
      ],
    };

    render(<MatchSummary match={completedMatch} />);

    // Each innings as on the share-summary image: score, top batters / bowlers.
    expect(screen.getByText("165/4")).toBeDefined();
    expect(screen.getByText("20.0 ov")).toBeDefined();
    expect(screen.getByText("Won")).toBeDefined();
    expect(screen.getAllByText("Top batters").length).toBeGreaterThan(0);
    expect(screen.getAllByText("72*").length).toBeGreaterThan(0);
    // The result and the player of the match are in the hero, not here.
    expect(screen.queryByText(/won by 15 runs/i)).toBeNull();
  });

  it("puts each innings' batters beside the bowlers who bowled at them", () => {
    const bowler = (innings_id: string, id: string, full_name: string) => ({
      id,
      match_id: "m1",
      innings_id,
      user_id: id,
      overs_bowled: 4,
      balls_bowled: 24,
      runs_conceded: 22,
      wickets_taken: 3,
      maidens: 0,
      wides: 0,
      no_balls: 0,
      user: { id, full_name },
    });
    const batter = (innings_id: string, id: string, full_name: string) => ({
      id,
      match_id: "m1",
      innings_id,
      user_id: id,
      runs_scored: 40,
      balls_faced: 30,
      fours: 2,
      sixes: 1,
      is_out: true,
      user: { id, full_name },
    });
    render(
      <MatchSummary
        match={makeMatch({
          status: "completed",
          innings: [
            makeInnings({
              id: "a",
              team_id: "t1",
              is_completed: true,
              batting_performances: [batter("a", "b1", "Tigers Batter")],
              bowling_performances: [bowler("a", "k1", "Kings Bowler")],
            }),
            makeInnings({
              id: "b",
              innings_number: 2,
              team_id: "t2",
              is_completed: true,
              batting_performances: [batter("b", "b2", "Kings Batter")],
              bowling_performances: [bowler("b", "t1", "Tigers Bowler")],
            }),
          ],
        })}
      />,
    );
    const card = (title: string) =>
      within(screen.getByText(title).closest(".overflow-hidden") as HTMLElement);
    // The column titles are for screen readers: the figures say which is which.
    expect(screen.getByText("Bowling for Coastal Kings")).toHaveClass("sr-only");
    const tigers = card("Bowling for Coastal Kings");
    expect(tigers.getByText("Tigers Batter")).toBeDefined();
    expect(tigers.getByText("Kings Bowler")).toBeDefined();
    expect(tigers.queryByText("Tigers Bowler")).toBeNull();

    const kings = card("Bowling for Royal Tigers");
    expect(kings.getByText("Kings Batter")).toBeDefined();
    expect(kings.getByText("Tigers Bowler")).toBeDefined();
    expect(kings.queryByText("Kings Bowler")).toBeNull();
  });

  it("shows a side yet to bat as just its header", () => {
    render(
      <MatchSummary
        match={makeMatch({
          status: "live",
          innings: [
            makeInnings({
              team_id: "t1",
              is_completed: true,
              total_runs: 83,
              batting_performances: [
                {
                  id: "b",
                  match_id: "m1",
                  innings_id: "inn-1",
                  user_id: "u1",
                  runs_scored: 36,
                  balls_faced: 11,
                  fours: 1,
                  sixes: 4,
                  is_out: false,
                  user: { id: "u1", full_name: "Rohan Desai" },
                },
              ],
            }),
          ],
        })}
      />,
    );
    const card = within(
      screen.getByText("Yet to bat").closest(".overflow-hidden") as HTMLElement,
    );
    expect(card.getByText("Coastal Kings")).toBeDefined();
    expect(card.queryByText("Top batters")).toBeNull();
    expect(card.queryByText("None")).toBeNull();
    expect(screen.queryByText("Bowling for Royal Tigers")).toBeNull();
  });

  it("shows the crease, the bowler and this over while an innings is in play", () => {
    liveState.current = {
      innings_number: 1,
      this_over_balls: "1 0 4 W",
      partnership_runs: 12,
      partnership_balls: 9,
    };
    const live: Match = {
      ...baseMatch,
      status: "live",
      innings: [
        {
          id: "inn-1",
          match_id: "match-123",
          innings_number: 1,
          team_id: "team-a",
          total_runs: 54,
          total_wickets: 2,
          total_balls: 40,
          total_overs: 6.4,
          is_completed: false,
          extras_total: 3,
          extras_byes: 0,
          extras_leg_byes: 0,
          extras_wides: 3,
          extras_no_balls: 0,
          extras_penalties: 0,
          batting_performances: [
            {
              id: "bp-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-1",
              batting_position: 1,
              runs_scored: 30,
              balls_faced: 20,
              fours: 4,
              sixes: 1,
              is_out: false,
              is_current_batsman: true,
              is_striker: true,
              user: { id: "u-1", full_name: "Rohit Sharma" },
            },
            {
              id: "bp-2",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-4",
              batting_position: 4,
              runs_scored: 5,
              balls_faced: 6,
              fours: 0,
              sixes: 0,
              is_out: false,
              is_current_batsman: true,
              is_striker: false,
              user: { id: "u-4", full_name: "Suryakumar Yadav" },
            },
          ],
          bowling_performances: [
            {
              id: "bowl-1",
              match_id: "match-123",
              innings_id: "inn-1",
              user_id: "u-2",
              overs_bowled: 1.4,
              balls_bowled: 10,
              runs_conceded: 14,
              wickets_taken: 1,
              maidens: 0,
              wides: 0,
              no_balls: 0,
              is_current_bowler: true,
              user: { id: "u-2", full_name: "Rashid Khan" },
            },
          ],
        },
      ],
    };

    render(<MatchSummary match={live} />);

    expect(screen.getByText("Rohit Sharma")).toBeDefined();
    expect(screen.getByText("(on strike)")).toBeDefined();
    expect(screen.getByText("Suryakumar Yadav")).toBeDefined();
    expect(screen.getByText("Rashid Khan")).toBeDefined();
    expect(screen.getByText("This over")).toBeDefined();
    expect(
      within(screen.getByRole("list")).getAllByRole("listitem"),
    ).toHaveLength(4);
    expect(screen.getByText("Partnership")).toBeDefined();
    expect(screen.getByText("Projected score")).toBeDefined();
    liveState.current = null;
  });

  it("says a finished match with no moments has none, not that they are coming", () => {
    render(
      <MatchSummary
        match={{
          ...baseMatch,
          status: "abandoned",
          result_description: "Match abandoned: Rain",
        }}
      />,
    );
    expect(
      screen.getByText(/no toss, wickets or milestones were recorded/i),
    ).toBeDefined();
  });
});

describe("MatchLivePanel between and before innings", () => {
  const first = makeInnings({
    total_runs: 150,
    total_balls: 120,
    total_overs: 20,
    is_completed: true,
  });
  const chase = makeInnings({
    id: "inn-2",
    team_id: "t2",
    innings_number: 2,
    target_runs: 151,
  });

  it("calls the wait before the chase an innings break, with the target", () => {
    render(<MatchSummary match={makeMatch({ innings: [first, chase] })} />);
    expect(screen.getByText("Innings break.")).toBeDefined();
    expect(
      screen.getByText(/Coastal Kings\s+need 151 runs to win/),
    ).toBeDefined();
    // No run rate of 0.00 before a ball is bowled.
    expect(screen.queryByText("Run rate")).toBeNull();
    expect(screen.getByText("Target")).toBeDefined();
  });

  it("says who bats first before the first ball", () => {
    render(<MatchSummary match={makeMatch({ innings: [makeInnings()] })} />);
    expect(screen.getByText("Yet to start.")).toBeDefined();
    expect(screen.getByText(/Royal Tigers\s+bat first/)).toBeDefined();
  });

  it("counts a DLS chase over its revised overs and says so", () => {
    const revised = { ...chase, target_runs: 98, total_runs: 40, total_balls: 36 };
    render(
      <MatchSummary
        match={makeMatch({
          innings: [first, revised],
          dls_revision: { innings_number: 2, target_runs: 98, overs: 12 },
        })}
      />,
    );
    // 58 needed from 36 balls (12 overs, 6 bowled): 9.67 an over.
    expect(screen.getByText("9.67")).toBeDefined();
    expect(
      screen.getByText("Target revised by the DLS method: 98 runs in 12 overs."),
    ).toBeDefined();
  });

  it("shows phones the first key moments, then all of them on request", () => {
    const wickets = Array.from({ length: 7 }, (_, i) => ({
      id: `w${i}`,
      wicket_number: i + 1,
      runs_at_fall: 10 * (i + 1),
      overs_at_fall: i + 1,
      batsman_id: `u${i}`,
      batsman: { id: `u${i}`, full_name: `Batter ${i}` },
      dismissal_type: "bowled",
    }));
    render(
      <MatchSummary
        match={makeMatch({
          status: "completed",
          innings: [
            makeInnings({ is_completed: true, fall_of_wickets: wickets as never }),
          ],
        })}
      />,
    );
    const moments = within(screen.getByRole("region", { name: "Key moments" }));
    const show = moments.getByRole("button", { name: /Show all \d+ moments/ });
    const rows = () => moments.getAllByText(/^Batter \d /);
    const hidden = () =>
      rows().filter((r) => r.closest(".max-md\\:hidden")).length;
    expect(rows()).toHaveLength(7);
    expect(hidden()).toBeGreaterThan(0);
    fireEvent.click(show);
    expect(hidden()).toBe(0);
    expect(moments.queryByRole("button", { name: /Show all/ })).toBeNull();
  });
});
