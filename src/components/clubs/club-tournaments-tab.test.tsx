import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach, beforeAll } from "vitest";
import { ClubTournamentsTab } from "./club-tournaments-tab";

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

vi.mock("~/app/tournaments/actions", () => ({
  updateTournament: vi.fn(),
  deleteTournament: vi.fn(),
  registerTeamForTournament: vi.fn(),
}));

describe("ClubTournamentsTab Component", () => {
  const dummyTournaments = [
    {
      id: "tourn-1",
      name: "Championship 2026",
      status: "ongoing",
      tournament_format: "league",
      match_format: "T20",
      venue: "Main Ground",
      season_id: "season-1",
    },
    {
      id: "tourn-2",
      name: "Winter Cup 2025",
      status: "completed",
      tournament_format: "knockout",
      match_format: "ODI",
      venue: "North Oval",
      season_id: "season-2",
    },
  ];

  const dummySeasons = [
    { id: "season-1", name: "2026 Summer", is_current: true },
    { id: "season-2", name: "2025 Winter", is_current: false },
  ];

  const dummyTeams = [
    { id: "team-1", name: "Club XI", short_name: "CXI" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders tournament list and season badges", () => {
    render(
      <ClubTournamentsTab
        clubId="club-1"
        clubName="Metro CC"
        tournaments={dummyTournaments}
        seasons={dummySeasons}
        teams={dummyTeams}
        isAdmin={true}
      />,
    );

    expect(screen.getByText("Championship 2026")).toBeInTheDocument();
    expect(screen.getByText("Winter Cup 2025")).toBeInTheDocument();
    expect(screen.getByText("2026 Summer")).toBeInTheDocument();
    expect(screen.getByText("2025 Winter")).toBeInTheDocument();
  });

  it("filters tournaments by search query", () => {
    render(
      <ClubTournamentsTab
        clubId="club-1"
        clubName="Metro CC"
        tournaments={dummyTournaments}
        seasons={dummySeasons}
        teams={dummyTeams}
        isAdmin={false}
      />,
    );

    const searchInput = screen.getByLabelText(/search tournaments/i);
    fireEvent.change(searchInput, { target: { value: "Winter" } });

    expect(screen.queryByText("Championship 2026")).not.toBeInTheDocument();
    expect(screen.getByText("Winter Cup 2025")).toBeInTheDocument();
  });

  it("renders host tournament button when admin", () => {
    render(
      <ClubTournamentsTab
        clubId="club-1"
        clubName="Metro CC"
        tournaments={dummyTournaments}
        seasons={dummySeasons}
        teams={dummyTeams}
        isAdmin={true}
      />,
    );

    expect(screen.getByRole("link", { name: /host tournament/i })).toBeInTheDocument();
  });

  it("renders empty state when no tournaments exist", () => {
    render(
      <ClubTournamentsTab
        clubId="club-1"
        clubName="Metro CC"
        tournaments={[]}
        seasons={dummySeasons}
        teams={dummyTeams}
        isAdmin={true}
      />,
    );

    expect(screen.getByText(/no tournaments hosted yet/i)).toBeInTheDocument();
  });
});
