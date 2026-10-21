import type { ReactElement } from "react";
import { act, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

type Handlers = { next: (d: Record<string, unknown> | null) => void };
const watches: Array<{ table: string; id: string } & Handlers> = [];
vi.mock("~/lib/firebase/client", () => ({
  getFirebaseDb: () => ({}),
  createClient: () => ({}),
}));
vi.mock("~/lib/firebase/realtime", () => ({
  watchDoc: (_db: unknown, table: string, id: string, handlers: Handlers) => {
    watches.push({ table, id, ...handlers });
    return () => {};
  },
  readDoc: vi.fn(),
}));
const getMatches = vi.fn();
vi.mock("~/app/matches/queries", () => ({
  getMatches: (...a: unknown[]) => getMatches(...a),
  getMatch: vi.fn(),
  getMatchBallLog: vi.fn(),
  getPartnerships: vi.fn(),
  ensureLiveScorecard: vi.fn(),
}));

import { MatchCard } from "./match-card";

import { makeMatch } from "~/test/factories";

function renderCard(ui: ReactElement) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  );
}

const liveMatch = makeMatch({
  venue: "City Ground",
  scheduled_at: new Date().toISOString(),
  created_by: "user-owner",
  match_admins: ["user-owner"],
  innings: [
    {
      id: "i1",
      match_id: "m1",
      innings_number: 1,
      team_id: "t1",
      total_runs: 98,
      total_wickets: 3,
      total_balls: 62,
      total_overs: 10.2,
      is_completed: false,
      extras_total: 0,
      extras_byes: 0,
      extras_leg_byes: 0,
      extras_wides: 0,
      extras_no_balls: 0,
      extras_penalties: 0,
    },
  ],
});

describe("MatchCard scoring actions", () => {
  it("shows the Score action for a scorer on a live match without duplicate live badges", () => {
    renderCard(<MatchCard match={liveMatch} canScore />);
    expect(screen.getByRole("link", { name: /score/i })).toHaveAttribute(
      "href",
      `/matches/${liveMatch.id}/score`,
    );
    // The card should only display a single Live status pill, never duplicate Live action buttons
    expect(screen.getAllByText("Live")).toHaveLength(1);
  });

  it("hides scoring actions from non-scoring users", () => {
    renderCard(<MatchCard match={liveMatch} />);
    expect(screen.queryByText("Score")).not.toBeInTheDocument();
    // The live status pill still shows to everyone…
    expect(screen.getByText("Live")).toBeInTheDocument();
    // …but there is no second "Live" entry from the action row.
    expect(screen.getAllByText("Live")).toHaveLength(1);
  });

  it("opens the match from the card", () => {
    renderCard(<MatchCard match={liveMatch} contextQuery="from=matches" />);
    expect(
      screen.getByRole("link", { name: "Royal Tigers versus Coastal Kings" }),
    ).toHaveAttribute("href", `/matches/${liveMatch.id}?from=matches`);
  });

  it("shows an upcoming match as a fixture with its start time", () => {
    renderCard(
      <MatchCard
        match={makeMatch({
          status: "scheduled",
          innings: [],
          scheduled_at: "2026-08-10T14:00:00",
        })}
        canScore
      />,
    );
    expect(screen.getByText("14:00")).toBeInTheDocument();
    expect(screen.getByText("Upcoming")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /score/i })).toBeInTheDocument();
  });

  it("renders both team names and the running score", () => {
    renderCard(<MatchCard match={liveMatch} />);
    expect(screen.getByText("Royal Tigers")).toBeInTheDocument();
    expect(screen.getByText("Coastal Kings")).toBeInTheDocument();
    expect(screen.getByText("98/3")).toBeInTheDocument();
  });
});

describe("MatchCard live updates", () => {
  const id = "11111111-2222-4333-8444-000000000001";
  const match = makeMatch({
    ...liveMatch,
    id,
    innings: liveMatch.innings!.map((i) => ({ ...i, match_id: id })),
  });
  const liveDoc = (version: number, runs: number) => ({
    match_id: id,
    status: "live",
    innings_number: 1,
    total_runs: runs,
    total_wickets: 3,
    total_balls: 63,
    total_overs: 10.3,
    version,
  });

  it("follows the match's live_state doc without a refetch", () => {
    renderCard(<MatchCard match={match} />);
    const watch = watches.find((w) => w.table === "live_state" && w.id === id);
    expect(watch).toBeDefined();

    act(() => watch!.next(liveDoc(5, 98)));
    expect(screen.getByText("98/3")).toBeInTheDocument();
    act(() => watch!.next(liveDoc(6, 102)));
    expect(screen.getByText("102/3")).toBeInTheDocument();
    expect(screen.getByText("10.3 ov")).toBeInTheDocument();
    expect(getMatches).not.toHaveBeenCalled();
  });

  it("shows the innings in progress once the live doc has corrected it", () => {
    // The match summary does not follow every ball: its score of the
    // innings in progress may be behind until live_state arrives.
    const other = "11111111-2222-4333-8444-000000000002";
    renderCard(
      <MatchCard
        match={makeMatch({
          ...match,
          id: other,
          innings: liveMatch.innings!.map((i) => ({
            ...i,
            match_id: other,
            total_runs: 40,
            total_wickets: 1,
          })),
        })}
      />,
    );
    expect(screen.queryByText("40/1")).not.toBeInTheDocument();
    const watch = watches.find(
      (w) => w.table === "live_state" && w.id === other,
    );
    act(() => watch!.next({ ...liveDoc(9, 98), match_id: other }));
    expect(screen.getByText("98/3")).toBeInTheDocument();
  });

  it("does not listen for matches that are not live", () => {
    const before = watches.length;
    renderCard(
      <MatchCard match={makeMatch({ ...match, status: "completed" })} />,
    );
    expect(watches).toHaveLength(before);
  });
});
