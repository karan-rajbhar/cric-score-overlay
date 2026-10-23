import type * as React from "react";
import Link from "next/link";
import { Trophy } from "lucide-react";
import { cn } from "~/lib/utils";
import { TeamCrest } from "~/components/ds/avatar";
import { cardSurface } from "~/components/ds/card";
import { MatchStatusChip } from "~/components/ds/chip";
import {
  InningsScore,
  type InningsRef,
  type TeamRef,
} from "~/components/ds/score";

type Side = { team: TeamRef; innings?: InningsRef; dim?: boolean };

function TeamScoreRow({ team, innings, dim }: Side) {
  return (
    <div className="flex items-center gap-3">
      <TeamCrest {...team} size="sm" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm font-semibold",
          dim ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {team.name}
      </span>
      {innings ? (
        <InningsScore innings={innings} size="sm" dim={dim} inline />
      ) : (
        <span className="text-xs text-muted-foreground">Yet to bat</span>
      )}
    </div>
  );
}

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

/**
 * The card around a match: a link as a whole, or, with an `action` (a
 * Score button), a link over the body with the action under it, outside
 * the link.
 */
function CardLink({
  href,
  label,
  className,
  bodyClassName,
  action,
  children,
}: {
  href?: string;
  label: string;
  className: string;
  bodyClassName?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  const hover = href && "transition-shadow hover:shadow-float";
  const body = href ? (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "flex flex-1 flex-col",
        focusRing,
        action ? "rounded-t-[inherit]" : "rounded-[inherit]",
        bodyClassName,
      )}
    >
      {children}
    </Link>
  ) : (
    <div className={cn("flex flex-1 flex-col", bodyClassName)}>{children}</div>
  );
  return (
    <article className={cn("flex min-w-0 flex-col", hover, className)}>
      {body}
      {action && (
        <div className="flex gap-2 border-t border-border px-4 py-3">
          {action}
        </div>
      )}
    </article>
  );
}

/**
 * Live or finished match in a list: competition and status, the two sides
 * in batting order, then one line (chase equation or result).
 */
export function MatchCard({
  href,
  label,
  competition,
  status,
  first,
  second,
  note,
  action,
  className,
}: {
  href?: string;
  /**
   * The link's name for screen readers, which replaces what the card
   * shows: give the status, scores and result too ("A versus B" without).
   */
  label?: string;
  competition: React.ReactNode;
  status: string;
  first: Side;
  second: Side;
  note?: React.ReactNode;
  /** Under the card, outside its link: "Score". */
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <CardLink
      href={href}
      label={label ?? `${first.team.name} versus ${second.team.name}`}
      className={cn(cardSurface, className)}
      action={action}
    >
      <div className="flex items-center justify-between gap-3 px-4 pt-4 text-xs text-muted-foreground">
        <span className="truncate">{competition}</span>
        <MatchStatusChip status={status} />
      </div>
      <div className="space-y-3 px-4 py-4">
        <TeamScoreRow {...first} />
        <TeamScoreRow {...second} />
      </div>
      {note && (
        <div className="mt-auto border-t border-border px-4 py-3">{note}</div>
      )}
    </CardLink>
  );
}

function FixtureSide({ team }: { team: TeamRef }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-2 text-center">
      <TeamCrest {...team} size="md" />
      <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
        {team.name}
      </span>
    </div>
  );
}

/**
 * Upcoming fixture, Scoreline style: the date above, then crest, start time
 * in navy, crest; the venue below. Inside a CompetitionGroup it drops its
 * own card (`bare`).
 */
export function FixtureCard({
  href,
  label,
  date,
  time,
  home,
  away,
  venue,
  action,
  bare = false,
  className,
}: {
  href?: string;
  /** The link's name for screen readers (see MatchCard). */
  label?: string;
  date: React.ReactNode;
  time: React.ReactNode;
  home: TeamRef;
  away: TeamRef;
  venue?: React.ReactNode;
  /** Under the card, outside its link: "Score". */
  action?: React.ReactNode;
  bare?: boolean;
  className?: string;
}) {
  return (
    <CardLink
      href={href}
      label={label ?? `${home.name} versus ${away.name}`}
      className={cn(bare ? "rounded-xl" : cardSurface, className)}
      bodyClassName="p-4"
      action={action}
    >
      <p className="text-center text-xs text-muted-foreground">{date}</p>
      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2">
        <FixtureSide team={home} />
        <div className="px-1 text-center">
          <p className="whitespace-nowrap font-score text-xl font-semibold tabular-nums text-primary">
            {time}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">Upcoming</p>
        </div>
        <FixtureSide team={away} />
      </div>
      {venue && (
        <p className="mt-3 truncate text-center text-xs text-muted-foreground">
          {venue}
        </p>
      )}
    </CardLink>
  );
}

/**
 * One card per competition, as in Scoreline's "Upcoming match" list: a
 * heading row (competition, stage on the right), then its fixtures.
 */
export function CompetitionGroup({
  name,
  aside,
  className,
  children,
}: {
  name: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cn(cardSurface, "overflow-hidden", className)}>
      <header className="flex items-center justify-between gap-3 px-4 pt-4">
        <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
          <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="truncate">{name}</span>
        </span>
        {aside && (
          <span className="shrink-0 text-xs text-muted-foreground">
            {aside}
          </span>
        )}
      </header>
      <div className="divide-y divide-border">{children}</div>
    </section>
  );
}
