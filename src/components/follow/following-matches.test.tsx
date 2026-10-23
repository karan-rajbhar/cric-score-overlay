import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFollowingFeed } from "~/app/follows/actions";
import { makeMatch } from "~/test/factories";
import { FollowingMatches } from "./following-matches";

vi.mock("~/app/follows/actions", () => ({ getFollowingFeed: vi.fn() }));
let user: { id: string } | null = { id: "u1" };
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user }) }));
const live = [
  makeMatch({ id: "live-followed", team1_id: "t1", status: "live" }),
  makeMatch({ id: "live-other", team1_id: "t8", team2_id: "t9", status: "live" }),
];
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchesQuery: () => ({ data: live }),
}));
vi.mock("~/components/matches/match-card", () => ({
  MatchCard: ({ match }: { match: { id: string } }) => (
    <article data-testid="card">{match.id}</article>
  ),
}));

function renderList() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FollowingMatches />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  user = { id: "u1" };
});

describe("FollowingMatches", () => {
  it("shows followed live matches from the live list, then upcoming fixtures", async () => {
    vi.mocked(getFollowingFeed).mockResolvedValue({
      data: {
        targets: ["team:t1"],
        matchIds: [],
        teamIds: ["t1"],
        tournamentIds: [],
        upcoming: [{ ...makeMatch({ id: "next", status: "scheduled" }) }],
      },
      error: null,
    });
    renderList();
    expect(await screen.findByRole("heading", { name: "Following" })).toBeInTheDocument();
    expect(screen.getAllByTestId("card").map((c) => c.textContent)).toEqual([
      "live-followed",
      "next",
    ]);
  });

  it("says how to follow something when nothing is followed", async () => {
    vi.mocked(getFollowingFeed).mockResolvedValue({
      data: { targets: [], matchIds: [], teamIds: [], tournamentIds: [], upcoming: [] },
      error: null,
    });
    renderList();
    expect(
      await screen.findByText(/Follow a team, player or tournament from its page/),
    ).toBeInTheDocument();
  });

  it("renders nothing signed out", () => {
    user = null;
    const { container } = renderList();
    expect(container).toBeEmptyDOMElement();
    expect(getFollowingFeed).not.toHaveBeenCalled();
  });
});
