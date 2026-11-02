import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { makeInnings, makeMatch } from "~/test/factories";
import type { Match } from "~/lib/match-types";

vi.mock("next/navigation", () => ({
  useParams: () => ({ id: "m1" }),
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/matches/m1",
}));
vi.mock("next/dynamic", () => ({ default: () => () => null }));
vi.mock("~/lib/auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("~/components/follow/entity-actions", () => ({
  EntityActions: () => <button type="button">Follow</button>,
}));
vi.mock("~/components/matches/live-freshness", () => ({
  LiveFreshness: () => null,
}));
vi.mock("~/components/matches/match-summary", () => ({
  MatchSummary: () => <p>Summary panel</p>,
}));
vi.mock("~/components/matches/match-scorecard", () => ({
  MatchScorecard: () => null,
}));
vi.mock("~/components/matches/match-balls", () => ({ MatchBalls: () => null }));
vi.mock("~/lib/hooks/useMatchQueries", () => ({
  useMatchDetailQuery: () => ({}),
  useMatchAdminQuery: () => ({}),
}));

import { MatchView } from "./match-detail";

const finished = () =>
  makeMatch({
    title: "Rohan vs Omkar",
    status: "completed",
    result_description: "Rohan won by 15 runs",
    innings: [makeInnings({ is_completed: true })],
  });

const show = (match: Match, isScorer = false) =>
  render(
    <MatchView
      match={match}
      isScorer={isScorer}
      activeTab="summary"
      onTabChange={vi.fn()}
    />,
  );

const tabNames = () =>
  screen.getAllByRole("tab").map((t) => t.textContent?.trim());

describe("MatchView", () => {
  it("names the match in the top bar, not a generic title", () => {
    show(finished());
    expect(
      screen.getAllByRole("heading", { level: 1, name: "Rohan vs Omkar" })
        .length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("Match centre")).toBeNull();
  });

  it("keeps a finished match's header free of buttons, for a scorer too", () => {
    show(finished(), true);
    for (const name of [/match report/i, /share image/i, /scorer/i, /follow/i]) {
      expect(screen.queryByRole("button", { name })).toBeNull();
    }
  });

  it("gives a finished match one Share button, with the rest behind it", () => {
    show(finished());
    // Phone bar and desktop header: one each, never a separate link button.
    expect(screen.getAllByRole("button", { name: "Share" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Share link" })).toBeNull();
  });

  it("shares a match in progress in one tap", () => {
    show(makeMatch({ status: "live", innings: [makeInnings()] }));
    expect(screen.getAllByRole("button", { name: "Share link" })).toHaveLength(2);
  });

  it("gives a scorer one action, and a viewer another", () => {
    const live = makeMatch({ status: "live", innings: [makeInnings()] });
    const scorer = show(live, true);
    expect(
      screen.getByRole("link", { name: "Continue scoring" }),
    ).toHaveAttribute("href", "/matches/m1/score");
    expect(screen.queryByRole("button", { name: "Follow" })).toBeNull();
    scorer.unmount();

    show(live);
    expect(screen.getByRole("button", { name: "Follow" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Continue scoring" })).toBeNull();
  });

  it("offers only the tabs that have something in them", () => {
    const upcoming = show(makeMatch({ status: "scheduled" }));
    expect(tabNames()).toEqual(["Summary", "Squads"]);
    upcoming.unmount();

    show(finished());
    expect(tabNames()).toEqual([
      "Summary",
      "Scorecard",
      "Balls",
      "Stats",
      "Squads",
    ]);
  });

  it("shows Summary when a link names a tab this match does not have yet", () => {
    render(
      <MatchView
        match={makeMatch({ status: "scheduled" })}
        isScorer={false}
        activeTab="scorecard"
        onTabChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: "Summary" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(screen.getByText("Summary panel")).toBeInTheDocument();
  });
});
