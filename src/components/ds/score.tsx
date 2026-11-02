import type * as React from "react";
import { Trophy, type LucideIcon } from "lucide-react";
import { cn } from "~/lib/utils";
import { TeamCrest } from "~/components/ds/avatar";
import { Chip, MatchStatusChip } from "~/components/ds/chip";

export type TeamRef = {
  name: string;
  shortName?: string | null;
  logoUrl?: string | null;
};

export type InningsRef = {
  runs: number;
  wickets: number;
  /** Already formatted: "18.2". */
  overs: string;
};

const SCORE_SIZE = {
  sm: "text-lg",
  md: "text-2xl",
  lg: "text-[2rem]",
} as const;

/** "182/4" with "18.2 ov" under or beside it, in the figure face. */
export function InningsScore({
  innings,
  size = "md",
  dim = false,
  inline = false,
  className,
}: {
  innings: InningsRef;
  size?: keyof typeof SCORE_SIZE;
  /** Side not batting / losing side: same size, quieter. */
  dim?: boolean;
  inline?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        inline ? "inline-flex items-baseline gap-1.5" : "inline-flex flex-col",
        className,
      )}
    >
      <span
        className={cn(
          "font-score font-semibold tabular-nums leading-none",
          SCORE_SIZE[size],
          dim ? "text-muted-foreground" : "text-foreground",
        )}
      >
        {innings.runs}/{innings.wickets}
      </span>
      <span
        className={cn(
          "font-score text-xs tabular-nums text-muted-foreground",
          !inline && "mt-1",
        )}
      >
        {innings.overs} ov
      </span>
    </span>
  );
}

const NOTE_TONE = {
  neutral: "text-muted-foreground",
  live: "text-foreground",
  result: "text-success",
} as const;

/** The sentence under a score: chase equation, result, toss, start time. */
export function MatchNote({
  tone = "neutral",
  className,
  children,
}: {
  tone?: keyof typeof NOTE_TONE;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      className={cn(
        "text-pretty text-sm font-medium",
        tone !== "neutral" && "font-semibold",
        NOTE_TONE[tone],
        className,
      )}
    >
      {children}
    </p>
  );
}

/** Centre of a live header: the batting side's score, big, with its overs. */
export function HeroScore({ innings }: { innings: InningsRef }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="font-score text-[2.5rem] font-semibold tabular-nums leading-none text-foreground sm:text-5xl">
        {innings.runs}/{innings.wickets}
      </span>
      <Chip tone="success" size="sm" className="font-score tabular-nums">
        {innings.overs} ov
      </Chip>
    </div>
  );
}

/** Centre of an upcoming header: the start time in navy. */
export function HeroTime({
  time,
  label = "Upcoming",
}: {
  time: React.ReactNode;
  label?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="whitespace-nowrap font-score text-2xl font-semibold tabular-nums text-primary">
        {time}
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
    </div>
  );
}

export type HeroSideProps = {
  team: TeamRef;
  /** One short line under the name: "168/6 (20 ov)", "Batting". */
  detail?: React.ReactNode;
  /** More lines (top performers on the match page). */
  extra?: React.ReactNode;
  dim?: boolean;
};

function HeroSide({
  team,
  detail,
  extra,
  dim,
  compact,
}: HeroSideProps & { compact: boolean }) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col items-center text-center",
        compact ? "gap-1.5" : "gap-2",
      )}
    >
      <TeamCrest {...team} size={compact ? "md" : "lg"} />
      <div className="min-w-0">
        <p
          className={cn(
            "line-clamp-2 text-sm font-semibold leading-snug",
            dim ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {team.name}
        </p>
        {detail && (
          <div className="mt-0.5 text-xs text-muted-foreground">{detail}</div>
        )}
      </div>
      {extra && (
        <div className="space-y-0.5 text-xs text-muted-foreground">{extra}</div>
      )}
    </div>
  );
}

/**
 * Match header, Scoreline style: competition and stage on top, crests on
 * either side with a short line under each name, and in the middle the
 * status chip over the one figure that matters now (the live score, the
 * start time). A white card floating on the wash; `plain` drops the card
 * for the top of the match page.
 */
export function ScoreHero({
  competition,
  competitionIcon: CompetitionIcon = Trophy,
  stage,
  status,
  home,
  away,
  centre,
  note,
  plain = false,
  compact = false,
  children,
  className,
}: {
  /** Tournament or club; none for a match in neither. */
  competition?: React.ReactNode;
  /** Beside the competition: Trophy (tournament, default) or Shield (club). */
  competitionIcon?: LucideIcon;
  /** Right of the competition, in navy: "Match 12", "Final". */
  stage?: React.ReactNode;
  /** The chip in the middle; none when the note already says it. */
  status?: string;
  home: HeroSideProps;
  away: HeroSideProps;
  /** Under the chip: HeroScore, HeroTime. */
  centre?: React.ReactNode;
  note?: React.ReactNode;
  plain?: boolean;
  /** Smaller crests: the top of a screen, where the tabs should start high. */
  compact?: boolean;
  children?: React.ReactNode;
  className?: string;
}) {
  const middle = Boolean(status || centre);
  return (
    <section
      className={cn(
        !plain &&
          "rounded-panel bg-card/85 p-4 shadow-soft ring-1 ring-white/70 dark:bg-card/80 dark:ring-border sm:p-5",
        className,
      )}
    >
      {/* Plain (the top of the match page, on the wash): a white disc for
          the icon (lavender would vanish into the wash), and from md one
          centred line in one type size, "Club · T20 · 20 overs", rather
          than two ends of a wide row. */}
      <div
        className={cn(
          "flex items-center gap-3",
          competition ? "justify-between" : "justify-center",
          plain && "md:justify-center md:gap-2",
        )}
      >
        {competition && (
          <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
            <span
              className={cn(
                "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
                plain
                  ? "bg-card text-primary shadow-soft"
                  : "bg-primary-soft text-primary-soft-foreground",
              )}
            >
              <CompetitionIcon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="truncate">{competition}</span>
          </span>
        )}
        {stage && (
          <span
            className={cn(
              "shrink-0 text-xs font-semibold text-primary",
              plain && "md:text-sm md:font-medium md:text-muted-foreground",
              plain && competition && "md:before:mr-2 md:before:content-['·']",
            )}
          >
            {stage}
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-4 grid items-start gap-2",
          middle
            ? "grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]"
            : "grid-cols-2",
        )}
      >
        <HeroSide {...home} compact={compact} />
        {middle && (
          <div className="flex min-w-[6.5rem] flex-col items-center gap-2 pt-2 text-center">
            {status && <MatchStatusChip status={status} />}
            {centre}
          </div>
        )}
        <HeroSide {...away} compact={compact} />
      </div>
      {note && <div className="mt-3 text-center">{note}</div>}
      {children && <div className="mt-4">{children}</div>}
    </section>
  );
}

export type ScoreLineSide = {
  /** The team's short code, or its name. */
  code: string;
  /** "83/6 (8.0)"; none before it bats. */
  score?: string | null;
  dim?: boolean;
};

/**
 * The match in one line, for a bar that stays on screen once the header has
 * scrolled away: "ROH 83/6 (8.0) · OMK 68/6 (8.0)", or "ROH v OMK" before
 * the start. It repeats the header, so screen readers skip it.
 */
export function ScoreLine({
  sides,
  className,
}: {
  sides: readonly [ScoreLineSide, ScoreLineSide];
  className?: string;
}) {
  const started = sides.some((s) => s.score);
  const side = (s: ScoreLineSide) => (
    <span
      className={cn(
        "min-w-0 truncate",
        s.dim ? "text-muted-foreground" : "text-foreground",
      )}
    >
      <span className="font-semibold">{s.code}</span>
      {s.score && <span className="ml-1">{s.score}</span>}
    </span>
  );
  return (
    <p
      aria-hidden="true"
      className={cn(
        "flex min-w-0 items-center justify-center gap-2 font-score text-sm tabular-nums",
        className,
      )}
    >
      {side(sides[0])}
      <span className="shrink-0 text-muted-foreground">
        {started ? "·" : "v"}
      </span>
      {side(sides[1])}
    </p>
  );
}
