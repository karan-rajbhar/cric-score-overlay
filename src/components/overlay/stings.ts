/**
 * Event cards the producer asks for (four, six, wicket, milestone, free
 * hit): their text, from the live score, and their sounds. Automatic ones
 * come from `live_state.events` (`auto-graphics.ts`). Pure, apart from
 * {@link playStingSound}.
 */

import { formatHowOut, isWicketFall } from "~/lib/cricket";
import {
  playFourFanfare,
  playFreeHitAlert,
  playMilestoneFanfare,
  playSixExplosion,
  playWicketTone,
} from "./sound-effects";
import type { ActiveEventSting, LiveMatchState } from "./types";

export type StingType = ActiveEventSting["type"];

const DURATION_MS: Record<StingType, number> = {
  four: 3800,
  six: 4200,
  wicket: 4500,
  milestone: 5000,
  free_hit: 4000,
};

function batterLine(state: LiveMatchState | null): string | undefined {
  if (!state?.striker_name) return undefined;
  return `${state.striker_runs ?? 0}* (${state.striker_balls ?? 0}b)`;
}

/** The wicket's line: "lbw b Starc", "c Smith b Starc", "run out (Lee)"... */
function dismissalLine(state: LiveMatchState): string | undefined {
  if (!state.last_ball_dismissal_type) return undefined;
  return formatHowOut(
    true,
    state.last_ball_dismissal_type,
    state.current_bowler_name,
    state.last_ball_fielder,
  );
}

/**
 * The card a producer asks for, worded from the live score. Nothing is
 * made up: a wicket card names the batter only when the last ball was
 * that wicket, a milestone says fifty / hundred only when the striker has it.
 */
export function stingFor(
  type: StingType,
  state: LiveMatchState | null,
  id: string,
): ActiveEventSting {
  const base = { id, type, durationMs: DURATION_MS[type] };
  switch (type) {
    case "four":
      return {
        ...base,
        title: "Four",
        subtitle: state?.striker_name ?? undefined,
        detail: batterLine(state),
      };
    case "six":
      return {
        ...base,
        title: "Six",
        subtitle: state?.striker_name ?? undefined,
        detail: batterLine(state),
      };
    case "wicket": {
      const out =
        state &&
        isWicketFall({
          is_wicket: state.last_ball_is_wicket,
          dismissal_type: state.last_ball_dismissal_type,
        })
          ? state.last_ball_dismissed_player
          : null;
      return {
        ...base,
        title: "Wicket",
        subtitle: out ? `${out} out` : undefined,
        detail: out && state ? dismissalLine(state) : undefined,
      };
    }
    case "milestone": {
      const runs = state?.striker_runs ?? 0;
      const name = state?.striker_name;
      const title =
        runs >= 100 ? "Hundred" : runs >= 50 ? "Fifty" : "Milestone";
      return {
        ...base,
        title,
        subtitle: name ?? undefined,
        detail: name
          ? `${runs} off ${state?.striker_balls ?? 0} balls`
          : undefined,
      };
    }
    case "free_hit":
      return {
        ...base,
        title: "Free hit",
        subtitle: "No-ball called",
        detail: "Next delivery is a free hit",
      };
  }
}

export function playStingSound(type: StingType, volume: number): void {
  if (type === "four") playFourFanfare(volume);
  else if (type === "six") playSixExplosion(volume);
  else if (type === "wicket") playWicketTone(volume);
  else if (type === "milestone") playMilestoneFanfare(volume);
  else playFreeHitAlert(volume);
}
