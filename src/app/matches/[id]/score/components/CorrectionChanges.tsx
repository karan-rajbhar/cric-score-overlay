"use client";

import type { FigureChange } from "../correction-preview";

/**
 * What a correction changes, before it is saved: each player's line old and
 * new, the innings total when it moves, and, on a finished match, that the
 * result is worked out again (docs/scoring-corrections.md, "Show the result
 * before saving"). Nothing while the figures cannot be worked out.
 */
export function CorrectionChanges({
  changes,
  total = null,
  finished = false,
  nameOf,
}: {
  changes: FigureChange[] | null;
  total?: { before: string; after: string } | null;
  /** The match is over: a new total gives a new result. */
  finished?: boolean;
  nameOf: (id: string | null | undefined) => string;
}) {
  if (!changes) return null;
  if (changes.length === 0 && !total) {
    return <p className="text-sm text-muted-foreground">No figures change.</p>;
  }
  return (
    <div
      aria-live="polite"
      className="rounded-lg bg-primary-soft px-3.5 py-3 text-sm text-primary-soft-foreground"
    >
      <p className="mb-1.5 font-medium">What changes</p>
      <ul className="space-y-1">
        {total && (
          <li className="tabular-nums">
            Total: {total.before} <span aria-hidden="true">→</span>
            <span className="sr-only">becomes</span> {total.after}
          </li>
        )}
        {changes.map((c) => (
          <li key={`${c.playerId}-${c.role}`} className="tabular-nums">
            {nameOf(c.playerId)}
            {c.role === "bowling" ? " (bowling)" : ""}: {c.before ?? "no figures"}{" "}
            <span aria-hidden="true">→</span>
            <span className="sr-only">becomes</span> {c.after ?? "no figures"}
          </li>
        ))}
      </ul>
      {total && finished && (
        <p className="mt-1.5 text-xs">
          The match is over, so its result is worked out again.
        </p>
      )}
    </div>
  );
}
