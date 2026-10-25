import type * as React from "react";
import { Shield, Trophy } from "lucide-react";
import { BrandMark, BrandWordmark } from "~/components/brand";
import { TeamCrest } from "~/components/ds/avatar";
import { BallChip, type BallKind } from "~/components/ds/ball";
import { Card, CardHeader } from "~/components/ds/card";
import { Chip } from "~/components/ds/chip";
import { PartnershipList, type StandData } from "~/components/ds/partnership";
import {
  BattingCard,
  BowlingCard,
  FallOfWickets,
  TableCard,
} from "~/components/ds/scorecard";
import { figCell, figHead, figTable } from "~/components/ds/fig-table";
import { RankList } from "~/components/ds/standings";
import type {
  ImpactLeader,
  MatchReportModel,
  OverData,
  ReportInnings,
} from "~/lib/match-report";
import { cn } from "~/lib/utils";

/*
 * The match report's sections, each a design-system component or a card of
 * them, so the report reads like the match page. Print: cards are kept
 * whole where they fit, two-column grids stay two columns on A4.
 */

const SERIES_BG = ["bg-series-1", "bg-series-2"] as const;

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

export function PhasesCard({
  phases,
}: {
  phases: NonNullable<MatchReportModel["phases"]>;
}) {
  return (
    <TableCard title="Phase by phase" className="break-inside-avoid">
      <table className={figTable}>
        <thead>
          <tr>
            {["Phase", ...phases.teams, "Ahead"].map((h, i) => (
              <th key={`${h}-${i}`} scope="col" className={figHead}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {phases.rows.map((r) => (
            <tr key={r.name} className="border-t border-border">
              <th scope="row" className={cn(figCell, "font-sans font-normal")}>
                <span className="block font-medium text-foreground">
                  {r.name}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {r.overs}
                </span>
              </th>
              {r.sides.map((s, i) => (
                <td key={i} className={figCell}>
                  {s ? (
                    <>
                      <span className="block font-semibold text-foreground">
                        {s.score}
                      </span>
                      <span className="block whitespace-nowrap text-xs text-muted-foreground">
                        RR {s.runRate}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
              ))}
              <td className={figCell}>
                {r.ahead === null ? (
                  <Chip size="sm">Even</Chip>
                ) : (
                  <Chip size="sm" tone="outline">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-1.5 w-1.5 rounded-full",
                        SERIES_BG[r.ahead],
                      )}
                    />
                    {phases.teams[r.ahead]}
                  </Chip>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}

export function ImpactCard({ leaders }: { leaders: ImpactLeader[] }) {
  return (
    <RankList
      title="Match impact"
      unit="Points"
      className="break-inside-avoid"
      rows={leaders.map((l) => ({
        name: l.name,
        team: `${l.teamTag} · ${l.highlight}`,
        value: l.points,
      }))}
    />
  );
}

export function InfoCard({ info }: { info: MatchReportModel["info"] }) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader title="Match information" />
      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-4 pb-4 sm:grid-cols-2 sm:px-5 sm:pb-5 print:grid-cols-2">
        {info.map((r) => (
          <div
            key={r.label}
            className={cn(
              "min-w-0",
              r.wide && "sm:col-span-2 print:col-span-2",
            )}
          >
            <dt className="text-xs text-muted-foreground">{r.label}</dt>
            <dd className="text-sm text-foreground">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function stands(inn: ReportInnings): StandData[] {
  const best = Math.max(0, ...inn.partnerships.map((p) => p.runs));
  return inn.partnerships.map((p, i) => ({
    key: `${p.wicketNumber}-${i}`,
    wicket: p.wicketNumber,
    names: [p.batter1.name, p.batter2.name],
    runs: p.runs,
    balls: p.balls,
    shares: [
      { runs: p.batter1.runs, balls: p.batter1.balls },
      { runs: p.batter2.runs, balls: p.batter2.balls },
    ],
    unbroken: p.isUnbroken,
    best: best > 0 && p.runs === best,
  }));
}

function InningsHeader({ inn }: { inn: ReportInnings }) {
  const facts = [
    `RR ${inn.runRate}`,
    inn.target ? `Target ${inn.target}` : null,
    inn.inProgress ? "In progress" : null,
  ].filter(Boolean);
  return (
    <header className="flex break-after-avoid flex-wrap items-end justify-between gap-3">
      <span className="flex min-w-0 items-center gap-3">
        <TeamCrest {...inn.team} size="md" />
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">
            {inn.heading}
          </span>
          <h2 className="truncate text-lg font-semibold text-foreground">
            {inn.team.name}
          </h2>
        </span>
      </span>
      <span className="text-right">
        <span className="block font-score text-2xl font-bold tabular-nums leading-tight text-foreground">
          {inn.score}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({inn.overs} ov)
          </span>
        </span>
        <span className="block font-score text-xs tabular-nums text-muted-foreground">
          {facts.join(" · ")}
        </span>
      </span>
    </header>
  );
}

/** One innings: batting, fall of wickets, partnerships, bowling. */
export function InningsSection({ inn }: { inn: ReportInnings }) {
  return (
    <section
      aria-label={`${inn.heading}: ${inn.team.name}`}
      className="space-y-3"
    >
      <InningsHeader inn={inn} />
      <BattingCard
        title="Batting"
        rows={inn.batters}
        extras={inn.extras}
        total={{
          label: `${inn.score} (${inn.overs} ov)`,
          runRate: inn.runRate,
        }}
        didNotBat={inn.didNotBat}
        didNotBatLabel={inn.inProgress ? "Yet to bat" : "Did not bat"}
        milestones
        note={inn.boundaries}
      />
      {inn.fallOfWickets.length > 0 && (
        <Card className="break-inside-avoid p-4 sm:p-5">
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Fall of wickets
          </h3>
          <FallOfWickets wickets={inn.fallOfWickets} />
        </Card>
      )}
      {inn.partnerships.length > 0 && (
        <Card>
          <CardHeader
            title="Partnerships"
            description="Each batter's runs and balls faced; the bar is split by who scored."
          />
          <div className="px-4 pb-4 sm:px-5 sm:pb-5">
            <PartnershipList
              stands={stands(inn)}
              aria-label={`Partnerships for ${inn.team.name}`}
            />
          </div>
        </Card>
      )}
      <BowlingCard title="Bowling" rows={inn.bowlers} detailed />
    </section>
  );
}

const BALL_KIND: Record<OverData["balls"][number]["type"], BallKind> = {
  dot: "dot",
  single: "run",
  four: "four",
  six: "six",
  wicket: "wicket",
  extra: "extra",
};

/** One over: its deliveries, the batters' and bowler's figures, the score. */
export function OverCard({ over }: { over: OverData | null }) {
  if (!over) {
    return (
      <div className="flex min-h-24 items-center justify-center rounded-2xl border border-dashed border-border text-xs text-muted-foreground">
        –
      </div>
    );
  }
  return (
    <div className="break-inside-avoid rounded-2xl bg-muted/60 p-3">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">
          Over {over.overNumber}
        </span>
        <span className="font-score tabular-nums text-muted-foreground">
          {over.runs} {over.runs === 1 ? "run" : "runs"} ·{" "}
          <span className="font-semibold text-foreground">
            {over.cumulativeRuns}/{over.cumulativeWickets}
          </span>
        </span>
      </div>
      <ol className="mt-2 flex flex-wrap gap-1">
        {over.balls.map((b, i) => (
          <li key={i}>
            <BallChip kind={BALL_KIND[b.type]} label={b.text} size="sm" />
          </li>
        ))}
      </ol>
      <div className="mt-2 flex flex-col gap-1 text-xs sm:flex-row sm:justify-between sm:gap-3">
        <span className="min-w-0 space-y-0.5">
          {over.batters.slice(0, 2).map((b) => (
            <span key={b.name} className="block truncate text-foreground">
              {b.name}{" "}
              <span className="font-score tabular-nums text-muted-foreground">
                {b.runs} ({b.balls})
              </span>
            </span>
          ))}
        </span>
        <span className="min-w-0 sm:shrink-0 sm:text-right">
          <span className="block truncate text-foreground">
            {over.bowlerName}
          </span>
          <span className="block font-score tabular-nums text-muted-foreground">
            {over.bowlerOvers} ov · {over.bowlerWickets}/{over.bowlerRuns}
            {over.bowlerMaidens > 0 ? ` · ${over.bowlerMaidens} m` : ""}
          </span>
        </span>
      </div>
    </div>
  );
}

/** Over N of both innings side by side, team names on top. */
export function OverComparison({
  overs,
}: {
  overs: NonNullable<MatchReportModel["overs"]>;
}) {
  return (
    <div className="space-y-2">
      <div className="grid break-after-avoid grid-cols-2 gap-3">
        {overs.teams.map((t, i) => (
          <h3
            key={`${t}-${i}`}
            className="flex items-center gap-2 text-sm font-semibold text-foreground"
          >
            <span
              aria-hidden="true"
              className={cn("h-2.5 w-2.5 rounded-full", SERIES_BG[i])}
            />
            <span className="truncate">{t}</span>
          </h3>
        ))}
      </div>
      <ol className="space-y-2">
        {overs.rows.map(([a, b], i) => (
          <li key={i} className="grid break-inside-avoid grid-cols-2 gap-3">
            <OverCard over={a} />
            <OverCard over={b} />
          </li>
        ))}
      </ol>
    </div>
  );
}

export function SignoffCard({
  signoff,
  matchIdShort,
  generated,
}: Pick<MatchReportModel, "signoff" | "matchIdShort" | "generated">) {
  return (
    <Card className="break-inside-avoid p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">
          Official verification and sign-off
        </h2>
        <Chip tone="primary" size="sm">
          Certified official scoresheet
        </Chip>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 print:grid-cols-4">
        {signoff.map((s) => (
          <div
            key={s.role}
            className="flex flex-col rounded-2xl bg-muted/60 p-3"
          >
            <span className="text-xs text-muted-foreground">{s.role}</span>
            {s.name ? (
              <span className="mt-0.5 block h-5 truncate text-sm font-medium text-foreground">
                {s.name}
              </span>
            ) : (
              // A line to write the name on.
              <span
                aria-label="Name"
                data-blank-name=""
                className="mt-0.5 block h-5 border-b border-dashed border-muted-foreground/40"
              />
            )}
            <span className="mt-10 block border-b border-foreground/30" />
            <span className="mt-1 text-2xs text-muted-foreground">
              Signature and date
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          By signing, both teams and the umpires accept this scorecard as the
          final record of the match.
        </span>
        <span className="font-score tabular-nums">
          Match ID #{matchIdShort} · Generated {generated}
        </span>
      </p>
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
export function ReportSectionTitle({
  title,
  description,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <div className="break-after-avoid">
      <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      {description && (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}
