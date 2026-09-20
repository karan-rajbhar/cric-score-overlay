import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { ClubMatchesTab } from "./club-matches-tab";

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
  window.HTMLElement.prototype.hasPointerCapture = vi.fn();
  window.HTMLElement.prototype.setPointerCapture = vi.fn();
});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

describe("ClubMatchesTab Component", () => {
  const dummyMatches = [
    {
      id: "match-1",
      status: "live",
      venue: "Center Stadium",
      season_id: "season-1",
      team1: { id: "t-1", name: "Metro Hawks" },
      team2: { id: "t-2", name: "Metro Eagles" },
      innings: [
        {
          id: "inn-1",
          team_id: "t-1",
          innings_number: 1,
          total_runs: 165,
          total_wickets: 4,
          total_balls: 120,
          total_overs: 20,
        },
      ],
    },
    {
      id: "match-2",
      status: "completed",
      venue: "West Ground",
      season_id: "season-2",
      result_description: "Metro Hawks won by 25 runs",
      team1: { id: "t-1", name: "Metro Hawks" },
      team2: { id: "t-3", name: "City Lions" },
      innings: [],
    },
  ];

  const dummySeasons = [
    { id: "season-1", name: "2026 Season", is_current: true },
    { id: "season-2", name: "2025 Season", is_current: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders matches with teams and live indicators", () => {
    render(
      <ClubMatchesTab
        clubId="club-1"
        matches={dummyMatches}
        seasons={dummySeasons}
        isAdmin={true}
      />,
    );

    expect(screen.getAllByText("Metro Hawks").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Metro Eagles")).toBeInTheDocument();
    expect(screen.getByText("City Lions")).toBeInTheDocument();
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });

  it("filters matches by search query", () => {
    render(
      <ClubMatchesTab
        clubId="club-1"
        matches={dummyMatches}
        seasons={dummySeasons}
        isAdmin={false}
      />,
    );

    const searchInput = screen.getByLabelText(/search matches/i);
    fireEvent.change(searchInput, { target: { value: "City Lions" } });

    expect(screen.getByText("City Lions")).toBeInTheDocument();
    expect(screen.queryByText("Metro Eagles")).not.toBeInTheDocument();
  });

  it("shows empty state when no matches exist", () => {
    render(
      <ClubMatchesTab
        clubId="club-1"
        matches={[]}
        seasons={dummySeasons}
        isAdmin={true}
      />,
    );

    expect(screen.getByText(/no matches scheduled/i)).toBeInTheDocument();
  });
});
