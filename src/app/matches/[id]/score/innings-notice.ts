import {
  inningsLimits,
  isDecidingInnings,
  isSuperOverInnings,
} from "~/lib/firebase/scoring/result";
import type { MatchesRow } from "~/lib/firebase/types";
import type { Match } from "~/lib/match-types";
import {
  isTwoInningsMatch,
  nextAfterInnings,
  type MultiInningsMatch,
} from "~/lib/multi-innings";

/** Offline, the chase is over: only the server can settle the result. */
export const OFFLINE_MATCH_OVER =
  "The match is over. The result is saved when you're back online.";

/**
 * Whether an innings is a chase (the match's last innings: the 2nd, a
 * two-innings match's 4th, or a super over's 2nd): the one whose end
 * decides the match rather than opening another.
 */
export function isChaseInnings(
  match: MultiInningsMatch | null | undefined,
  inningsNumber: number | null | undefined,
) {
  return isDecidingInnings(match, inningsNumber ?? 1);
}

/** The match fields {@link nextInningsOnDevice} reads. */
export type DeviceInningsMatch = MultiInningsMatch &
  Pick<Match, "team1_id" | "team2_id"> &
  Partial<Pick<Match, "innings" | "current_innings">>;

/**
 * The innings this device opens when innings `inningsNumber` ends offline,
 * as the server will (`advanceAfterInnings`): its batting side and target.
 * Null when that end decides the match (a chase, a win by an innings),
 * which only the server settles. `runs`: the ending innings' total.
 */
export function nextInningsOnDevice(
  match: DeviceInningsMatch,
  inningsNumber: number,
  runs: number,
): { teamId: string; target: number | null } | null {
  if (isChaseInnings(match, inningsNumber)) return null;
  const innings = match.innings ?? [];
  const other = (id: string) =>
    id === match.team1_id ? match.team2_id : match.team1_id;
  const current = innings.find((i) => i.innings_number === inningsNumber);
  const before = innings.find((i) => i.innings_number === inningsNumber - 1);
  const teamId =
    current?.team_id ??
    (before?.team_id ? other(before.team_id) : match.team1_id);
  if (isTwoInningsMatch(match) && !isSuperOverInnings(match, inningsNumber)) {
    const next = nextAfterInnings(
      { team_id: teamId, innings_number: inningsNumber, total_runs: runs },
      innings,
      other,
    );
    return next.kind === "next"
      ? { teamId: next.teamId, target: next.target }
      : null;
  }
  return { teamId: other(teamId), target: runs + 1 };
}

/**
 * What the innings-over banner says: the server opens the next innings (or
 * settles the result) itself after the last ball; offline it cannot.
 */
export function inningsOverNotice({
  isChase,
  isOffline,
  awaitingServer,
}: {
  isChase: boolean;
  isOffline: boolean;
  awaitingServer: boolean;
}): { title: string; text: string; action: "end" | "finish" | null } {
  if (isOffline) {
    return isChase
      ? { title: "Match over", text: OFFLINE_MATCH_OVER, action: null }
      : {
          title: "Innings over",
          text: "End the innings to start the next one.",
          action: "end",
        };
  }
  if (awaitingServer) {
    return {
      title: isChase ? "Match over" : "Innings over",
      text: isChase
        ? "Saving the last ball. The result follows."
        : "Saving the last ball. The next innings opens after it.",
      action: null,
    };
  }
  return isChase
    ? {
        title: "Match over",
        text: "The target is reached or the innings is over.",
        action: "finish",
      }
    : {
        title: "Innings over",
        text: "End the innings to set the target and switch sides.",
        action: "end",
      };
}

/**
 * The engine's limits for an innings (`inningsLimits`: super overs are one
 * over and two wickets a side), read from the screen's match, so the
 * scoreboard and the innings-over check never differ from the server.
 */
export function limitsOfInnings(
  match: Pick<
    Match,
    "balls_per_over" | "overs_per_innings" | "wickets_per_innings"
  >,
  inningsNumber: number,
): { maxBalls: number; wicketsCap: number; ballsPerOver: number } {
  // The screen's match is the stored document (fields it does not type
  // included), which is what the engine reads.
  const { maxBalls, wicketsCap, ballsPerOver } = inningsLimits(
    match as unknown as MatchesRow,
    inningsNumber,
  );
  return { maxBalls, wicketsCap, ballsPerOver };
}
