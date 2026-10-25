import * as React from "react";
import { Shield } from "lucide-react";
import { BrandMark, BrandWordmark } from "~/components/brand";
import { Chip } from "~/components/ds/chip";
import { figCell, figHead, figTable } from "~/components/ds/fig-table";
import { Abbr, TableCard, type Column } from "~/components/ds/scorecard";
import { StatTile } from "~/components/ds/stat-tile";
import type { ClubStatsRow, TabTable } from "~/lib/club-stats-export";
import { cn } from "~/lib/utils";
import { ReportFooter } from "./report-sections";
import { ReportToolbar } from "./report-toolbar";

/** A4 sheets with a 10 mm margin; backgrounds (chips, bars) print too. */
const PRINT_CSS = `@page { size: A4 portrait; margin: 10mm; }
@media print { html, body { background: #fff !important; } }`;

/*
 * Sheets. The PDF is cut from the page as it renders at a fixed width, one
 * `.report-page` at a time (each starts a sheet), so a long table is split
 * here, into sheets that each hold their own title and column heads, not by
 * the PDF cutting a table through a row. Measured on a real report: a row
 * is about 45 px, a sheet holds about 1,120 px of content, the heading and
 * totals take about 4 rows, the footer about 3, a table's own title and
 * column heads about 2. These limits keep some room to spare.
 */
/** Rows beside the report's heading and totals. */
const FIRST_SHEET_ROWS = 14;
/** Rows beside a tab report's heading (more room: no totals). */
const FIRST_TAB_SHEET_ROWS = 18;
/** Rows on a sheet of a table's own. */
const SHEET_ROWS = 22;
/** Rows on the last sheet of the report, which carries the footer too. */
const FOOTER_SHEET_ROWS = 18;
/** Rows a first sheet holds beside both its heading and the footer. */
const ONLY_SHEET_ROWS = 14;

export interface SheetLimits {
  /** The first sheet (the report's heading is on it). */
  first: number;
  /** A sheet between the first and the last. */
  max: number;
  /** The last sheet (carries the footer when this is the last table). */
  last: number;
  /** The whole table on the one sheet that has heading and footer both. */
  only: number;
}

/**
 * `rows` as the fewest sheets within `limits`, spread evenly after the
 * first (so the last sheet is never a couple of rows left over).
 */
export function sheetsOfRows<T>(
  rows: readonly T[],
  limits: SheetLimits,
): T[][] {
  const { first, max, last, only } = limits;
  const total = rows.length;
  if (total <= only) return [[...rows]];
  for (let n = 2; ; n++) {
    const head = Math.min(first, Math.ceil(total / n));
    const rest = total - head;
    const size = Math.ceil(rest / (n - 1));
    if (size <= (n === 2 ? last : Math.min(max, last))) {
      const out: T[][] = [rows.slice(0, head)];
      for (let i = head; i < total; i += size) {
        out.push(rows.slice(i, i + size));
      }
      return out;
    }
  }
}

type FigureColumn = readonly [
  short: string,
  full: string | undefined,
  value: (r: ClubStatsRow) => React.ReactNode,
  /** Emphasised: the figure the table is about. */
  strong?: boolean,
];

type NamedRow = { rank: number; userId: string; name: string };

/** The table: a rank chip and name, then right-aligned figures. */
function FigureTable<R extends NamedRow>({
  title,
  aside,
  head,
  rows,
  cells,
}: {
  title: string;
  aside?: React.ReactNode;
  head: readonly Column[];
  rows: readonly R[];
  cells: (row: R) => React.ReactNode;
}) {
  return (
    <TableCard title={title} aside={aside} className="break-inside-avoid">
      <table className={figTable}>
        <thead>
          <tr>
            {head.map(([short, full], i) => (
              <th key={`${short}-${i}`} scope="col" className={figHead}>
                <Abbr short={short} full={full} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-t border-border">
              <th
                scope="row"
                className={cn(figCell, "max-w-0 font-medium text-foreground")}
              >
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-muted-foreground">
                    {r.rank}
                  </span>
                  {/* Wraps rather than truncates: the PDF cannot clip text. */}
                  <span className="min-w-0 break-words">{r.name}</span>
                </span>
              </th>
              {cells(r)}
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}

const cellOf = (
  strong: boolean | undefined,
  key: string,
  v: React.ReactNode,
) => (
  <td
    key={key}
    className={cn(
      figCell,
      strong ? "font-semibold text-foreground" : undefined,
    )}
  >
    {v}
  </td>
);

/** The combined report's table: players ranked by points, or one discipline. */
function StatsTable({
  title,
  aside,
  columns,
  rows,
}: {
  title: string;
  aside?: React.ReactNode;
  columns: readonly FigureColumn[];
  rows: readonly ClubStatsRow[];
}) {
  return (
    <FigureTable
      title={title}
      aside={aside}
      head={[["Player"], ...columns.map(([s, f]) => [s, f] as Column)]}
      rows={rows}
      cells={(r) =>
        columns.map(([short, , value, strong]) =>
          cellOf(strong, short, value(r)),
        )
      }
    />
  );
}

/** A leaderboard tab's table: rank and player, then the tab's figures. */
function TabStatsTable({
  table,
  rows,
  title,
  aside,
}: {
  table: TabTable<{ userId: string; name: string }>;
  rows: TabTable<{ userId: string; name: string }>["rows"];
  title: string;
  aside?: React.ReactNode;
}) {
  return (
    <FigureTable
      title={title}
      aside={aside}
      head={[
        ["Player"],
        ...table.columns.map((c) => [c.short, c.full] as Column),
      ]}
      rows={rows.map((r) => ({
        rank: r.rank,
        userId: r.entry.userId,
        name: r.entry.name,
        entry: r.entry,
      }))}
      cells={(r) =>
        table.columns.map((c) => cellOf(c.strong, c.short, c.value(r.entry)))
      }
    />
  );
}

const dash = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "—" : v;

const POINTS: readonly FigureColumn[] = [
  ["M", "Matches", (r) => r.matches],
  ["Bat", "Batting points", (r) => r.points.batting],
  ["Bowl", "Bowling points", (r) => r.points.bowling],
  ["Field", "Fielding points", (r) => r.points.fielding],
  ["Pts", "Total points", (r) => r.points.total, true],
];
const BATTING: readonly FigureColumn[] = [
  ["Inn", "Innings", (r) => r.batting?.innings ?? 0],
  ["NO", "Not outs", (r) => r.batting?.notOuts ?? 0],
  ["R", "Runs", (r) => r.batting?.runs ?? 0, true],
  ["B", "Balls faced", (r) => r.batting?.balls ?? 0],
  ["HS", "Highest score", (r) => dash(r.batting?.highestScoreDisplay)],
  ["Avg", "Batting average", (r) => dash(r.batting?.averageDisplay)],
  ["SR", "Strike rate", (r) => dash(r.batting?.strikeRateDisplay)],
  ["4s", "Fours", (r) => r.batting?.fours ?? 0],
  ["6s", "Sixes", (r) => r.batting?.sixes ?? 0],
  ["50", "Fifties", (r) => r.batting?.fifties ?? 0],
  ["100", "Hundreds", (r) => r.batting?.centuries ?? 0],
];
const BOWLING: readonly FigureColumn[] = [
  ["Inn", "Innings", (r) => r.bowling?.innings ?? 0],
  ["O", "Overs", (r) => r.bowling?.overs ?? "0.0"],
  ["M", "Maidens", (r) => r.bowling?.maidens ?? 0],
  ["R", "Runs conceded", (r) => r.bowling?.runsConceded ?? 0],
  ["W", "Wickets", (r) => r.bowling?.wickets ?? 0, true],
  ["BBI", "Best bowling", (r) => dash(r.bowling?.bestBowling.display)],
  ["Avg", "Bowling average", (r) => dash(r.bowling?.averageDisplay)],
  ["Econ", "Economy", (r) => dash(r.bowling?.economyDisplay)],
  ["3w", "Three-wicket hauls", (r) => r.bowling?.threeWickets ?? 0],
  ["5w", "Five-wicket hauls", (r) => r.bowling?.fiveWickets ?? 0],
];
const FIELDING: readonly FigureColumn[] = [
  ["Ct", "Catches", (r) => r.fielding?.catches ?? 0],
  ["St", "Stumpings", (r) => r.fielding?.stumpings ?? 0],
  ["RO", "Run outs", (r) => r.fielding?.runOuts ?? 0],
  ["Total", "Dismissals", (r) => r.fielding?.totalDismissals ?? 0, true],
];

/** One sheet of the PDF (it starts a new one in print too). */
function Sheet({
  first = false,
  children,
}: {
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "report-page space-y-6 pb-8 pt-6",
        !first && "break-before-page",
      )}
    >
      {children}
    </article>
  );
}

function ReportBar({ club }: { club: { name: string } }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-center gap-2.5">
        <BrandMark />
        <BrandWordmark />
        <span className="text-sm text-muted-foreground">Club statistics</span>
      </span>
      <Chip tone="outline">
        <Shield className="h-3.5 w-3.5" aria-hidden="true" />
        {club.name}
      </Chip>
    </header>
  );
}

function Page({
  fileName,
  clubUrl,
  title,
  children,
}: {
  fileName: string;
  clubUrl: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative isolate min-h-screen bg-background text-foreground [-webkit-print-color-adjust:exact] [print-color-adjust:exact]">
      <style>{PRINT_CSS}</style>
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-wash [mask-image:linear-gradient(to_bottom,#000_35%,transparent)] print:hidden"
      />
      <ReportToolbar
        fileName={fileName}
        matchUrl={clubUrl}
        title={title}
        closeLabel="Back to the club"
      />
      <main className="mx-auto max-w-[52rem] px-4 sm:px-6 print:max-w-none print:px-0">
        {children}
      </main>
    </div>
  );
}

function Footer({
  clubUrl,
  qrDataUrl,
}: {
  clubUrl: string;
  qrDataUrl: string;
}) {
  return (
    <ReportFooter
      matchUrl={clubUrl}
      qrDataUrl={qrDataUrl}
      title="CricScore club statistics"
      hint="Scan the code for the club page, its matches and records."
      alt="QR code linking to this club"
    />
  );
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * The club's statistics report: the players ranked by points, then the
 * batting, bowling and fielding figures in that same order, built from the
 * design system's tables. Long tables run over several sheets, each with
 * its own title and column heads; with `tab`, just that leaderboard tab's
 * table.
 */
export function ClubStatsReportView({
  club,
  clubUrl,
  rows,
  matches,
  generated,
  fileName,
  qrDataUrl,
  tab = null,
}: {
  club: { id: string; name: string };
  clubUrl: string;
  rows: readonly ClubStatsRow[];
  matches: number;
  generated: string;
  fileName: string;
  qrDataUrl: string;
  /** One leaderboard tab's table instead of the combined report. */
  tab?: TabTable<{ userId: string; name: string }> | null;
}) {
  if (tab) {
    const sheets = sheetsOfRows(tab.rows, {
      first: FIRST_TAB_SHEET_ROWS,
      max: SHEET_ROWS,
      last: FOOTER_SHEET_ROWS,
      only: ONLY_SHEET_ROWS,
    });
    return (
      <Page
        fileName={fileName}
        clubUrl={clubUrl}
        title={`${tab.label} statistics`}
      >
        {sheets.map((chunk, i) => (
          <Sheet key={i} first={i === 0}>
            {i === 0 && (
              <>
                <ReportBar club={club} />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {tab.label} · {tab.rankedBy.toLowerCase()}
                  </p>
                  <h1 className="text-balance text-2xl font-semibold text-foreground">
                    {club.name}
                  </h1>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {plural(matches, "match", "matches")} ·{" "}
                    {plural(tab.rows.length, "player", "players")} · {generated}
                  </p>
                </div>
              </>
            )}
            {tab.rows.length === 0 ? (
              <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
                No {tab.label.toLowerCase()} statistics yet.
              </p>
            ) : (
              <TabStatsTable
                table={tab}
                rows={chunk}
                title={i === 0 ? tab.label : `${tab.label} (continued)`}
                aside={
                  i === 0
                    ? plural(tab.rows.length, "player", "players")
                    : undefined
                }
              />
            )}
            {i === sheets.length - 1 && (
              <Footer clubUrl={clubUrl} qrDataUrl={qrDataUrl} />
            )}
          </Sheet>
        ))}
      </Page>
    );
  }

  const batters = rows.filter((r) => r.batting);
  const bowlers = rows.filter((r) => r.bowling);
  const fielders = rows.filter((r) => r.fielding);
  const runs = rows.reduce((n, r) => n + (r.batting?.runs ?? 0), 0);
  const wickets = rows.reduce((n, r) => n + (r.bowling?.wickets ?? 0), 0);

  // Points first, then one table per discipline, each on sheets of its own.
  const tables: {
    title: string;
    columns: readonly FigureColumn[];
    rows: readonly ClubStatsRow[];
  }[] = [
    { title: "Points", columns: POINTS, rows },
    { title: "Batting", columns: BATTING, rows: batters },
    { title: "Bowling", columns: BOWLING, rows: bowlers },
    { title: "Fielding", columns: FIELDING, rows: fielders },
  ];
  const present = tables.filter((t) => t.rows.length > 0);
  const tableCount = present.length;
  const sheetsOf = present.map((t, ti) => ({
    ...t,
    sheets: sheetsOfRows(t.rows, {
      first: ti === 0 ? FIRST_SHEET_ROWS : SHEET_ROWS,
      max: SHEET_ROWS,
      // Only the report's last table has the footer on its last sheet.
      last: ti === tableCount - 1 ? FOOTER_SHEET_ROWS : SHEET_ROWS,
      only: ti === 0 && tableCount === 1 ? ONLY_SHEET_ROWS : SHEET_ROWS,
    }),
  }));

  return (
    <Page fileName={fileName} clubUrl={clubUrl} title="Club statistics">
      {rows.length === 0 && (
        <Sheet first>
          <ReportBar club={club} />
          <h1 className="text-balance text-2xl font-semibold text-foreground">
            {club.name}
          </h1>
          <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">
            No statistics yet.
          </p>
          <Footer clubUrl={clubUrl} qrDataUrl={qrDataUrl} />
        </Sheet>
      )}
      {sheetsOf.flatMap((t, ti) =>
        t.sheets.map((chunk, i) => {
          const firstOfAll = ti === 0 && i === 0;
          const lastOfAll =
            ti === sheetsOf.length - 1 && i === t.sheets.length - 1;
          return (
            <Sheet key={`${t.title}-${i}`} first={firstOfAll}>
              {firstOfAll && (
                <>
                  <ReportBar club={club} />
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Statistics and records
                    </p>
                    <h1 className="text-balance text-2xl font-semibold text-foreground">
                      {club.name}
                    </h1>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {plural(matches, "match", "matches")} ·{" "}
                      {plural(rows.length, "player", "players")} · {generated}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
                    <StatTile label="Matches" value={matches} />
                    <StatTile label="Players" value={rows.length} />
                    <StatTile label="Runs scored" value={runs} />
                    <StatTile label="Wickets taken" value={wickets} />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Players ranked by points: batting, bowling and fielding
                    added together. Players level on points share a rank. The
                    figures that follow are in the same order.
                  </p>
                </>
              )}
              <StatsTable
                title={i === 0 ? t.title : `${t.title} (continued)`}
                aside={
                  i === 0
                    ? plural(t.rows.length, "player", "players")
                    : undefined
                }
                columns={t.columns}
                rows={chunk}
              />
              {lastOfAll && <Footer clubUrl={clubUrl} qrDataUrl={qrDataUrl} />}
            </Sheet>
          );
        }),
      )}
    </Page>
  );
}
