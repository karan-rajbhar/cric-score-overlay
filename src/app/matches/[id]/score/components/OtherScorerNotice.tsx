"use client";

import { useEffect, useState } from "react";
import { Users, X } from "lucide-react";
import { useLiveState, type LiveLastChange } from "~/lib/hooks/useLiveState";

/** How long after another scorer's last change the notice stays up. */
export const OTHER_SCORER_WINDOW_MS = 2 * 60 * 1000;

/**
 * The latest ball-log change when it was made by someone other than
 * `userId` less than the window before `now`, else null.
 */
export function otherScorerChange(
  change: LiveLastChange | null,
  userId: string | null | undefined,
  now: number,
  windowMs: number = OTHER_SCORER_WINDOW_MS,
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
 * Follows the `live_state` doc viewers already watch; no extra reads.
 */
export function OtherScorerNotice({
  matchId,
  userId,
}: {
  matchId: string;
  userId: string | null | undefined;
}) {
  const { lastChange } = useLiveState(matchId);
  // Changes older than the window when the screen opened never show.
  const [openedAt] = useState(() => Date.now());
  /** `at` of the latest change once its window has passed. */
  const [expired, setExpired] = useState<string | null>(null);
  /** Scorer whose notice was dismissed, until they go quiet. */
  const [dismissed, setDismissed] = useState<string | null>(null);

  const at = lastChange?.at ?? null;
  useEffect(() => {
    if (!at) return;
    const endsIn = Date.parse(at) + OTHER_SCORER_WINDOW_MS - Date.now();
    const timer = setTimeout(
      () => {
        setExpired(at);
        setDismissed(null);
      },
      Math.max(0, endsIn),
    );
    return () => clearTimeout(timer);
  }, [at]);

  const active =
    at !== expired ? otherScorerChange(lastChange, userId, openedAt) : null;
  if (!active || dismissed === active.uid) return null;
  const name = active.name?.trim() || "Another scorer";
  const label = `${name} is also scoring this match`;
  return (
    <button
      type="button"
      role="status"
      aria-live="polite"
      aria-label={`${label}. Dismiss`}
      title={`${label} (last change ${new Date(active.at).toLocaleTimeString()}). Tap to dismiss.`}
      onClick={() => setDismissed(active.uid)}
      className="flex min-w-0 items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground transition-colors hover:bg-muted/70 sm:text-xs"
    >
      <Users className="h-3 w-3 shrink-0" aria-hidden="true" />
      <span className="max-w-[8rem] truncate sm:max-w-[14rem]">
        <span className="sm:hidden">{name.split(" ")[0]} also scoring</span>
        <span className="hidden sm:inline">{name} is also scoring</span>
      </span>
      <X className="h-3 w-3 shrink-0" aria-hidden="true" />
    </button>
  );
}
