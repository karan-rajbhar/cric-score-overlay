import { Award } from "lucide-react";
import { PlayerLink } from "~/components/ds/player-link";
import type { PlayerAward } from "~/lib/player-award";
import { cn } from "~/lib/utils";
import { Avatar } from "./avatar";

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function FigureTile({
  label,
  value,
  detail,
  wide,
}: {
  label: string;
  value: string;
  detail?: string;
  /** Alone on a phone: the full width, the detail beside the figure. */
  wide?: boolean;
}) {
  return (
    <div className="whitespace-nowrap rounded-xl bg-card px-3 py-2 shadow-soft ring-1 ring-border/40 sm:min-w-[6.5rem]">
      <p className="text-2xs text-muted-foreground">{label}</p>
      <div
        className={cn(
          wide && "flex items-baseline justify-between gap-3 sm:block",
        )}
      >
        <p className="font-score text-xl font-bold tabular-nums leading-tight text-foreground">
          {value}
        </p>
        {detail && (
          <p
            className={cn(
              "font-score tabular-nums text-muted-foreground",
              wide ? "text-xs sm:text-2xs" : "text-2xs",
            )}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * Player of the match: their picture with the award mark, name and side,
 * and what they did (batting, bowling) as figure tiles. Under the result
 * in the match hero. On phones the tiles go under the name: two side by
 * side, one across the width.
 */
export function PlayerAwardCard({
  award,
  href,
  className,
}: {
  award: PlayerAward;
  /** Their profile: the name opens it. */
  href?: string;
  className?: string;
}) {
  const { batting, bowling } = award;
  const both = Boolean(batting && bowling);
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-2xl bg-primary-soft/70 p-3 text-left ring-1 ring-primary/10 sm:flex-row sm:items-center sm:p-4",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="relative shrink-0">
          <Avatar name={award.name} src={award.avatarUrl} size="lg" />
          <span className="absolute -bottom-0.5 -right-0.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground ring-2 ring-card">
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </span>
        <span className="min-w-0">
          <span className="block text-xs font-medium text-primary">
            Player of the match
          </span>
          <span className="block text-balance break-words text-lg font-semibold leading-snug text-foreground">
            <PlayerLink name={award.name} href={href} />
          </span>
          {award.team && (
            <span className="block break-words text-xs text-muted-foreground">
              {award.team}
            </span>
          )}
        </span>
      </div>
      {(batting || bowling) && (
        <div className={cn("grid gap-2 sm:flex", both && "grid-cols-2")}>
          {batting && (
            <FigureTile
              label="Batting"
              value={`${batting.runs}${batting.notOut ? "*" : ""} (${batting.balls})`}
              detail={`${plural(batting.fours, "four", "fours")} · ${plural(batting.sixes, "six", "sixes")}`}
              wide={!both}
            />
          )}
          {bowling && (
            <FigureTile
              label="Bowling"
              value={`${bowling.wickets}/${bowling.runs}`}
              detail={`${bowling.overs} ov${bowling.maidens ? ` · ${plural(bowling.maidens, "maiden", "maidens")}` : ""}`}
              wide={!both}
            />
          )}
        </div>
      )}
    </div>
  );
}
