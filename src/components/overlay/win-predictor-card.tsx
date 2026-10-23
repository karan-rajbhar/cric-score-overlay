"use client";

/**
 * Win predictor card (the slim strap is the "win_predictor" lower third):
 * in a chase each side's chance as a split bar, in the first innings a
 * projected score range. Always labelled "Estimate"; see
 * `~/lib/win-predictor` for the model (DLS resources).
 */

import { cn } from "~/lib/utils";
import { winPredictorFromLive, type WinEstimate } from "~/lib/win-predictor";
import {
  CardShell,
  eyebrowOf,
  OV,
  teamCode,
  type OverlayThemeProps,
} from "./overlay-kit";
import type { LiveMatchState } from "./types";

/** The estimate for this row, or null (no innings in play, super over). */
export function winEstimateOf(state: LiveMatchState): WinEstimate | null {
  return winPredictorFromLive(state);
}

export function winPredictorAvailable(state: LiveMatchState): boolean {
  return winEstimateOf(state) !== null;
}

export function WinPredictorCard({
  state,
}: OverlayThemeProps & { state: LiveMatchState }) {
  const est = winEstimateOf(state);
  if (!est) return null;
  const bat = teamCode(state.batting_team_short_name, state.batting_team_name);
  const bowl = teamCode(state.bowling_team_short_name, state.bowling_team_name);

  if (est.kind === "projection") {
    return (
      <CardShell
        className="max-w-[52rem]"
        eyebrow={eyebrowOf(state, "Estimate")}
        title="Projected score"
        aside={
          <span className="text-[2.5rem] font-bold tabular-nums">
            {est.low} to {est.high}
          </span>
        }
      >
        <p className={cn("text-lg", OV.cardMuted)}>
          {state.batting_team_name} are {state.total_runs}/{state.total_wickets}.
          At this scoring rate, with the overs and wickets left, they would
          most likely finish around {est.mid}.
        </p>
      </CardShell>
    );
  }

  return (
    <CardShell
      className="max-w-[56rem]"
      eyebrow={eyebrowOf(state, "Estimate")}
      title="Win predictor"
      aside={
        <span className={cn("text-lg tabular-nums", OV.barMuted)}>
          Need {est.runsNeeded} from {est.ballsLeft}
        </span>
      }
    >
      <div className="flex items-baseline justify-between text-[2rem] font-bold tabular-nums">
        <span>
          {bat} {est.battingPct}%
        </span>
        <span>
          {est.bowlingPct}% {bowl}
        </span>
      </div>
      <div
        role="img"
        aria-label={`${bat} ${est.battingPct} percent, ${bowl} ${est.bowlingPct} percent`}
        className="mt-3 flex h-4 overflow-hidden rounded-full"
      >
        <span className="bg-series-1" style={{ width: `${est.battingPct}%` }} />
        <span className="flex-1 bg-series-2" />
      </div>
      <p className={cn("mt-3 text-base", OV.cardMuted)}>
        From the runs needed, balls and wickets left, against the first
        innings' scoring rate.
      </p>
    </CardShell>
  );
}
