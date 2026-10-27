import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("~/app/matches/club", () => ({ setMatchClub: vi.fn() }));
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user: { id: "u1" } }) }));
const riverside = { id: "c1", name: "Riverside CC", role: "member" as const };
let suggested: typeof riverside | null = riverside;
const suggestion = vi.fn();
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useClubSuggestion: (...args: unknown[]) => {
    suggestion(...args);
    return { club: args[3] ? null : suggested, choosable: [riverside] };
  },
  useClubRecordsQuery: () => ({ data: undefined }),
}));

import { ClubSuggestionCard } from "./club-suggestion";

const match = {
  id: "m1",
  status: "completed",
  club_id: null,
  team1: { id: "A", name: "Lions" },
  team2: { id: "B", name: "Tigers" },
};

describe("ClubSuggestionCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    suggested = riverside;
  });

  it("asks to add a finished match to the club its players play for", () => {
    render(<ClubSuggestionCard match={match} isScorer />);
    expect(screen.getByText("Add this match to Riverside CC?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add to Riverside CC" }));
    // The dialog starts on that club, asking whose stats count.
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByRole("heading", { name: "Add to Riverside CC" }),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByRole("group", {
        name: "Whose stats count for Riverside CC?",
      }),
    ).toBeInTheDocument();
  });

  it("stops asking on this device after Not a club match", () => {
    const { unmount } = render(<ClubSuggestionCard match={match} isScorer />);
    fireEvent.click(screen.getByRole("button", { name: "Not a club match" }));
    expect(screen.queryByText(/Add this match to/)).toBeNull();
    unmount();

    render(<ClubSuggestionCard match={match} isScorer />);
    expect(screen.queryByText(/Add this match to/)).toBeNull();
    expect(suggestion).toHaveBeenLastCalledWith(
      expect.anything(),
      "u1",
      true,
      true,
    );
  });

  it("shows nothing when no club fits", () => {
    suggested = null;
    const { container } = render(<ClubSuggestionCard match={match} isScorer />);
    expect(container).toBeEmptyDOMElement();
  });
});
