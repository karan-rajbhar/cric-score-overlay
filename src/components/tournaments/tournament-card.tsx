import type * as React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { cardSurface } from "~/components/ds/card";
import { StatusBadge } from "~/components/ui/status-badge";
import { formatTournamentFormat } from "~/lib/cricket";
import { cn } from "~/lib/utils";

/** "1 Sept 2024" from an ISO date. */
const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

/**
 * A tournament in a list: trophy crest, name and status, format and venue,
 * dates, a line of description. The card opens the tournament; `actions`
 * (an organiser's tools) sit under it, outside the link.
 */
export function TournamentCard({
  href,
  tournament: t,
  extra,
  actions,
}: {
  href: string;
  tournament: {
    name: string;
    status?: string | null;
    tournament_format?: string | null;
    match_format?: string | null;
    venue?: string | null;
    start_date?: string | null;
    end_date?: string | null;
    description?: string | null;
  };
  /** One more fact after the dates ("2024 season"). */
  extra?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const body = (
    <>
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Trophy className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 space-y-1">
        <span className="flex items-start justify-between gap-2">
          <span className="min-w-0 truncate text-base font-semibold text-foreground">
            {t.name}
          </span>
          <StatusBadge status={t.status ?? "upcoming"} className="shrink-0" />
        </span>
        <span className="block truncate text-sm text-muted-foreground">
          {[
            formatTournamentFormat(t.tournament_format),
            t.match_format,
            t.venue,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {(t.start_date || t.end_date || extra) && (
          <span className="block font-score text-xs tabular-nums text-muted-foreground">
            {[t.start_date, t.end_date]
              .filter(Boolean)
              .map((d) => day(d!))
              .join(" to ")}
            {extra && (t.start_date || t.end_date) && " · "}
            {extra}
          </span>
        )}
        {t.description && (
          <span className="line-clamp-2 block text-sm text-foreground/80">
            {t.description}
          </span>
        )}
      </span>
    </>
  );
  const link = (
    <Link
      href={href}
      className={cn(
        "flex min-w-0 gap-3 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        actions ? "rounded-t-[inherit]" : "rounded-[inherit]",
      )}
    >
      {body}
    </Link>
  );
  return (
    <article
      className={cn(
        cardSurface,
        "flex min-w-0 flex-col transition-shadow hover:shadow-float",
      )}
    >
      {link}
      {actions && (
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border px-4 py-2.5">
          {actions}
        </div>
      )}
    </article>
  );
}
