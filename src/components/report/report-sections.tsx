import { Shield, Trophy } from "lucide-react";
import { BrandMark, BrandWordmark } from "~/components/brand";
import { TeamCrest } from "~/components/ds/avatar";
import { Card } from "~/components/ds/card";
import { Chip } from "~/components/ds/chip";
import type { ExportTeamStats, MatchReportModel, ReportTeam } from "~/lib/match-report";

/*
 * The match report's first page: its header, each side's summary card and
 * the link. The detail sheets are in `report-sheet.tsx`.
 */

export function ReportHeader({
  tournament,
  club,
}: Pick<MatchReportModel, "tournament" | "club">) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3">
      <span className="flex items-center gap-2.5">
        <BrandMark />
        <BrandWordmark />
        <span className="text-sm text-muted-foreground">
          Official match record
        </span>
      </span>
      <span className="flex flex-wrap gap-1.5">
        {tournament && (
          <Chip tone="outline">
            <Trophy className="h-3.5 w-3.5" aria-hidden="true" />
            {tournament}
          </Chip>
        )}
        {club && (
          <Chip tone="outline">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" />
            {club}
          </Chip>
        )}
      </span>
    </header>
  );
}

type SummaryRow = { name: string; fig: string; sub: string };

/** One column of a summary card, its heading shown (paper has no hover). */
function SummaryColumn({ title, rows }: { title: string; rows: SummaryRow[] }) {
  return (
    <div className="min-w-0">
      <h3 className="truncate text-xs text-muted-foreground sm:text-sm">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-1 text-sm text-muted-foreground">No figures</p>
      ) : (
        <ol className="mt-1">
          {rows.map((r, i) => (
            <li
              key={`${i}-${r.name}`}
              // A phone's half width: the name on its own line, not cut.
              // `sm`, not `md`: an A4 print is narrower than `md`.
              className="flex items-baseline gap-2 py-1 max-sm:flex-wrap max-sm:gap-x-1.5 max-sm:gap-y-0"
            >
              <span className="min-w-0 flex-1 truncate text-sm text-foreground max-sm:basis-full sm:text-base">
                {r.name}
              </span>
              <span className="font-score text-base font-semibold tabular-nums text-foreground sm:text-lg">
                {r.fig}
              </span>
              <span className="w-10 shrink-0 text-right font-score text-xs tabular-nums text-muted-foreground max-sm:w-auto sm:w-12 sm:text-sm">
                {r.sub}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/**
 * One side on the report's first page, as on the share-summary image: its
 * score, then its top three batters beside the bowlers who bowled at them
 * (the other side's), two columns on every size. Before a side bats it is
 * just the header.
 */
export function InningsSummaryCard({
  team,
  stats,
}: {
  team: ReportTeam;
  stats: ExportTeamStats;
}) {
  // "178/5 (20.0)": the score large, the overs beside it.
  const [score, overs] = stats.scoreLine.replace(")", "").split(" (");
  const played = stats.batters.length > 0 || stats.bowlers.length > 0;
  return (
    <Card className="break-inside-avoid overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <TeamCrest {...team} size="sm" />
        <h2 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground sm:text-lg">
          {team.name}
        </h2>
        {overs ? (
          <span className="shrink-0 font-score tabular-nums">
            <span className="text-xl font-bold text-foreground sm:text-2xl">{score}</span>{" "}
            <span className="text-sm text-muted-foreground">({overs} ov)</span>
          </span>
        ) : (
          <span className="shrink-0 text-sm text-muted-foreground">
            {score}
          </span>
        )}
      </div>
      {played && (
        <div className="grid grid-cols-2 gap-x-6 border-t border-border px-4 py-3 sm:gap-x-10 sm:px-5">
          <SummaryColumn
            title="Batting"
            rows={stats.batters.map((b) => ({
              name: b.name,
              fig: `${b.runs}${b.notOut ? "*" : ""}`,
              sub: `(${b.balls})`,
            }))}
          />
          <SummaryColumn
            title={`Bowling: ${stats.bowlingSide}`}
            rows={stats.bowlers.map((b) => ({
              name: b.name,
              fig: `${b.wickets}/${b.runs}`,
              sub: `(${b.overs})`,
            }))}
          />
        </div>
      )}
    </Card>
  );
}

export function ReportFooter({
  matchUrl,
  qrDataUrl,
  title = "CricScore match record",
  hint = "Scan the code for the ball-by-ball log and the wagon wheel.",
  alt = "QR code linking to this match",
}: {
  matchUrl: string;
  qrDataUrl: string;
  title?: string;
  hint?: string;
  alt?: string;
}) {
  return (
    <footer className="flex break-inside-avoid items-center justify-between gap-4 rounded-xl bg-muted/60 p-4 sm:p-5">
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="break-all font-score text-xs text-muted-foreground">
          {matchUrl}
        </p>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element -- a data URL */}
      <img
        src={qrDataUrl}
        alt={alt}
        width={96}
        height={96}
        className="h-24 w-24 shrink-0 rounded-lg bg-white"
      />
    </footer>
  );
}

/** A section's title on the page ("Over by over"). */
