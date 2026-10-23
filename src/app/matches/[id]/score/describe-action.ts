import { deliveryLabel } from "~/lib/cricket";
import type { QueuedAction } from "~/lib/offline-queue";
import { readBallLabel } from "~/components/matches/scoring-panel";
import { ALL_DISMISSAL_TYPES } from "./components/WicketDialog";

type NameOf = (id: string | null | undefined) => string | null;

/** "Caught", "Run out", ... (the dismissal's label). */
function dismissalLabel(type: string | null | undefined): string | null {
  if (!type) return null;
  return (
    ALL_DISMISSAL_TYPES.find((d) => d.value === type)?.label ??
    type.replace(/_/g, " ")
  );
}

/**
 * A queued scoring action in the scorer's words ("Four, Starc to Kohli",
 * "Wicket (caught), Starc to Kohli", "Bowler: Starc"), for the prompts that
 * ask before an unsaved action is dropped.
 */
export function describeQueuedAction(
  action: QueuedAction,
  nameOf: NameOf,
): string {
  const name = (id: string | null | undefined, fallback: string) =>
    nameOf(id) ?? fallback;
  switch (action.type) {
    case "recordBall": {
      const { event, bowlerId, batsmanId } = action.payload;
      const label = deliveryLabel({
        runs_scored: event.runsScored ?? 0,
        extras: event.extras ?? 0,
        extra_type: event.extraType ?? null,
        is_wicket: event.isWicket ?? false,
        dismissal_type: event.dismissalType ?? null,
        no_ball_runs: event.noBallRuns ?? null,
      });
      const how = event.isWicket ? dismissalLabel(event.dismissalType) : null;
      const what = how
        ? `Wicket (${how.toLowerCase()})`
        : readBallLabel(label).spoken;
      return `${what}, ${name(bowlerId, "the bowler")} to ${name(batsmanId, "the batter")}`;
    }
    case "setBatsmen":
      return `Batters: ${name(action.payload.strikerId, "striker")} and ${name(action.payload.nonStrikerId, "non-striker")}`;
    case "setBowler":
      return `Bowler: ${name(action.payload.bowlerId, "the bowler")}`;
    case "reassignOverBowler":
      return `This over's balls given to ${name(action.payload.bowlerId, "another bowler")}`;
    case "endInnings":
      return "End of the innings";
    case "undoLastBall":
      return "Undo of the last ball";
    case "startSuperOver":
      return "Start of the super over";
    case "retireBatter":
      return `${name(action.payload.playerId, "A batter")} ${
        action.payload.type === "retired_hurt" ? "retired hurt" : "retired out"
      }`;
    case "awardPenalty": {
      const { runs, type, teamId } = action.payload;
      return `${runs} ${type === "bonus" ? "bonus" : "penalty"} run${runs === 1 ? "" : "s"} to ${name(teamId, "a team")}`;
    }
    case "replaceBatter":
      return `${name(action.payload.fromId, "A batter")}'s innings given to ${name(action.payload.toId, "another batter")}`;
    case "updateBall":
      return "Correction of a ball";
  }
}
