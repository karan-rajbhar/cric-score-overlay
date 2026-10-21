import type * as React from "react";
import { cn } from "~/lib/utils";
import { Chip, LiveChip } from "./chip";

/*
 * Partnerships: one row per wicket stand with its runs (balls), a bar split
 * by who scored (first batter dark, second light, extras grey; its length
 * is the stand against the innings' best) and each batter's "48 (27)".
 */

export type BatterShare = { runs: number; balls: number };

export type StandData = {
  key: string;
  /** The wicket the stand was for: 1 for the opening stand. */
  wicket: number;
  names: [string, string];
  runs: number;
  balls: number;
  /** Each batter's runs and balls faced; null when not recorded. */
  shares: [BatterShare, BatterShare] | null;
  live?: boolean;
  /** Not out at the end of the innings. */
  unbroken?: boolean;
  /** How it ended when not by the wicket it is named after ("Retired hurt"). */
  ending?: string;
  best?: boolean;
  /** Say on the row that its split is missing. */
  noteMissing?: boolean;
};

const SWATCH = ["bg-primary", "bg-primary/40"] as const;

function ordinal(n: number): string {
  const v = n % 100;
  const s = ["th", "st", "nd", "rd"];
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function extrasOf(s: StandData): number {
  return s.shares
    ? Math.max(0, s.runs - s.shares[0].runs - s.shares[1].runs)
    : 0;
}

function StandBar({ s, maxRuns }: { s: StandData; maxRuns: number }) {
  const extras = extrasOf(s);
  const parts = s.shares
    ? [
        { runs: s.shares[0].runs, cls: SWATCH[0] },
        { runs: s.shares[1].runs, cls: SWATCH[1] },
        { runs: extras, cls: "bg-muted-foreground/25" },
      ]
    : [{ runs: s.runs, cls: "bg-muted-foreground/40" }];
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="flex h-full gap-[2px]"
        style={{ width: `${maxRuns > 0 ? (s.runs / maxRuns) * 100 : 0}%` }}
      >
        {parts
          .filter((x) => x.runs > 0)
          .map((x, i) => (
            <div
              key={i}
              className={cn("h-full rounded-full", x.cls)}
              style={{ flexGrow: x.runs, flexBasis: 0 }}
            />
          ))}
      </div>
    </div>
  );
}

function Share({
  name,
  share,
  swatch,
}: {
  name: string;
  share: BatterShare;
  swatch: string;
}) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span
        aria-hidden="true"
        className={cn("h-2 w-2 shrink-0 rounded-full", swatch)}
      />
      <span className="truncate text-foreground">{name}</span>
      <span className="font-score font-semibold tabular-nums text-foreground">
        {share.runs}
      </span>
      <span className="font-score tabular-nums text-muted-foreground">
        ({share.balls})
      </span>
    </span>
  );
}

function StandShares({
  s,
  inningsTotal,
}: {
  s: StandData;
  inningsTotal?: number;
}) {
  const extras = extrasOf(s);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
      {s.shares ? (
        <>
          <Share name={s.names[0]} share={s.shares[0]} swatch={SWATCH[0]} />
          <Share name={s.names[1]} share={s.shares[1]} swatch={SWATCH[1]} />
          {extras > 0 && (
            <span className="text-muted-foreground">+ {extras} extras</span>
          )}
        </>
      ) : s.noteMissing ? (
        <span className="text-muted-foreground">
          Each batter's share is not recorded for this stand.
        </span>
      ) : null}
      {inningsTotal !== undefined && inningsTotal > 0 && (
        <span className="ml-auto font-score tabular-nums text-muted-foreground">
          {Math.round((s.runs / inningsTotal) * 100)}% of total
        </span>
      )}
    </div>
  );
}

function StandRow({
  s,
  maxRuns,
  inningsTotal,
}: {
  s: StandData;
  maxRuns: number;
  inningsTotal?: number;
}) {
  return (
    <li
      className={cn(
        "break-inside-avoid rounded-2xl p-3",
        s.live ? "bg-primary-soft/60 ring-1 ring-primary/25" : "bg-muted/60",
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-2 text-sm">
          <span
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-card font-score text-2xs font-semibold tabular-nums text-muted-foreground"
            title={`${ordinal(s.wicket)} wicket stand`}
          >
            {s.wicket}
            <span className="sr-only"> ({ordinal(s.wicket)} wicket)</span>
          </span>
          <span className="truncate font-medium text-foreground">
            {s.names[0]} & {s.names[1]}
          </span>
          {s.live && <LiveChip quiet className="shrink-0" />}
          {s.unbroken && !s.live && (
            <Chip size="sm" tone="primary">
              Unbroken
            </Chip>
          )}
          {s.ending && (
            <Chip size="sm" tone="neutral">
              {s.ending}
            </Chip>
          )}
          {s.best && (
            <Chip size="sm" tone="outline">
              Best
            </Chip>
          )}
        </span>
        <span className="shrink-0 text-right">
          <span className="font-score text-lg font-bold tabular-nums text-foreground">
            {s.runs}
          </span>{" "}
          <span className="font-score text-xs tabular-nums text-muted-foreground">
            ({s.balls})
          </span>
        </span>
      </div>
      <div className="mt-2.5">
        <StandBar s={s} maxRuns={maxRuns} />
      </div>
      <StandShares s={s} inningsTotal={inningsTotal} />
    </li>
  );
}

/** An innings' stands in batting order, on one scale. */
export function PartnershipList({
  stands,
  inningsTotal,
  className,
  ...rest
}: {
  stands: readonly StandData[];
  /** Adds "N% of total" to each stand. */
  inningsTotal?: number;
  className?: string;
} & Pick<React.HTMLAttributes<HTMLUListElement>, "aria-label">) {
  const maxRuns = Math.max(1, ...stands.map((s) => s.runs));
  return (
    <ul className={cn("space-y-2", className)} {...rest}>
      {stands.map((s) => (
        <StandRow
          key={s.key}
          s={s}
          maxRuns={maxRuns}
          inningsTotal={inningsTotal}
        />
      ))}
    </ul>
  );
}
