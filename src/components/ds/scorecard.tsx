"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { PlayerLink } from "~/components/ds/player-link";
import type { DismissalDetail } from "~/lib/dismissal-detail";
import { cn } from "~/lib/utils";

/*
 * Figure tables: the first column is a name, the rest are right-aligned
 * tabular figures. Runs and wickets carry the weight; the rest stay plain.
 */

export const figTable = "w-full text-sm tabular-nums";
// The name column takes the slack (first:w-full), so figures stay compact
// on the right and long names keep their room on phones.
export const figHead =
  "px-2 py-2 text-right text-xs font-medium text-muted-foreground first:w-full first:pl-4 first:text-left last:pr-4 sm:px-3 sm:first:pl-4 sm:last:pr-4";
export const figCell =
  "px-2 py-2.5 text-right font-score first:pl-4 first:text-left last:pr-4 sm:px-3 sm:first:pl-4 sm:last:pr-4";

/** Card with a title row ("Mumbai Strikers innings  182/4 (20)"). */
export function TableCard({
  title,
  aside,
  className,
  children,
}: {
  title: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl bg-card shadow-soft ring-1 ring-border/40 dark:ring-border",
        className,
      )}
    >
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">
          {title}
        </h3>
        {aside && (
          <div className="shrink-0 font-score text-sm tabular-nums text-muted-foreground">
            {aside}
          </div>
        )}
      </header>
      <div className="overflow-x-auto">{children}</div>
    </section>
  );
}

/** A column heading: its short form, and what it stands for. */
export type Column = readonly [short: string, full?: string];

const BATTING_COLUMNS: readonly Column[] = [
  ["Batter"],
  ["R", "Runs"],
  ["B", "Balls"],
  ["4s", "Fours"],
  ["6s", "Sixes"],
  ["SR", "Strike rate"],
];
const BOWLING_COLUMNS: readonly Column[] = [
  ["Bowler"],
  ["O", "Overs"],
  ["M", "Maidens"],
  ["R", "Runs"],
  ["W", "Wickets"],
  ["Econ", "Economy"],
];
const BOWLING_DETAIL_COLUMNS: readonly Column[] = [
  ["0s", "Dot balls"],
  ["4s", "Fours"],
  ["6s", "Sixes"],
  ["Wd", "Wides"],
  ["Nb", "No-balls"],
];

/**
 * A short heading ("SR") that screen readers read in full ("Strike rate")
 * and a pointer shows on hover.
 */
export function Abbr({ short, full }: { short: string; full?: string }) {
  if (!full) return <>{short}</>;
  return (
    <>
      <abbr title={full} aria-hidden="true" className="no-underline">
        {short}
      </abbr>
      <span className="sr-only">{full}</span>
    </>
  );
}

/**
 * A figure that reached a milestone (50 / 100 runs, 3 / 5 wickets) on a
 * soft chip, the bigger one solid; anything else plain.
 */
function Milestone({
  value,
  soft,
  solid,
}: {
  value: number;
  soft: number;
  solid: number;
}) {
  if (value < soft) return <>{value}</>;
  return (
    <span
      className={cn(
        "inline-flex min-w-7 justify-center rounded-full px-1.5 py-0.5",
        value >= solid
          ? "bg-primary text-primary-foreground"
          : "bg-primary-soft text-primary-soft-foreground",
      )}
    >
      {value}
    </span>
  );
}

function HeadRow({
  columns,
  className,
}: {
  columns: readonly Column[];
  className?: string;
}) {
  return (
    <tr className={className}>
      {columns.map(([short, full], i) => (
        <th key={`${short}-${i}`} scope="col" className={figHead}>
          <Abbr short={short} full={full} />
        </th>
      ))}
    </tr>
  );
}

export type BatterFigures = {
  name: string;
  /** The player's profile: the name opens it. */
  href?: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  strikeRate: string;
};

export type BowlerFigures = {
  name: string;
  /** The player's profile: the name opens it. */
  href?: string;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  economy: string;
  /** The detailed card's extra columns (null: not known, shown "–"). */
  dots?: number | null;
  fours?: number | null;
  sixes?: number | null;
  wides?: number;
  noBalls?: number;
};

/**
 * Who is in: the two batters (striker marked "*") and the bowler, in one
 * compact table each.
 */
export function CreaseTable({
  batters,
  strikerName,
  bowler,
  className,
}: {
  batters: readonly BatterFigures[];
  strikerName?: string;
  bowler?: BowlerFigures;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className={figTable}>
        <thead>
          <HeadRow columns={BATTING_COLUMNS} />
        </thead>
        <tbody>
          {batters.map((b) => (
            <tr key={b.name} className="border-t border-border">
              <th
                scope="row"
                className={cn(
                  figCell,
                  "max-w-0 font-sans font-medium text-foreground",
                )}
              >
                <span className="block truncate">
                  <PlayerLink name={b.name} href={b.href} />
                  {b.name === strikerName && (
                    <>
                      <span aria-hidden="true"> *</span>
                      <span className="sr-only"> (on strike)</span>
                    </>
                  )}
                </span>
              </th>
              <td className={cn(figCell, "font-semibold text-foreground")}>
                {b.runs}
              </td>
              <td className={figCell}>{b.balls}</td>
              <td className={figCell}>{b.fours}</td>
              <td className={figCell}>{b.sixes}</td>
              <td className={cn(figCell, "text-muted-foreground")}>
                {b.strikeRate}
              </td>
            </tr>
          ))}
        </tbody>
        {bowler && (
          <tbody>
            <HeadRow
              columns={BOWLING_COLUMNS}
              className="border-t border-border"
            />
            <BowlerRow {...bowler} />
          </tbody>
        )}
      </table>
    </div>
  );
}

function BowlerRow({
  detailed = false,
  ...b
}: BowlerFigures & { detailed?: boolean }) {
  const known = (v: number | null | undefined) => (v == null ? "–" : v);
  return (
    <tr className="border-t border-border">
      <th
        scope="row"
        className={cn(figCell, "max-w-0 font-sans font-medium text-foreground")}
      >
        <span className="block truncate">
          <PlayerLink name={b.name} href={b.href} />
        </span>
      </th>
      <td className={figCell}>{b.overs}</td>
      <td className={figCell}>{b.maidens}</td>
      <td className={figCell}>{b.runs}</td>
      <td className={cn(figCell, "font-semibold text-foreground")}>
        {detailed ? <Milestone value={b.wickets} soft={3} solid={5} /> : b.wickets}
      </td>
      <td className={cn(figCell, "text-muted-foreground")}>{b.economy}</td>
      {detailed && (
        <>
          <td className={figCell}>{known(b.dots)}</td>
          <td className={figCell}>{known(b.fours)}</td>
          <td className={figCell}>{known(b.sixes)}</td>
          <td className={figCell}>{b.wides ?? 0}</td>
          <td className={figCell}>{b.noBalls ?? 0}</td>
        </>
      )}
    </tr>
  );
}

function BattingTotals({
  extras,
  total,
}: {
  extras: { total: number; detail: string };
  total: { label: string; runRate: string };
}) {
  return (
    <tfoot>
      <tr className="border-t border-border">
        <th
          scope="row"
          className={cn(figCell, "font-sans font-normal text-muted-foreground")}
        >
          Extras <span className="text-xs">{extras.detail}</span>
        </th>
        <td className={cn(figCell, "font-semibold text-foreground")}>
          {extras.total}
        </td>
        <td colSpan={4} />
      </tr>
      <tr className="border-t border-border bg-muted/50">
        <th
          scope="row"
          className={cn(figCell, "font-sans font-semibold text-foreground")}
        >
          Total
        </th>
        <td colSpan={5} className={cn(figCell, "text-foreground")}>
          <span className="font-semibold">{total.label}</span>
          <span className="ml-2 text-xs text-muted-foreground">
            Run rate {total.runRate}
          </span>
        </td>
      </tr>
    </tfoot>
  );
}

export type BatterRow = BatterFigures & {
  dismissal: string;
  notOut?: boolean;
  /** How the wicket fell: opens under the row when the card is expandable. */
  detail?: DismissalDetail | null;
};

function DismissalPanel({ detail }: { detail: DismissalDetail }) {
  return (
    <div className="space-y-0.5 rounded-lg bg-muted/60 px-3 py-2 text-left font-sans">
      <p className="text-sm text-foreground">
        <span className="mr-2 font-score text-xs tabular-nums text-muted-foreground">
          {detail.over}
        </span>
        {detail.headline}
      </p>
      <p className="text-sm font-medium text-wicket">{detail.outcome}</p>
      <p className="font-score text-xs tabular-nums text-muted-foreground">
        {detail.score}
      </p>
    </div>
  );
}

/** The dismissal under a name: a button when it has a detail to open. */
function DismissalLine({
  row: r,
  panelId,
  isOpen,
  onToggle,
}: {
  row: BatterRow;
  panelId: string;
  isOpen: boolean;
  onToggle: (() => void) | null;
}) {
  if (!onToggle) {
    return (
      <span
        className={cn(
          "block text-xs",
          r.notOut ? "font-medium text-success" : "text-muted-foreground",
        )}
      >
        {r.dismissal}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-expanded={isOpen}
      aria-controls={panelId}
      onClick={onToggle}
      className="-ml-1.5 mt-0.5 flex min-h-7 max-w-full items-center gap-1 rounded-md px-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChevronDown
        className={cn(
          "h-3.5 w-3.5 shrink-0 transition-transform motion-reduce:transition-none",
          isOpen && "rotate-180",
        )}
        aria-hidden="true"
      />
      <span className="truncate">{r.dismissal}</span>
    </button>
  );
}

/**
 * The batters in order. A dismissal with a `detail` is a button that opens
 * how it happened in a row under the batter; several can be open at once.
 */
function BatterRows({
  rows,
  milestones,
  expandable,
}: {
  rows: readonly BatterRow[];
  milestones: boolean;
  expandable: boolean;
}) {
  const [open, setOpen] = React.useState<ReadonlySet<string>>(new Set());
  const base = React.useId();
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  return (
    <>
      {rows.map((r, i) => {
        const panelId = `${base}-${i}`;
        const detail = expandable ? r.detail : null;
        const isOpen = open.has(r.name);
        return (
          <React.Fragment key={r.name}>
            <tr className="border-t border-border">
              <th
                scope="row"
                className={cn(
                  figCell,
                  "max-w-0 text-left font-sans font-normal",
                )}
              >
                <span className="block truncate font-medium text-foreground">
                  <PlayerLink name={r.name} href={r.href} />
                </span>
                <DismissalLine
                  row={r}
                  panelId={panelId}
                  isOpen={isOpen}
                  onToggle={detail ? () => toggle(r.name) : null}
                />
              </th>
              <td className={cn(figCell, "font-semibold text-foreground")}>
                {milestones ? (
                  <Milestone value={r.runs} soft={50} solid={100} />
                ) : (
                  r.runs
                )}
              </td>
              <td className={figCell}>{r.balls}</td>
              <td className={figCell}>{r.fours}</td>
              <td className={figCell}>{r.sixes}</td>
              <td className={cn(figCell, "text-muted-foreground")}>
                {r.strikeRate}
              </td>
            </tr>
            {detail && (
              <tr id={panelId} hidden={!isOpen}>
                <td colSpan={BATTING_COLUMNS.length} className="px-4 pb-3 pt-0">
                  <DismissalPanel detail={detail} />
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}

/**
 * A side's batting: dismissal under each name, extras, total, yet to bat.
 * `milestones` puts fifties and hundreds on a chip; `note` is a line under
 * the total ("12 fours and 3 sixes: 66 runs").
 */
export function BattingCard({
  title,
  score,
  rows,
  extras,
  total,
  didNotBat,
  didNotBatLabel = "Yet to bat",
  milestones = false,
  expandable = false,
  note,
  className,
}: {
  title: React.ReactNode;
  score?: React.ReactNode;
  rows: readonly BatterRow[];
  extras: { total: number; detail: string };
  total: { label: string; runRate: string };
  didNotBat?: readonly string[];
  didNotBatLabel?: string;
  milestones?: boolean;
  /** Each dismissal with a `detail` opens under its row (not in print). */
  expandable?: boolean;
  note?: React.ReactNode;
  className?: string;
}) {
  return (
    <TableCard title={title} aside={score} className={className}>
      <table className={figTable}>
        <thead>
          <HeadRow columns={BATTING_COLUMNS} />
        </thead>
        <tbody>
          <BatterRows
            rows={rows}
            milestones={milestones}
            expandable={expandable}
          />
        </tbody>
        <BattingTotals extras={extras} total={total} />
      </table>
      {note && (
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          {note}
        </p>
      )}
      {didNotBat && didNotBat.length > 0 && (
        <p className="border-t border-border px-4 py-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {didNotBatLabel}:{" "}
          </span>
          {didNotBat.join(", ")}
        </p>
      )}
    </TableCard>
  );
}

/**
 * A side's bowling figures; `detailed` adds dot balls, fours, sixes, wides
 * and no-balls, and puts 3- and 5-wicket hauls on a chip.
 */
export function BowlingCard({
  title,
  rows,
  detailed = false,
  className,
}: {
  title: React.ReactNode;
  rows: readonly BowlerFigures[];
  detailed?: boolean;
  className?: string;
}) {
  return (
    <TableCard title={title} className={className}>
      <table className={figTable}>
        <thead>
          <HeadRow
            columns={
              detailed
                ? [...BOWLING_COLUMNS, ...BOWLING_DETAIL_COLUMNS]
                : BOWLING_COLUMNS
            }
          />
        </thead>
        <tbody>
          {rows.map((r) => (
            <BowlerRow key={r.name} {...r} detailed={detailed} />
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}

/** Fall of wickets as a wrapping list: "3-61 Kohli, 7.4 ov". */
export function FallOfWickets({
  wickets,
  className,
}: {
  wickets: readonly { score: string; name: string; over: string }[];
  className?: string;
}) {
  return (
    <ol className={cn("flex flex-wrap gap-2", className)}>
      {wickets.map((w) => (
        <li
          key={w.score}
          className="inline-flex items-baseline gap-1.5 rounded-full bg-muted px-3 py-1.5 text-xs"
        >
          <span className="font-score font-semibold tabular-nums text-foreground">
            {w.score}
          </span>
          <span className="text-foreground">{w.name}</span>
          <span className="font-score tabular-nums text-muted-foreground">
            {w.over} ov
          </span>
        </li>
      ))}
    </ol>
  );
}
