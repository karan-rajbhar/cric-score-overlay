import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeaderboardView } from "./leaderboard-view";
import { buildLeaderboardData } from "~/lib/leaderboard";

describe("LeaderboardView Component", () => {
  it("renders empty state when no data exists", () => {
    const emptyData = buildLeaderboardData({ batting: [], bowling: [], fallOfWickets: [] });
    render(<LeaderboardView data={emptyData} />);

    expect(screen.getByText(/no leaderboard statistics available/i)).toBeInTheDocument();
  });

  const mockData = buildLeaderboardData({
    batting: [
      {
        match_id: "m1",
        user_id: "u1",
        runs_scored: 104,
        balls_faced: 52,
        fours: 8,
        sixes: 6,
        is_out: false,
        user: { full_name: "Virat Kohli" },
      },
      {
        match_id: "m1",
        user_id: "u2",
        runs_scored: 45,
        balls_faced: 30,
        fours: 4,
        sixes: 1,
        is_out: true,
        user: { full_name: "Rohit Sharma" },
      },
    ],
    bowling: [
      {
        match_id: "m1",
        user_id: "u3",
        overs_bowled: 4.0,
        balls_bowled: 24,
        runs_conceded: 18,
        wickets_taken: 5,
        maidens: 1,
        user: { full_name: "Jasprit Bumrah" },
      },
    ],
    fallOfWickets: [
      {
        match_id: "m1",
        fielder_id: "u4",
        dismissal_type: "caught",
        fielder: { full_name: "Ravindra Jadeja" },
      },
      {
        match_id: "m1",
        fielder_id: "u5",
        dismissal_type: "stumped",
        fielder: { full_name: "MS Dhoni" },
      },
    ],
  });

  it("renders overview tab with highlight cards and top performers", () => {
    render(<LeaderboardView data={mockData} title="Tournament Leaderboard" />);

    expect(screen.getByText("Tournament Leaderboard")).toBeInTheDocument();
    expect(screen.getByText("Orange Cap")).toBeInTheDocument();
    expect(screen.getByText("Purple Cap")).toBeInTheDocument();
    expect(screen.getByText("MVP Leader")).toBeInTheDocument();

    // Check top run scorer in highlight card
    expect(screen.getAllByText("Virat Kohli").length).toBeGreaterThan(0);
    // Check top bowler in highlight card
    expect(screen.getAllByText("Jasprit Bumrah").length).toBeGreaterThan(0);
  });

  it("allows switching to Batting tab and shows detailed metrics", () => {
    render(<LeaderboardView data={mockData} />);

    const battingTabTrigger = screen.getByRole("tab", { name: /batting/i });
    fireEvent.click(battingTabTrigger);

    // Verify batting table headers
    expect(screen.getByText("Runs")).toBeInTheDocument();
    expect(screen.getByText("HS")).toBeInTheDocument();
    expect(screen.getByText("Avg")).toBeInTheDocument();
    expect(screen.getByText("SR")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("50")).toBeInTheDocument();

    // Verify player stats in table
    expect(screen.getAllByText("104*").length).toBeGreaterThan(0);
  });

  it("allows switching to Bowling tab and shows detailed metrics", () => {
    render(<LeaderboardView data={mockData} />);

    const bowlingTabTrigger = screen.getByRole("tab", { name: /bowling/i });
    fireEvent.click(bowlingTabTrigger);

    // Verify bowling table headers
    expect(screen.getByText("Wkts")).toBeInTheDocument();
    expect(screen.getByText("BBI")).toBeInTheDocument();
    expect(screen.getByText("Econ")).toBeInTheDocument();
    expect(screen.getByText("5/18")).toBeInTheDocument();
  });

  it("allows switching to Fielding tab and shows catches and stumpings", () => {
    render(<LeaderboardView data={mockData} />);

    const fieldingTabTrigger = screen.getByRole("tab", { name: /fielding/i });
    fireEvent.click(fieldingTabTrigger);

    expect(screen.getByText("Ravindra Jadeja")).toBeInTheDocument();
    expect(screen.getByText("MS Dhoni")).toBeInTheDocument();
    expect(screen.getByText("Catches (Ct)")).toBeInTheDocument();
    expect(screen.getByText("Stumpings (St)")).toBeInTheDocument();
  });

  it("allows switching to MVP tab and shows impact points", () => {
    render(<LeaderboardView data={mockData} />);

    const mvpTabTrigger = screen.getByRole("tab", { name: /mvp/i });
    fireEvent.click(mvpTabTrigger);

    expect(screen.getByText("Total Points")).toBeInTheDocument();
    expect(screen.getByText("Bat Pts")).toBeInTheDocument();
    expect(screen.getByText("Bowl Pts")).toBeInTheDocument();
    expect(screen.getByText("Field Pts")).toBeInTheDocument();
  });

  it("filters player list by search query", () => {
    render(<LeaderboardView data={mockData} />);

    const battingTabTrigger = screen.getByRole("tab", { name: /batting/i });
    fireEvent.click(battingTabTrigger);

    const searchInput = screen.getByPlaceholderText(/search player name/i);
    fireEvent.change(searchInput, { target: { value: "Kohli" } });

    expect(screen.getByText("Virat Kohli")).toBeInTheDocument();
    expect(screen.queryByText("Rohit Sharma")).not.toBeInTheDocument();
  });
});
