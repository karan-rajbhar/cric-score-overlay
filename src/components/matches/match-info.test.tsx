import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MatchInfo } from "./match-info";
import { makeMatch } from "~/test/factories";

describe("MatchInfo", () => {
  it("renders match details including format, overs, and toss", () => {
    const match = makeMatch({
      match_format: "T20",
      overs_per_innings: 20,
      balls_per_over: 6,
      venue: "Wankhede Stadium",
      scheduled_at: "2026-10-15T14:30:00Z",
      toss_winner_team_id: "t1",
      toss_decision: "bat",
      status: "live",
    });

    render(<MatchInfo match={match} />);

    expect(screen.getByText("Match Info")).toBeInTheDocument();
    expect(screen.getByText("Squads")).toBeInTheDocument();
    expect(screen.getByText("T20")).toBeInTheDocument();
    expect(screen.getByText("Wankhede Stadium")).toBeInTheDocument();
    expect(
      screen.getByText(/Royal Tigers won the toss and elected to/i),
    ).toBeInTheDocument();
  });

  it("switches to Squads tab and displays players", () => {
    const match = makeMatch({
      team1: {
        id: "t1",
        name: "Royal Tigers",
        short_name: "RTG",
        team_players: [
          {
            id: "p1",
            team_id: "t1",
            user_id: "u1",
            role_in_team: "batsman",
            user: { id: "u1", full_name: "Virat Kohli" },
          },
        ],
      },
      team2: {
        id: "t2",
        name: "Coastal Kings",
        short_name: "CKS",
        team_players: [
          {
            id: "p2",
            team_id: "t2",
            user_id: "u2",
            role_in_team: "bowler",
            user: { id: "u2", full_name: "Jasprit Bumrah" },
          },
        ],
      },
    });

    render(<MatchInfo match={match} />);

    // Click Squads tab
    const squadsTab = screen.getByRole("tab", { name: /squads/i });
    fireEvent.pointerDown(squadsTab, { button: 0, ctrlKey: false });
    fireEvent.click(squadsTab);
    fireEvent.keyDown(squadsTab, { key: "Enter" });
    fireEvent.keyDown(squadsTab, { key: " " });

    expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
    expect(screen.getByText("Jasprit Bumrah")).toBeInTheDocument();
  });
});
