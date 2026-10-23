import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeMatch } from "~/test/factories";

vi.mock("~/lib/auth", () => ({
  useAuth: () => ({ user: null, loading: false }),
}));
const matches = [
  makeMatch({ id: "m1", status: "completed", title: "Tigers vs Kings" }),
  makeMatch({
    id: "m2",
    status: "abandoned",
    title: "Hawks vs Eagles",
    result_description: "Match abandoned: Rain",
  }),
];
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchesQuery: () => ({
    data: matches,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useUserAdminClubIdsQuery: () => ({ data: new Set() }),
  useLiveListMatch: (m: unknown) => m,
}));

import MatchesPage from "./page";

describe("Matches list", () => {
  it("lists abandoned matches under No result", () => {
    render(<MatchesPage />);
    expect(screen.getByText("No result")).toBeInTheDocument();
    expect(screen.getByText("Match abandoned: Rain")).toBeInTheDocument();
  });

  it("points a filter with no match to the search of all matches", () => {
    render(<MatchesPage />);
    fireEvent.change(screen.getByLabelText("Filter these matches"), {
      target: { value: "Rovers" },
    });
    expect(
      screen.getByText(/None of the latest matches match "Rovers"/),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /search all matches/i }),
    ).toHaveAttribute("href", "/search?q=Rovers");
  });

  it("offers the full search under matching results too", () => {
    render(<MatchesPage />);
    fireEvent.change(screen.getByLabelText("Filter these matches"), {
      target: { value: "Tigers" },
    });
    expect(
      screen.getByRole("link", { name: 'Search all matches for "Tigers"' }),
    ).toHaveAttribute("href", "/search?q=Tigers");
  });
});
