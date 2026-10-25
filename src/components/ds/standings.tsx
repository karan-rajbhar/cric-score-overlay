import type * as React from "react";
import Link from "next/link";
import { cn } from "~/lib/utils";
import { Avatar, TeamCrest } from "~/components/ds/avatar";
import {
  Abbr,
  TableCard,
  figCell,
  figHead,
  figTable,
} from "~/components/ds/scorecard";
import type { TeamRef } from "~/components/ds/score";

export type StandingRow = {
  team: TeamRef;
  /** The team's page. */
  href?: string;
  played: number;
  won: number;
  lost: number;
  /** Tied matches (the T column, when any row has it). */
  tied?: number;
  noResult: number;
  points: number;
  netRunRate: string;
  /** Set by the organiser: through, or out of contention. */
  status?: "qualified" | "eliminated" | null;
  /** A manual points change, shown under the points ("+2 adj"). */
  adjustment?: string | null;
  /** An organiser's action for the row (the last column). */
  action?: React.ReactNode;
};

const STATUS = {
  qualified: {
    mark: "Q",
    label: "qualified",
    cls: "bg-success/10 text-success",
  },
  eliminated: {
    mark: "E",
    label: "eliminated",
    cls: "bg-muted text-muted-foreground",
  },
} as const;

function StandingTableRow({
  row,
  rank,
  qualifies,
  firstOut,
  withTied,
  withNoResult,
  withAction,
}: {
  row: StandingRow;
  rank: number;
  qualifies: boolean;
  /** First place below the cut: draw the line above it. */
  firstOut: boolean;
  withTied: boolean;
  withNoResult: boolean;
  withAction: boolean;
}) {
  const status = row.status ? STATUS[row.status] : null;
  const name = row.href ? (
    <Link
      href={row.href}
      className="truncate hover:text-primary hover:underline"
    >
      {row.team.name}
    </Link>
  ) : (
    <span className="truncate">{row.team.name}</span>
  );
  return (
    <tr
      className={cn(
        "border-t border-border",
        firstOut && "border-t-2 border-t-primary/40",
      )}
    >
      <th
        scope="row"
        className={cn(figCell, "max-w-0 font-medium text-foreground")}
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              qualifies || row.status === "qualified"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground",
            )}
          >
            {rank}
          </span>
          {/* Phones: no crest, so the name keeps its room. */}
          <TeamCrest {...row.team} size="xs" className="max-sm:hidden" />
          {name}
          {status && (
            <span
              className={cn(
                "inline-flex h-5 shrink-0 items-center rounded-full px-1.5 font-sans text-2xs font-semibold",
                status.cls,
              )}
              title={status.label}
            >
              <span aria-hidden="true">{status.mark}</span>
              <span className="sr-only">{status.label}</span>
            </span>
          )}
        </span>
      </th>
      <td className={figCell}>{row.played}</td>
      <td className={figCell}>{row.won}</td>
      <td className={figCell}>{row.lost}</td>
      {withTied && <td className={figCell}>{row.tied ?? 0}</td>}
      {withNoResult && <td className={figCell}>{row.noResult}</td>}
      <td className={cn(figCell, "font-semibold text-foreground")}>
        {row.points}
        {row.adjustment && (
          <span className="block text-2xs font-normal text-muted-foreground">
            {row.adjustment}
          </span>
        )}
      </td>
      <td className={cn(figCell, "text-muted-foreground")}>{row.netRunRate}</td>
      {withAction && <td className={figCell}>{row.action}</td>}
    </tr>
  );
}

/**
 * Points table. The qualifying places get a navy rank and a line under the
 * last of them (or each row marked qualified its navy rank and a "Q").
 * T and NR show (on phones too) once any team has a tie or a no result,
 * so played always adds up; headings are read out in full.
 */
export function PointsTable({
  title,
  aside,
  rows,
  qualify = 0,
  className,
}: {
  title: string;
  /** Right of the title (defaults to "Top N qualify"). */
  aside?: React.ReactNode;
  rows: readonly StandingRow[];
  /** How many places qualify (0: none marked). */
  qualify?: number;
  className?: string;
}) {
  const withTied = rows.some((r) => (r.tied ?? 0) > 0);
  const withNoResult = rows.some((r) => r.noResult > 0);
  const withAction = rows.some((r) => r.action);
  const columns: [short: string, full?: string][] = [
    ["Team"],
    ["P", "Played"],
    ["W", "Won"],
    ["L", "Lost"],
    ...(withTied ? ([["T", "Tied"]] as [string, string][]) : []),
    ...(withNoResult ? ([["NR", "No result"]] as [string, string][]) : []),
    ["Pts", "Points"],
    ["NRR", "Net run rate"],
    ...(withAction ? ([[""]] as [string][]) : []),
  ];
  return (
    <TableCard
      title={title}
      aside={aside ?? (qualify > 0 ? `Top ${qualify} qualify` : undefined)}
      className={className}
    >
      <table className={figTable}>
        <thead>
          <tr>
            {columns.map(([short, full], i) => (
              <th key={`${short}-${i}`} scope="col" className={figHead}>
                {short ? (
                  <Abbr short={short} full={full} />
                ) : (
                  <span className="sr-only">Actions</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <StandingTableRow
              key={r.team.name}
              row={r}
              rank={i + 1}
              qualifies={i < qualify}
              firstOut={qualify > 0 && i === qualify}
              withTied={withTied}
              withNoResult={withNoResult}
              withAction={withAction}
            />
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}

/**
 * Leaderboard: rank, player, team and the one figure being ranked. No
 * medals or crowns; the order says it.
 */
export function RankList({
  title,
  unit,
  rows,
  className,
}: {
  title: string;
  /** What the figure counts ("Runs", "Wickets"). */
  unit: string;
  rows: readonly {
    name: string;
    team: string;
    value: string | number;
    detail?: string;
    avatarUrl?: string | null;
    /** The player's profile: the row opens it. */
    href?: string;
  }[];
  className?: string;
}) {
  return (
    <TableCard title={title} aside={unit} className={className}>
      <ol>
        {rows.map((r, i) => {
          const rowClass = "flex items-center gap-3 px-4 py-3 first:border-t-0";
          const body = (
            <>
              <span className="w-5 shrink-0 text-right font-score text-sm tabular-nums text-muted-foreground">
                {i + 1}
              </span>
              <Avatar name={r.name} src={r.avatarUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">
                  {r.name}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {r.team}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-score text-lg font-semibold tabular-nums leading-tight text-foreground">
                  {r.value}
                </span>
                {r.detail && (
                  <span className="block font-score text-xs tabular-nums text-muted-foreground">
                    {r.detail}
                  </span>
                )}
              </span>
            </>
          );
          return (
            <li
              key={r.name}
              className="border-t border-border first:border-t-0"
            >
              {r.href ? (
                <Link
                  href={r.href}
                  className={cn(
                    rowClass,
                    "transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                  )}
                >
                  {body}
                </Link>
              ) : (
                <div className={rowClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ol>
    </TableCard>
  );
}
