import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PlayerActivityTabs,
  type PlayerTeamMembership,
  type PlayerBattingPerformance,
  type PlayerBowlingPerformance,
  type PlayerMatchItem,
} from "./player-activity-tabs";

// Match cards follow live_state (server-only queries); not what these test.
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useLiveListMatch: <T,>(m: T) => m,
}));

const mockTeams: PlayerTeamMembership[] = [
  {
    id: "tp-1",
    role_in_team: "captain",
    jersey_number: 18,
    team: {
      id: "team-1",
      name: "Metropolitan Strikers",
      short_name: "Strikers",
      team_type: "club",
      club: {
        id: "club-1",
        name: "Metropolitan Cricket Club",
      },
    },
  },
];

const mockBatting: PlayerBattingPerformance[] = [
  {
    id: "bp-1",
    match_id: "m-1",
    innings_id: "inn-1",
    runs_scored: 54,
    balls_faced: 38,
    fours: 6,
    sixes: 2,
    is_out: true,
    dismissal_type: "caught",
    bowler: { id: "u-bowler", full_name: "Mark Thomas" },
    fielder: { id: "u-fielder", full_name: "Steve White" },
    match: {
      id: "m-1",
      title: "Strikers vs Warriors",
      match_format: "T20",
      scheduled_at: "2024-07-20T14:00:00Z",
      status: "completed",
      result_description: "Metropolitan Strikers won by 16 runs",
      winning_team_id: "team-1",
      team1: {
        id: "team-1",
        name: "Metropolitan Strikers",
        short_name: "Strikers",
      },
      team2: {
        id: "team-2",
        name: "Riverside Warriors",
        short_name: "Warriors",
      },
    },
  },
  {
    id: "bp-2",
    match_id: "m-2",
    innings_id: "inn-2",
    runs_scored: 32,
    balls_faced: 20,
    fours: 3,
    sixes: 1,
    is_out: false,
    dismissal_type: null,
    bowler: null,
    fielder: null,
    match: {
      id: "m-2",
      title: "Strikers vs Titans",
      match_format: "T20",
      scheduled_at: "2024-07-27T14:00:00Z",
      status: "completed",
      result_description: "Metropolitan Strikers won by 6 wickets",
      winning_team_id: "team-1",
      team1: {
        id: "team-1",
        name: "Metropolitan Strikers",
        short_name: "Strikers",
      },
      team2: { id: "team-3", name: "City Titans", short_name: "Titans" },
    },
  },
];

const mockBowling: PlayerBowlingPerformance[] = [
  {
    id: "bowl-1",
    match_id: "m-1",
    innings_id: "inn-2",
    overs_bowled: 4,
    balls_bowled: 24,
    runs_conceded: 24,
    wickets_taken: 2,
    maidens: 1,
    wides: 1,
    no_balls: 0,
    match: {
      id: "m-1",
      title: "Strikers vs Warriors",
      match_format: "T20",
      scheduled_at: "2024-07-20T14:00:00Z",
      status: "completed",
      result_description: "Metropolitan Strikers won by 16 runs",
      winning_team_id: "team-1",
      team1: {
        id: "team-1",
        name: "Metropolitan Strikers",
        short_name: "Strikers",
      },
      team2: {
        id: "team-2",
        name: "Riverside Warriors",
        short_name: "Warriors",
      },
    },
  },
];

const mockMatches: PlayerMatchItem[] = [
  {
    id: "m-1",
    title: "Strikers vs Warriors",
    match_format: "T20",
    overs_per_innings: 20,
    status: "completed",
    result_description: "Metropolitan Strikers won by 16 runs",
    winning_team_id: "team-1",
    team1: {
      id: "team-1",
      name: "Metropolitan Strikers",
      short_name: "Strikers",
    },
    team2: { id: "team-2", name: "Riverside Warriors", short_name: "Warriors" },
    innings: [
      {
        id: "i1",
        team_id: "team-1",
        innings_number: 1,
        total_runs: 172,
        total_wickets: 6,
        total_overs: 20,
      },
      {
        id: "i2",
        team_id: "team-2",
        innings_number: 2,
        total_runs: 156,
        total_wickets: 8,
        total_overs: 20,
      },
    ],
    playerBatting: { runs_scored: 54, balls_faced: 38, is_out: true },
    playerBowling: { wickets_taken: 2, runs_conceded: 24, overs_bowled: 4 },
  },
];

describe("PlayerActivityTabs", () => {
  it("offers only the tabs that have something in them", () => {
    render(
      <PlayerActivityTabs
        teams={[]}
        batting={[]}
        bowling={[]}
        matches={[]}
        statistics={<p>Career figures</p>}
        initialTab="bowling"
      />,
    );
    expect(screen.getAllByRole("tab").map((t) => t.textContent)).toEqual([
      "Stats",
    ]);
    // A link to a tab this player does not have opens the first one.
    expect(screen.getByText("Career figures")).toBeInTheDocument();
  });

  it("renders rich batting innings with formatted dismissals, strike rates, and opponents", () => {
    render(
      <PlayerActivityTabs
        teams={mockTeams}
        batting={mockBatting}
        bowling={mockBowling}
        matches={mockMatches}
      />,
    );

    // Should display opponents
    expect(screen.getByText("vs Riverside Warriors")).toBeInTheDocument();
    expect(screen.getByText("vs City Titans")).toBeInTheDocument();

    // Scores & Out statuses
    expect(screen.getByText("54")).toBeInTheDocument();
    expect(screen.getByText("32*")).toBeInTheDocument();
    expect(screen.getAllByText("not out").length).toBeGreaterThanOrEqual(1);

    // Formatted dismissal text using formatHowOut
    expect(screen.getByText("c Steve White b Mark Thomas")).toBeInTheDocument();

    // Strike rates
    expect(screen.getByText("142.1")).toBeInTheDocument();
    expect(screen.getByText("160.0")).toBeInTheDocument();
  });

  it("renders bowling figures and details on the bowling tab", () => {
    render(
      <PlayerActivityTabs
        teams={mockTeams}
        batting={mockBatting}
        bowling={mockBowling}
        matches={mockMatches}
        initialTab="bowling"
      />,
    );

    expect(screen.getByText("2/24")).toBeInTheDocument();
    expect(screen.getByText("4.0")).toBeInTheDocument();
    expect(screen.getByText("6.00")).toBeInTheDocument(); // Economy rate
  });

  it("renders team memberships on the teams tab", () => {
    render(
      <PlayerActivityTabs
        teams={mockTeams}
        batting={mockBatting}
        bowling={mockBowling}
        matches={mockMatches}
        initialTab="teams"
      />,
    );

    expect(screen.getByText("Metropolitan Strikers")).toBeInTheDocument();
    // Role, shirt number and club on one line.
    expect(
      screen.getByText("Captain (c) · #18 · Metropolitan Cricket Club"),
    ).toBeInTheDocument();
  });

  it("renders match appearances with player contributions", () => {
    render(
      <PlayerActivityTabs
        teams={mockTeams}
        batting={mockBatting}
        bowling={mockBowling}
        matches={mockMatches}
        initialTab="matches"
      />,
    );

    expect(screen.getByText(/Batting 54/)).toBeInTheDocument();
    expect(screen.getByText(/Bowling 2\/24/)).toBeInTheDocument();
  });

  it("renders status badge without DOM nesting error when result_description is null", () => {
    const firstBat = mockBatting[0]!;
    const battingWithNullResult: PlayerBattingPerformance[] = [
      {
        ...firstBat,
        match: {
          ...firstBat.match!,
          status: "scheduled",
          result_description: null,
        },
      },
    ];

    render(
      <PlayerActivityTabs
        teams={mockTeams}
        batting={battingWithNullResult}
        bowling={[]}
        matches={[]}
        initialTab="batting"
      />,
    );

    // The same status chip as the match cards.
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
  });
});
