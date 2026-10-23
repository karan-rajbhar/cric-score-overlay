"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { deliveryLabel } from "~/lib/cricket";
import { readBallLabel } from "~/components/matches/scoring-panel";
import { cn } from "~/lib/utils";
import type { DeliveryToEdit } from "./EditBallDialog";

/** A ball-log row as `getMatchBallLog` returns it. */
type LoggedBall = DeliveryToEdit & {
  innings_id?: string | null;
  seq?: number | null;
  penalty_team_id?: string | null;
};

/** This innings' deliveries by over, latest over first (no events). */
export function oversToCorrect(
  balls: LoggedBall[],
  inningsId: string,
): Array<{ over: number; balls: LoggedBall[] }> {
  const byOver = new Map<number, LoggedBall[]>();
  for (const b of balls) {
    if (b.innings_id !== inningsId) continue;
    // Retirements and runs awarded are logged between balls: undo them.
    if (!b.bowler_id || b.penalty_team_id) continue;
    if (b.extra_type === "penalty" || b.extra_type === "bonus") continue;
    const over = b.over_number ?? 0;
    byOver.set(over, [...(byOver.get(over) ?? []), b]);
  }
  return Array.from(byOver.entries())
    .sort(([a], [b]) => b - a)
    .map(([over, list]) => ({
      over,
      balls: list.sort((x, y) => (x.seq ?? 0) - (y.seq ?? 0)),
    }));
}

/**
 * Every ball of the innings so far, to pick one to correct (any over: the
 * server recomputes the innings from the ball log). Read when it opens.
 */
export function EarlierBallsDialog({
  open,
  onOpenChange,
  inningsId,
  loadBalls,
  onPick,
  offline = false,
  unsaved = 0,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inningsId: string | null;
  /** The match's ball log (`getMatchBallLog`). */
  loadBalls: () => Promise<LoggedBall[]>;
  onPick: (ball: DeliveryToEdit) => void;
  offline?: boolean;
  /** Actions still waiting to be saved (their balls are not listed yet). */
  unsaved?: number;
}) {
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error" }
    | { status: "ready"; balls: LoggedBall[] }
  >({ status: "loading" });
  // Read afresh each time it opens (a ball corrected since changes it).
  const [seen, setSeen] = useState(open);
  if (seen !== open) {
    setSeen(open);
    if (open) setState({ status: "loading" });
  }

  useEffect(() => {
    if (!open || offline) return;
    let live = true;
    loadBalls()
      .then((balls) => {
        if (live) setState({ status: "ready", balls });
      })
      .catch(() => {
        if (live) setState({ status: "error" });
      });
    return () => {
      live = false;
    };
  }, [open, offline, loadBalls]);

  const overs =
    state.status === "ready" && inningsId
      ? oversToCorrect(state.balls, inningsId)
      : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-left">
          <DialogTitle>Correct a ball</DialogTitle>
          <DialogDescription>
            Tap the ball to correct. The scorecard is worked out again from
            every ball, so later balls stay as they are.
          </DialogDescription>
        </DialogHeader>
        {offline ? (
          <p className="text-sm text-muted-foreground">
            Correcting a ball needs a connection. The balls of this over can
            be undone instead.
          </p>
        ) : state.status === "loading" ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading the balls of this innings…
          </p>
        ) : state.status === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            Could not load the balls. Check the connection and try again.
          </p>
        ) : overs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No balls in this innings yet.
          </p>
        ) : (
          <ol className="max-h-[60vh] space-y-3 overflow-y-auto">
            {overs.map(({ over, balls }) => (
              <li key={over} className="space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground">
                  Over {over + 1}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {balls.map((b) => {
                    const label = deliveryLabel(b);
                    const read = readBallLabel(label);
                    return (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onPick(b)}
                        aria-label={`Ball ${over}.${b.ball_number ?? 1}: ${read.spoken}`}
                        className={cn(
                          "flex h-11 min-w-11 items-center justify-center rounded-full border px-2 font-score text-xs font-bold tabular-nums transition-colors hover:bg-muted",
                          read.kind === "wicket"
                            ? "border-wicket bg-wicket text-wicket-foreground"
                            : read.kind === "four"
                              ? "border-four bg-four text-four-foreground"
                              : read.kind === "six"
                                ? "border-six bg-six text-six-foreground"
                                : read.kind === "extra"
                                  ? "border-dashed border-extra/60 bg-extra/15 text-extra"
                                  : "border-border bg-background text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </li>
            ))}
          </ol>
        )}
        {unsaved > 0 && !offline && (
          <p className="text-xs text-muted-foreground">
            Balls not saved yet are not listed.
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}
