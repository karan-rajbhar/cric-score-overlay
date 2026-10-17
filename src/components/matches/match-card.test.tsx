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
    expect(screen.getByText("Score")).toBeInTheDocument();
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

  it("always shows the scorecard link", () => {
    renderCard(<MatchCard match={liveMatch} />);
    expect(screen.getByText("Scorecard")).toBeInTheDocument();
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

  it("does not listen for matches that are not live", () => {
    const before = watches.length;
    renderCard(
      <MatchCard match={makeMatch({ ...match, status: "completed" })} />,
    );
    expect(watches).toHaveLength(before);
  });
});
