"use client";

import { useEffect, useState } from "react";
import { Pencil, Users, X } from "lucide-react";
import { Button } from "~/components/ds/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { useLiveState, type LiveLastChange } from "~/lib/hooks/useLiveState";
import { describeCorrection } from "~/lib/scoring-correction";

/** How long after another scorer's last change the notice stays up. */
export const OTHER_SCORER_WINDOW_MS = 2 * 60 * 1000;

/**
 * How long another scorer's correction stays up: longer than a ball, as it
 * changes what this screen showed before (docs/scoring-corrections.md, 1.5).
 */
export const CORRECTION_WINDOW_MS = 10 * 60 * 1000;

const windowOf = (change: LiveLastChange | null) =>
  change?.correction ? CORRECTION_WINDOW_MS : OTHER_SCORER_WINDOW_MS;

/**
 * The latest ball-log change when it was made by someone other than
 * `userId` within its window before `now` (two minutes; ten for a
 * correction), else null.
 */
export function otherScorerChange(
  change: LiveLastChange | null,
  userId: string | null | undefined,
  now: number,
  windowMs: number = windowOf(change),
): LiveLastChange | null {
  if (!change || !userId || change.uid === userId) return null;
  const at = Date.parse(change.at);
  if (!Number.isFinite(at) || now - at >= windowMs) return null;
  return change;
}

/**
 * A small header chip shown while someone else is scoring this match (they
 * recorded, undid or edited a ball in the last ~2 minutes). It sits in the
 * header row, so it adds no height to the phone scoring column. Tapping it
 * dismisses it until that scorer has been quiet for the window.
 *
 * Another scorer's correction (a ball edited, batters swapped, an over's
 * bowler changed, a player replaced) says so instead, and tapping it shows
 * what they changed, in words (`describeCorrection`, names from `nameOf`).
 *
 * Follows the `live_state` doc viewers already watch; no extra reads.
 */
export function OtherScorerNotice({
  matchId,
  userId,
  nameOf = () => null,
}: {
  matchId: string;
  userId: string | null | undefined;
  /** A player's name, from the squads this screen holds. */
  nameOf?: (id: string) => string | null | undefined;
}) {
  const { lastChange } = useLiveState(matchId);
  // Changes older than the window when the screen opened never show.
  const [openedAt] = useState(() => Date.now());
  /** `at` of the latest change once its window has passed. */
  const [expired, setExpired] = useState<string | null>(null);
  /** Scorer whose notice was dismissed, until they go quiet. */
  const [dismissed, setDismissed] = useState<string | null>(null);
  /** `at` of a correction already read. */
  const [read, setRead] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);

  const at = lastChange?.at ?? null;
  const windowMs = windowOf(lastChange);
  useEffect(() => {
    if (!at) return;
    const endsIn = Date.parse(at) + windowMs - Date.now();
    const timer = setTimeout(
      () => {
        setExpired(at);
        setDismissed(null);
      },
      Math.max(0, endsIn),
    );
    return () => clearTimeout(timer);
  }, [at, windowMs]);

  const active =
    at !== expired ? otherScorerChange(lastChange, userId, openedAt) : null;
  if (!active) return null;
  const name = active.name?.trim() || "Another scorer";
  const first = name.split(" ")[0];

  if (active.correction) {
    if (read === active.at) return null;
    const what = describeCorrection(active.correction, nameOf);
    const time = new Date(active.at).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    return (
      <>
        <button
          type="button"
          role="status"
          aria-live="polite"
          aria-label={`${name} made a correction. Show it`}
          onClick={() => setShowing(true)}
          className="flex min-w-0 items-center gap-1 rounded-full border border-warning/40 bg-warning/10 px-2 py-0.5 text-xs font-medium text-foreground transition-colors hover:bg-warning/20"
        >
          <Pencil className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span className="max-w-[8rem] truncate sm:max-w-[14rem]">
            <span className="sm:hidden">{first} corrected</span>
            <span className="hidden sm:inline">{name} made a correction</span>
          </span>
        </button>
        <Dialog open={showing} onOpenChange={setShowing}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{name} made a correction</DialogTitle>
              <DialogDescription>
                At {time}, {name} {what}. The scorecard on this screen already
                shows it.
              </DialogDescription>
            </DialogHeader>
            <Button
              onClick={() => {
                setShowing(false);
                setRead(active.at);
              }}
            >
              OK
            </Button>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (dismissed === active.uid) return null;
  const label = `${name} is also scoring this match`;
  return (
    <button
      type="button"
      role="status"
      aria-live="polite"
      aria-label={`${label}. Dismiss`}
      title={`${label} (last change ${new Date(active.at).toLocaleTimeString()}). Tap to dismiss.`}
      onClick={() => setDismissed(active.uid)}
      className="flex min-w-0 items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/70"
    >
      <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="max-w-[8rem] truncate sm:max-w-[14rem]">
        <span className="sm:hidden">{first} also scoring</span>
        <span className="hidden sm:inline">{name} is also scoring</span>
      </span>
      <X className="h-3 w-3 shrink-0" aria-hidden="true" />
    </button>
  );
}
