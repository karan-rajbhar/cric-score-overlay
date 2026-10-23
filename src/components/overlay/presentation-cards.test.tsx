import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  DEMO_MATCH_DETAILS,
  DEMO_MATCH_STATE,
} from "~/app/overlay/[matchId]/demo-data";
import type { Match } from "~/lib/match-types";
import {
  PresentationCards,
  presentationCardAvailable,
  playingXi,
} from "./presentation-cards";
import type { PresentationCardType } from "./types";

const S = DEMO_MATCH_STATE;
const M = DEMO_MATCH_DETAILS;

const show = (card: PresentationCardType, state = S, match: Match | null = M) =>
  render(<PresentationCards card={card} state={state} match={match} />);

describe("PresentationCards", () => {
  it("renders nothing for none", () => {
    const { container } = show("none");
    expect(container.firstChild).toBeNull();
  });

  it("shows the toss from the live row", () => {
    show("toss");
    expect(screen.getByText(`${S.toss_winner_name} won the toss`)).toBeInTheDocument();
    expect(screen.getByText("Chose to bat")).toBeInTheDocument();
  });

  it("lists only players picked for this match", () => {
    const squad = M.team1.team_players!;
    const extra = { ...squad[0]!, id: "reserve", is_playing_xi: false, user: { id: "r", full_name: "Reserve Player" } };
    const match = { ...M, team1: { ...M.team1, team_players: [...squad, extra] } };
    expect(playingXi(match.team1.team_players)).toHaveLength(11);
    show("playing_xi", S, match);
    expect(screen.getByText("Playing XI")).toBeInTheDocument();
    expect(screen.queryByText("Reserve Player")).not.toBeInTheDocument();
  });

  it("has no Playing XI card when nobody is marked as playing", () => {
    const unpicked = (players = M.team1.team_players!) =>
      players.map((p) => ({ ...p, is_playing_xi: null }));
    const match = {
      ...M,
      team1: { ...M.team1, team_players: unpicked() },
      team2: { ...M.team2, team_players: unpicked(M.team2.team_players) },
    };
    expect(presentationCardAvailable("playing_xi", S, match)).toBe(false);
    const { container } = show("playing_xi", S, match);
    expect(container.firstChild).toBeNull();
  });

  it("shows the current innings' scorecard", () => {
    show("scorecard");
    expect(screen.getByText(`${S.batting_team_name} batting`)).toBeInTheDocument();
    expect(screen.getAllByText(S.striker_name!).length).toBeGreaterThan(0);
    expect(screen.getByText(/Fall of wickets/)).toBeInTheDocument();
  });

  it("shows the partnership with each batter's share", () => {
    show("partnership");
    expect(screen.getByText(`${S.partnership_runs} runs`)).toBeInTheDocument();
    expect(screen.getByText(S.striker_name!)).toBeInTheDocument();
  });

  it("shows this over's balls", () => {
    show("over_summary");
    expect(screen.getByRole("list", { name: "This over" })).toBeInTheDocument();
  });

  it("has no result card while the match is live", () => {
    expect(presentationCardAvailable("result", S, M)).toBe(false);
    const done = { ...S, status: "completed", result_description: "Riverside Rangers won by 4 wickets" };
    show("result", done);
    expect(screen.getByText("Riverside Rangers won by 4 wickets")).toBeInTheDocument();
  });

  it("puts no buttons on air", () => {
    show("scorecard");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
