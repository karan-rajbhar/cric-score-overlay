"use client";

/**
 * Full-screen presentation cards: toss, playing XI, scorecard, partnership,
 * this over and the result. Each shows only what the match has: a card
 * whose data does not exist renders nothing, and
 * {@link presentationCardAvailable} lets the control room disable it.
 *
 * The visuals are the package's elements (`packages/`), falling back to
 * the Standard ones in `presentation-card-views.tsx`. No on-air buttons:
 * the producer hides a card from the control room (or Escape).
 */

import type { Match } from "~/lib/match-types";
import { useScorecardInnings } from "./overlay-data";
import { overTokens, type OverlayThemeProps } from "./overlay-kit";
import { OverlayElement } from "./packages/element";
import { playingXi, tossWinnerName } from "./presentation-card-views";
import { inningsTeamName } from "./scorecard-cards";
import type { LiveMatchState, PresentationCardType } from "./types";

export { playingXi, tossWinnerName };

interface PresentationCardsProps extends OverlayThemeProps {
  card: PresentationCardType;
  state: LiveMatchState;
  match: Match | null;
  /** Kept for callers; the cards have no on-air close button. */
  onClose?: () => void;
}

/** Whether a card has the data it shows (the control room disables it otherwise). */
export function presentationCardAvailable(
  card: PresentationCardType,
  state: LiveMatchState,
  match: Match | null | undefined,
): boolean {
  switch (card) {
    case "none":
      return false;
    case "toss":
      return !!state.toss_winner_team_id && !!tossWinnerName(state, match);
    case "playing_xi":
      return (
        playingXi(match?.team1?.team_players).length > 0 ||
        playingXi(match?.team2?.team_players).length > 0
      );
    case "scorecard":
      return (state.innings_number ?? 0) > 0;
    case "partnership":
      return (
        state.partnership_runs !== null &&
        !!state.striker_name &&
        !!state.non_striker_name
      );
    case "over_summary":
      return overTokens(state).length > 0;
    case "result":
      return state.status === "completed" && !!state.result_description;
  }
}

const CARD_REASON: Record<PresentationCardType, string> = {
  none: "",
  toss: "No toss recorded yet",
  playing_xi: "No playing XI picked yet",
  scorecard: "Starts with the first innings",
  partnership: "Only while an innings is in play",
  over_summary: "Only while an over is in progress",
  result: "After the match",
};

/**
 * Why a card cannot go up (the control room's hint), or null when it can:
 * {@link presentationCardAvailable} in words.
 */
export function presentationCardUnavailable(
  card: PresentationCardType,
  state: LiveMatchState,
  match: Match | null | undefined,
): string | null {
  return presentationCardAvailable(card, state, match)
    ? null
    : CARD_REASON[card] || "Not available yet";
}

export function PresentationCards({
  card,
  state,
  match,
  theme = "standard",
  customColors = null,
}: PresentationCardsProps) {
  const { innings } = useScorecardInnings(match);
  const on = presentationCardAvailable(card, state, match);
  const base = {
    state,
    match,
    snapshots: null,
    theme,
    customColors,
    layout: "bottom" as const,
  };
  const current =
    innings.find((i) => i.innings_number === state.innings_number) ??
    innings[innings.length - 1];

  return (
    <>
      <OverlayElement
        id="toss"
        present={on && card === "toss"}
        props={base}
      />
      <OverlayElement
        id="playingXi"
        present={on && card === "playing_xi"}
        props={{ ...base, side: null }}
      />
      {current && (
        <OverlayElement
          id="scorecard"
          present={on && card === "scorecard"}
          props={{
            ...base,
            innings: current,
            teamName: inningsTeamName(state, current, match?.team1_id),
            full: true,
          }}
        />
      )}
      <OverlayElement
        id="partnership"
        present={on && card === "partnership"}
        props={{ ...base, variant: "card", strap: null }}
      />
      <OverlayElement
        id="thisOver"
        present={on && card === "over_summary"}
        props={{ ...base, variant: "card", strap: null }}
      />
      <OverlayElement
        id="result"
        present={on && card === "result"}
        props={{ ...base, innings }}
      />
    </>
  );
}
