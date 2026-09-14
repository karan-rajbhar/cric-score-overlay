import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TeamMatchesView, type TeamMatchItem } from "./team-matches-view";

const mockMatches: TeamMatchItem[] = [
  {
    id: "m-1",
    title: "Strikers vs Warriors - Championship Opener",
    match_format: "T20",
    overs_per_innings: 20,
    status: "completed",
    venue: "Metropolitan Sports Complex",
    scheduled_at: "2024-07-20T14:00:00Z",
    result_description: "Metropolitan Strikers won by 16 runs",
    winning_team_id: "team-1",
    tournament_id: "tourn-1",
    tournament: {
      id: "tourn-1",
      name: "Metropolitan Premier League 2024",
    },
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
    innings: [
      {
        id: "inn-1",
        team_id: "team-1",
        innings_number: 1,
        total_runs: 172,
        total_wickets: 6,
        total_overs: 20,
      },
      {
        id: "inn-2",
        team_id: "team-2",
        innings_number: 2,
        total_runs: 156,
        total_wickets: 8,
        total_overs: 20,
      },
    ],
  },
  {
    id: "m-2",
    title: "Strikers vs Titans - Friendly",
    match_format: "T20",
    overs_per_innings: 20,
    status: "scheduled",
    venue: "Central Oval",
    scheduled_at: "2024-08-15T10:00:00Z",
    result_description: null,
    winning_team_id: null,
    tournament_id: null,
    tournament: null,
    team1: {
      id: "team-1",
      name: "Metropolitan Strikers",
      short_name: "Strikers",
    },
    team2: {
      id: "team-3",
      name: "City Titans",
      short_name: "Titans",
    },
    innings: [],
  },
];

describe("TeamMatchesView", () => {
  it("renders all matches when no tournament filter is active", () => {
    render(<TeamMatchesView currentTeamId="team-1" matches={mockMatches} />);

    expect(screen.getByText("Riverside Warriors")).toBeInTheDocument();
    expect(screen.getByText("City Titans")).toBeInTheDocument();
    expect(screen.getByText("172/6")).toBeInTheDocument();
    expect(screen.getByText("156/8")).toBeInTheDocument();
    expect(
      screen.getByText("Metropolitan Strikers won by 16 runs"),
    ).toBeInTheDocument();
    expect(screen.getByText("Won")).toBeInTheDocument();
  });

  it("filters to tournament matches by default when tournamentInfo is provided", () => {
    render(
      <TeamMatchesView
        currentTeamId="team-1"
        matches={mockMatches}
        tournamentInfo={{
          id: "tourn-1",
          name: "Metropolitan Premier League 2024",
        }}
      />,
    );

    // Should show tournament match
    expect(screen.getByText("Riverside Warriors")).toBeInTheDocument();
    // Non-tournament match should be filtered out
    expect(screen.queryByText("City Titans")).not.toBeInTheDocument();

    // Clicking "All Matches" toggle reveals all matches
    const allMatchesBtn = screen.getByRole("button", {
      name: /All Matches \(2\)/i,
    });
    fireEvent.click(allMatchesBtn);

    expect(screen.getByText("City Titans")).toBeInTheDocument();
  });

  it("filters matches by status", () => {
    render(<TeamMatchesView currentTeamId="team-1" matches={mockMatches} />);

    const upcomingBtn = screen.getByRole("button", { name: "Upcoming" });
    fireEvent.click(upcomingBtn);

    expect(screen.getByText("City Titans")).toBeInTheDocument();
    expect(screen.queryByText("Riverside Warriors")).not.toBeInTheDocument();
  });
});
