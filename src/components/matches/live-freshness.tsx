"use client";

import { useEffect, useState } from "react";
import { useLiveState } from "~/lib/hooks/useLiveState";
import { cn } from "~/lib/utils";

/** How often the "Updated … ago" line is recounted. */
const TICK_MS = 30_000;

/** "just now", "1 min ago", "12 min ago", then the time: "at 14:05". */
export function updatedAgo(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return "";
  const mins = Math.floor(Math.max(0, now - at) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  return `at ${new Date(at).toLocaleTimeString("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  })}`;
}

/**
 * Under a live match's score: when the scoreboard last changed ("Updated
 * 3 min ago"), so a pause in play does not look like a frozen page, or
 * "Reconnecting…" while the live connection is down. Follows the page's
 * `live_state` listener (no reads of its own).
 */
export function LiveFreshness({
  matchId,
  className,
}: {
  matchId: string;
  className?: string;
}) {
  const { status, loaded, updatedAt } = useLiveState(matchId);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);
  // An update newer than the last tick reads "just now" (never negative).
  const down = status === "connecting" || status === "error";
  const text = down
    ? loaded
      ? "Reconnecting…"
      : "Connecting…"
    : updatedAt
      ? `Updated ${updatedAgo(updatedAt, now)}`
      : null;
  return (
    // Announced only when the connection drops or comes back, not on
    // every recount.
    <p
      role="status"
      aria-live={down ? "polite" : "off"}
      className={cn(
        "text-center text-xs tabular-nums text-muted-foreground",
        !text && "hidden",
        className,
      )}
    >
      {text}
    </p>
  );
}
