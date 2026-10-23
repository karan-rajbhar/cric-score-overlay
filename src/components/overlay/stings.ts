/**
 * Event cards (four, six, wicket, milestone, free hit): their text, from the
 * live score, and their sounds. Pure, apart from {@link playStingSound}.
 */

import { formatHowOut } from "~/lib/cricket";
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
      const out = state?.last_ball_is_wicket
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

/**
 * The card a new delivery earns, if any: wicket, six, four or free hit, or
 * a fifty / hundred the striker just reached (`celebrated` remembers which
 * were shown, so each shows once).
 */
export function autoStingsFor(
  state: LiveMatchState,
  celebrated: Set<string>,
): ActiveEventSting[] {
  const seq = state.last_ball_seq ?? 0;
  const out: ActiveEventSting[] = [];
  if (state.last_ball_is_wicket) {
    out.push(stingFor("wicket", state, `wkt-${seq}`));
  } else if (state.last_ball_runs === 6) {
    out.push(stingFor("six", state, `six-${seq}`));
  } else if (state.last_ball_runs === 4) {
    out.push(stingFor("four", state, `four-${seq}`));
  } else if (state.last_ball_extra_type === "no_ball") {
    out.push(stingFor("free_hit", state, `freehit-${seq}`));
  }
  const name = state.striker_name;
  const runs = state.striker_runs ?? 0;
  if (name && !state.last_ball_is_wicket) {
    for (const mark of [100, 50]) {
      const key = `${state.innings_number ?? 1}-${name}-${mark}`;
      if (runs >= mark && runs < mark + 6 && !celebrated.has(key)) {
        celebrated.add(key);
        out.push(stingFor("milestone", state, `m${mark}-${seq}`));
        break;
      }
    }
  }
  return out;
}

export function playStingSound(type: StingType, volume: number): void {
  if (type === "four") playFourFanfare(volume);
  else if (type === "six") playSixExplosion(volume);
  else if (type === "wicket") playWicketTone(volume);
  else if (type === "milestone") playMilestoneFanfare(volume);
  else playFreeHitAlert(volume);
}
