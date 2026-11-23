import type * as React from "react";
import { TeamCrest } from "~/components/ds/avatar";
import { LocalDate } from "~/components/ds/local-date";
import { Milestone } from "~/components/ds/scorecard";
import type {
  ImpactLeader,
  MatchReportModel,
  OverData,
  Partnership,
  ReportInnings,
} from "~/lib/match-report";
import { cn } from "~/lib/utils";

/*
 * The report's detail sheets, made for paper and for a phone that pinches
 * the PDF once: no cards, a firm rule over each table and hairlines between
 * rows, each block half a sheet wide where it can be (at 2x zoom a phone
 * shows half a sheet, names and figures together). Type stays at the sizes
 * the app uses (14 px names and key figures, 12 px secondary, 11 px column
 * heads); the density comes from the layout. Two columns from `md` up, and
 * in print (an A4 sheet is narrower than `md`); one on phones.
 */

/** A table's head row: the first cell names the table. */
const HEAD =
  "pb-1 pt-1.5 pl-2.5 text-right align-bottom text-[0.6875rem] font-semibold text-muted-foreground first:pl-0 first:text-left";
/** A figure cell. */
const FIG =
  "py-1 pl-2.5 text-right align-middle font-score text-[0.8125rem] text-foreground whitespace-nowrap";
const RULE = "border-t-[1.5px] border-foreground";
const ROW = "border-b border-border";
/** Two halves side by side from `md` up and on paper. */
const HALVES = "grid gap-x-6 gap-y-4 md:grid-cols-2 print:grid-cols-2";

const SERIES_BG = ["bg-series-1", "bg-series-2"] as const;

/** "1st innings · Vinayak 11" with the score, overs and rates on the right. */
function InningsHead({ inn }: { inn: ReportInnings }) {
  const facts = [
    `Run rate ${inn.runRate}`,
    inn.target ? `Target ${inn.target}` : null,
    inn.inProgress ? "In progress" : null,
  ].filter(Boolean);
  return (
    <header className="flex break-after-avoid items-end justify-between gap-4">
      <span className="flex min-w-0 items-center gap-2.5">
        <TeamCrest {...inn.team} size="sm" />
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">
            {inn.heading}
          </span>
          <h2 className="truncate text-lg font-semibold leading-tight text-foreground">
            {inn.team.name}
          </h2>
        </span>
      </span>
      <span className="shrink-0 text-right font-score">
        <span className="block whitespace-nowrap text-2xl font-bold tabular-nums leading-none text-foreground">
          {inn.score}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            ({inn.overs} ov)
          </span>
        </span>
        <span className="mt-1 block text-xs tabular-nums text-muted-foreground">
          {facts.join(" · ")}
        </span>
      </span>
    </header>
  );
}

/** "all out", "7 wkts", "7 wkts dec", "forfeited". */
function wicketsWord(inn: ReportInnings): string {
  if (inn.forfeited) return "forfeited";
  if (inn.wickets >= 10 && !inn.declared) return "all out";
  return `${inn.wickets} wkts${inn.declared ? " dec" : ""}`;
}

/** Extras, then the total on a band: wickets, overs, runs, run rate. */
function BattingTotals({ inn }: { inn: ReportInnings }) {
  const runs = inn.runs;
  return (
    <>
      <tr className={ROW}>
        <th
          scope="row"
          className="py-1 text-left text-sm font-normal text-foreground"
        >
          Extras{" "}
          {inn.extras.detail && (
            <span className="text-xs text-muted-foreground">
              {inn.extras.detail}
            </span>
          )}
        </th>
        <td className={FIG}>{inn.extras.total}</td>
        <td colSpan={4} />
      </tr>
      <tr className="bg-primary-soft/60">
        <th
          scope="row"
          className="py-1.5 pl-2 text-left text-sm font-semibold text-foreground"
        >
          Total{" "}
          <span className="text-xs font-normal text-muted-foreground">
            {wicketsWord(inn)}, {inn.overs} ov
          </span>
        </th>
        <td className={cn(FIG, "text-sm font-bold")}>{runs}</td>
        <td
          colSpan={4}
          className={cn(FIG, "pr-2 text-xs text-muted-foreground")}
        >
          Run rate {inn.runRate}
        </td>
      </tr>
    </>
  );
}

/** Who did not bat (or is yet to), and the boundaries line. */
function BattingNotes({ inn }: { inn: ReportInnings }) {
  if (inn.didNotBat.length === 0 && !inn.boundaries) return null;
  return (
    <div className="mt-1.5 space-y-0.5 text-xs leading-snug text-muted-foreground">
      {inn.didNotBat.length > 0 && (
        <p>
          <span className="font-semibold text-foreground">
            {inn.inProgress ? "Yet to bat" : "Did not bat"}
          </span>{" "}
          {inn.didNotBat.join(", ")}
        </p>
      )}
      {inn.boundaries && <p>{inn.boundaries}</p>}
    </div>
  );
}

/** Batting: name over dismissal, then R, B, 4s, 6s, SR close beside it. */
function Batting({ inn }: { inn: ReportInnings }) {
  return (
    <div className="min-w-0">
      <table className={cn("w-full border-collapse", RULE)}>
        <thead>
          <tr className={ROW}>
            <th scope="col" className={cn(HEAD, "text-sm text-foreground")}>
              Batting
            </th>
            {["R", "B", "4s", "6s", "SR"].map((h) => (
              <th key={h} scope="col" className={HEAD}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {inn.batters.map((b, i) => (
            <tr key={`${i}-${b.name}`} className={ROW}>
              <th
                scope="row"
                className="py-1 text-left align-middle font-normal"
              >
                <span className="block text-sm font-medium leading-tight text-foreground">
                  {b.name}
                </span>
                <span
                  className={cn(
                    "block text-xs leading-tight",
                    b.notOut
                      ? "font-medium text-success"
                      : "text-muted-foreground",
                  )}
                >
                  {b.dismissal}
                </span>
              </th>
              <td className={cn(FIG, "text-sm font-semibold")}>
                <Milestone value={b.runs} soft={50} solid={100} />
              </td>
              <td className={FIG}>{b.balls}</td>
              <td className={FIG}>{b.fours}</td>
              <td className={FIG}>{b.sixes}</td>
              <td className={cn(FIG, "text-muted-foreground")}>
                {b.strikeRate}
              </td>
            </tr>
          ))}
          <BattingTotals inn={inn} />
        </tbody>
      </table>
      <BattingNotes inn={inn} />
    </div>
  );
}

/** "Fall of wickets 1-2 Harsh, 0.5 ov  2-22 Kumar, 3.5 ov ...": one line. */
function FallOfWickets({ inn }: { inn: ReportInnings }) {
  if (inn.fallOfWickets.length === 0) return null;
  return (
    <p className={cn("pt-1.5 text-xs leading-5 text-muted-foreground", RULE)}>
      <span className="mr-1.5 text-sm font-semibold text-foreground">
        Fall of wickets
      </span>{" "}
      {inn.fallOfWickets.map((f) => (
        // A space between entries, so the line wraps there.
        <span key={f.score}>
          <span className="mr-2 whitespace-nowrap">
            <span className="font-score text-[0.8125rem] font-semibold text-foreground">
              {f.score}
            </span>{" "}
            {f.name}, {f.over} ov
          </span>{" "}
        </span>
      ))}
    </p>
  );
}

const ordinal = (n: number) => {
  const tail =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (["th", "st", "nd", "rd"][n % 10] ?? "th");
  return `${n}${tail}`;
};

/** One stand's bar: each batter's runs, then extras, scaled to the best. */
function StandBar({ p, best }: { p: Partnership; best: number }) {
  const extras = Math.max(0, p.runs - p.batter1.runs - p.batter2.runs);
  const parts = [
    { runs: p.batter1.runs, cls: "bg-primary" },
    { runs: p.batter2.runs, cls: "bg-primary/40" },
    { runs: extras, cls: "bg-muted-foreground/25" },
  ].filter((x) => x.runs > 0);
  return (
    <span className="mt-1 block h-1 w-full overflow-hidden rounded-full bg-muted">
      <span
        className="flex h-1 gap-px"
        style={{ width: `${best > 0 ? (p.runs / best) * 100 : 0}%` }}
      >
        {parts.map((x, i) => (
          <span
            key={i}
            className={cn("block h-1 rounded-sm", x.cls)}
            style={{ width: `${(x.runs / Math.max(1, p.runs)) * 100}%` }}
          />
        ))}
      </span>
    </span>
  );
}

/** A stand's batter: their swatch, name, runs and balls. */
function StandBatter({
  b,
  first = false,
}: {
  b: Partnership["batter1"];
  first?: boolean;
}) {
  return (
    <span className="mr-2.5 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={cn(
          "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
          first ? "bg-primary" : "bg-primary/40",
        )}
      />
      {b.name} <span className="font-score font-semibold">{b.runs}</span>{" "}
      <span className="font-score text-xs text-muted-foreground">
        ({b.balls})
      </span>
    </span>
  );
}

/** Partnerships: one row a stand, a thin bar split by who scored. */
function Partnerships({ inn }: { inn: ReportInnings }) {
  if (inn.partnerships.length === 0) return null;
  const best = Math.max(0, ...inn.partnerships.map((p) => p.runs));
  return (
    <table className={cn("w-full border-collapse", RULE)}>
      <thead>
        <tr className={ROW}>
          <th
            scope="col"
            colSpan={2}
            className={cn(HEAD, "text-sm text-foreground")}
          >
            Partnerships{" "}
            <span className="text-[0.6875rem] font-medium text-muted-foreground">
              runs (balls)
            </span>
          </th>
          <th scope="col" className={HEAD}>
            Runs
          </th>
          <th scope="col" className={HEAD}>
            Balls
          </th>
        </tr>
      </thead>
      <tbody>
        {inn.partnerships.map((p, i) => {
          const extras = Math.max(0, p.runs - p.batter1.runs - p.batter2.runs);
          return (
            <tr key={`${p.wicketNumber}-${i}`} className={ROW}>
              <th
                scope="row"
                className="w-7 py-1 pr-1 text-left align-top font-score text-xs font-medium text-muted-foreground"
              >
                {ordinal(p.wicketNumber)}
              </th>
              <td className="py-1 text-left text-[0.8125rem] leading-tight text-foreground">
                <StandBatter b={p.batter1} first />
                <StandBatter b={p.batter2} />
                {extras > 0 && (
                  <span className="mr-2 whitespace-nowrap text-xs text-muted-foreground">
                    +{extras}
                  </span>
                )}
                {p.runs === best && best > 0 && (
                  <span className="rounded-full border border-primary/30 px-1.5 text-[0.6875rem] font-semibold text-primary">
                    Best
                  </span>
                )}
                {p.isUnbroken && (
                  <span className="ml-1 rounded-full border border-success/40 px-1.5 text-[0.6875rem] font-semibold text-success">
                    Unbroken
                  </span>
                )}
                <StandBar p={p} best={best} />
              </td>
              <td className={cn(FIG, "text-sm font-semibold")}>
                {p.runs}
                {p.isUnbroken ? "*" : ""}
              </td>
              <td className={cn(FIG, "text-muted-foreground")}>{p.balls}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

const BOWLING_MAIN = ["O", "M", "R", "W", "Econ"];
const BOWLING_DETAIL = ["0s", "4s", "6s", "Wd", "Nb"];

/**
 * The bowling table's column plan and heads: the main figures close to the
 * name (the half of the sheet a pinched phone shows), the slack in a gap,
 * then the detail.
 */
function BowlingHead({ side }: { side: string | null }) {
  const main = BOWLING_MAIN;
  const detail = BOWLING_DETAIL;
  return (
    <>
      <colgroup>
        <col className="w-44" />
        <col className="w-11" />
        <col className="w-9" />
        <col className="w-11" />
        <col className="w-10" />
        <col className="w-14" />
        <col />
        {detail.map((h) => (
          <col key={h} className="w-10" />
        ))}
      </colgroup>
      <thead>
        <tr className={ROW}>
          <th scope="col" className={cn(HEAD, "text-sm text-foreground")}>
            Bowling
            {side && " "}
            {side && (
              <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                {side}
              </span>
            )}
          </th>
          {main.map((h) => (
            <th key={h} scope="col" className={HEAD}>
              {h}
            </th>
          ))}
          <td aria-hidden="true" />
          {detail.map((h) => (
            <th key={h} scope="col" className={HEAD}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
    </>
  );
}

/**
 * Bowling, across the sheet: O, M, R, W, Econ beside the name (the half a
 * pinched phone shows), then dots, 4s, 6s, wides and no-balls after a gap.
 */
function Bowling({ inn, side }: { inn: ReportInnings; side: string | null }) {
  const dash = (n: number | null) => (n === null ? "–" : n);
  return (
    <div className="overflow-x-auto">
      <table
        className={cn("w-full min-w-[34rem] table-fixed border-collapse", RULE)}
      >
        <BowlingHead side={side} />
        <tbody>
          {inn.bowlers.map((b, i) => (
            <tr key={`${i}-${b.name}`} className={ROW}>
              <th
                scope="row"
                className="py-1 text-left text-sm font-medium leading-tight text-foreground"
              >
                {b.name}
              </th>
              <td className={FIG}>{b.overs}</td>
              <td className={FIG}>{b.maidens}</td>
              <td className={FIG}>{b.runs}</td>
              <td className={cn(FIG, "text-sm font-semibold")}>
                <Milestone value={b.wickets} soft={3} solid={5} />
              </td>
              <td className={cn(FIG, "text-muted-foreground")}>{b.economy}</td>
              <td aria-hidden="true" />
              <td className={cn(FIG, "text-muted-foreground")}>
                {dash(b.dots)}
              </td>
              <td className={cn(FIG, "text-muted-foreground")}>
                {dash(b.fours)}
              </td>
              <td className={cn(FIG, "text-muted-foreground")}>
                {dash(b.sixes)}
              </td>
              <td className={cn(FIG, "text-muted-foreground")}>{b.wides}</td>
              <td className={cn(FIG, "text-muted-foreground")}>{b.noBalls}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One innings on one sheet: batting on the left, the fall of wickets and
 * partnerships on the right, bowling across the foot. `bowlingSide` names
 * the side the bowlers play for.
 */
export function InningsSheet({
  inn,
  bowlingSide,
}: {
  inn: ReportInnings;
  bowlingSide: string | null;
}) {
  return (
    <section
      aria-label={`${inn.heading}: ${inn.team.name}`}
      data-sheet-label={inn.heading}
      className="space-y-3"
    >
      <InningsHead inn={inn} />
      <div data-keep-whole="" className={HALVES}>
        <Batting inn={inn} />
        <div className="min-w-0 space-y-3">
          <FallOfWickets inn={inn} />
          <Partnerships inn={inn} />
        </div>
      </div>
      <Bowling inn={inn} side={bowlingSide} />
    </section>
  );
}

/** A section's title on a flat sheet: a firm rule, the name, a note. */
function SheetTitle({
  title,
  note,
  children,
}: {
  title: string;
  note?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <h3
      className={cn(
        "flex break-after-avoid items-baseline justify-between gap-3 pt-1.5 text-sm font-semibold text-foreground",
        RULE,
      )}
    >
      <span>
        {title}
        {note && (
          <span className="ml-1.5 text-xs font-medium text-muted-foreground">
            {note}
          </span>
        )}
      </span>
      {children}
    </h3>
  );
}

function Phases({
  phases,
}: {
  phases: NonNullable<MatchReportModel["phases"]>;
}) {
  return (
    <div>
      <SheetTitle title="Phase by phase" note="score · run rate" />
      <table className="w-full border-collapse">
        <thead>
          <tr className={ROW}>
            <th scope="col" className={HEAD}>
              Phase
            </th>
            {phases.teams.map((t, i) => (
              <th key={`${t}-${i}`} scope="col" className={HEAD}>
                <span
                  aria-hidden="true"
                  className={cn(
                    "mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle",
                    SERIES_BG[i],
                  )}
                />
                {t}
              </th>
            ))}
            <th scope="col" className={HEAD}>
              Ahead
            </th>
          </tr>
        </thead>
        <tbody>
          {phases.rows.map((r) => (
            <tr key={r.name} className={ROW}>
              <th scope="row" className="py-1 text-left font-normal">
                <span className="text-sm font-medium text-foreground">
                  {r.name}
                </span>{" "}
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {r.overs}
                </span>
              </th>
              {r.sides.map((s, i) => (
                <td key={i} className={FIG}>
                  {s ? (
                    <>
                      <span className="font-semibold">{s.score}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {s.runRate}
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">–</span>
                  )}
                </td>
              ))}
              <td
                className={cn(FIG, "font-sans text-xs text-muted-foreground")}
              >
                {r.ahead === null ? "Even" : phases.teams[r.ahead]}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MatchInfo({ info }: { info: MatchReportModel["info"] }) {
  return (
    <div>
      <SheetTitle title="Match information" />
      <dl className="grid gap-x-6 text-[0.8125rem] leading-snug md:grid-cols-2 print:grid-cols-2">
        {info.map((r) => (
          <div
            key={r.label}
            className={cn(
              "flex gap-3 py-1",
              ROW,
              r.wide && "md:col-span-2 print:col-span-2",
            )}
          >
            <dt className="w-28 shrink-0 text-xs text-muted-foreground">
              {r.label}
            </dt>
            <dd className="min-w-0 text-foreground">
              {r.time ? (
                <LocalDate value={r.value} format="shortTime" />
              ) : (
                r.value
              )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Impact({ leaders }: { leaders: ImpactLeader[] }) {
  return (
    <div>
      <SheetTitle title="Match impact">
        <span className="text-[0.6875rem] font-semibold text-muted-foreground">
          Points
        </span>
      </SheetTitle>
      <ol>
        {leaders.map((l, i) => (
          <li key={l.id} className={cn("flex items-center gap-2.5 py-1", ROW)}>
            <span className="w-4 shrink-0 font-score text-xs text-muted-foreground">
              {i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium leading-tight text-foreground">
                {l.name}
              </span>
              <span className="block text-xs leading-tight text-muted-foreground">
                {l.teamTag} · {l.highlight}
              </span>
            </span>
            <span className="font-score text-base font-bold text-foreground">
              {l.points}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * The analysis: the phases and the match impact side by side, then the
 * match information across the sheet in two columns.
 */
export function AnalysisSheet({ report }: { report: MatchReportModel }) {
  return (
    <section
      aria-label="Analysis"
      data-sheet-label="Analysis"
      data-keep-whole=""
      className="space-y-4"
    >
      {(report.phases || report.impact.length > 0) && (
        <div className={HALVES}>
          {report.phases && (
            <div className="min-w-0">
              <Phases phases={report.phases} />
            </div>
          )}
          {report.impact.length > 0 && (
            <div className="min-w-0">
              <Impact leaders={report.impact} />
            </div>
          )}
        </div>
      )}
      <MatchInfo info={report.info} />
    </section>
  );
}

const CHIP: Record<OverData["balls"][number]["type"], string> = {
  dot: "border-muted bg-muted text-muted-foreground",
  single: "border-border bg-card text-foreground",
  four: "border-four bg-four text-four-foreground",
  six: "border-six bg-six text-six-foreground",
  wicket: "border-wicket bg-wicket text-wicket-foreground",
  extra: "border-extra/30 bg-extra/15 text-extra",
};

/**
 * A delivery as a small chip, in `deliveryLabel`'s words. A real border,
 * not an inset ring, and no inline-flex: html2canvas draws neither.
 */
function Ball({ ball }: { ball: OverData["balls"][number] }) {
  return (
    <span
      className={cn(
        "mr-1 inline-block h-[1.3125rem] min-w-[1.3125rem] rounded-full border px-1 text-center align-middle font-score text-[0.71875rem] font-semibold leading-[1.1875rem]",
        CHIP[ball.type],
      )}
    >
      {ball.text}
    </span>
  );
}

/** One side's over: the balls, runs and score; then bowler and batters. */
function OverCell({ over }: { over: OverData | null }) {
  if (!over) return <div className="py-1 text-xs text-muted-foreground">–</div>;
  const maidens = over.bowlerMaidens > 0 ? `, ${over.bowlerMaidens} m` : "";
  return (
    <div className="min-w-0 py-1">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0">
          {over.balls.map((b, i) => (
            <Ball key={i} ball={b} />
          ))}
        </span>
        <span className="shrink-0 whitespace-nowrap font-score text-xs text-muted-foreground">
          {over.runs} {over.runs === 1 ? "run" : "runs"}{" "}
          <span className="ml-1 text-[0.8125rem] font-semibold text-foreground">
            {over.cumulativeRuns}/{over.cumulativeWickets}
          </span>
        </span>
      </div>
      <div className="mt-0.5 flex justify-between gap-2 text-xs leading-tight text-muted-foreground">
        <span className="min-w-0">
          <span className="text-foreground">{over.bowlerName}</span>{" "}
          <span className="font-score">
            {over.bowlerWickets}/{over.bowlerRuns} ({over.bowlerOvers}
            {maidens})
          </span>
        </span>
        <span className="min-w-0 text-right">
          {over.batters
            .slice(0, 2)
            .map((b) => `${b.name} ${b.runs} (${b.balls})`)
            .join(" · ")}
        </span>
      </div>
    </div>
  );
}

/**
 * Five overs a block, each under the sides' names: a sheet never ends
 * inside one, and one starting at any block says which column is which.
 */
const BLOCK = 5;

/**
 * Over by over as a grid: one row an over, both innings side by side; the
 * balls, runs in the over and score, then the bowler's and the batters'
 * figures at its end.
 */
export function OverGrid({
  overs,
}: {
  overs: NonNullable<MatchReportModel["overs"]>;
}) {
  const blocks: (typeof overs.rows)[] = [];
  for (let i = 0; i < overs.rows.length; i += BLOCK) {
    blocks.push(overs.rows.slice(i, i + BLOCK));
  }
  const cols = "grid grid-cols-[1.5rem_minmax(0,1fr)_minmax(0,1fr)] gap-x-4";
  return (
    <div>
      {blocks.map((rows, b) => (
        <div key={b} data-keep-whole="" className={b > 0 ? "mt-2" : undefined}>
          <div className={cn(cols, "pb-0.5 pt-1", RULE, ROW)}>
            <span className="text-[0.6875rem] font-semibold text-muted-foreground">
              Ov
            </span>
            {overs.teams.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="truncate text-xs font-semibold text-foreground"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "mr-1.5 inline-block h-2 w-2 rounded-full align-middle",
                    SERIES_BG[i],
                  )}
                />
                {t}
              </span>
            ))}
          </div>
          <ol>
            {rows.map(([a, c], i) => (
              <li key={i} className={cn(cols, ROW)}>
                <span className="pt-1.5 font-score text-sm font-semibold text-foreground">
                  {b * BLOCK + i + 1}
                </span>
                <OverCell over={a} />
                <OverCell over={c} />
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}

/**
 * The sign-off, flat: four columns with a line to write a name on and a
 * line to sign, for tournament matches (a league's official record).
 */
export function SignoffSheet({
  signoff,
  matchIdShort,
  generatedAt,
}: Pick<MatchReportModel, "signoff" | "matchIdShort" | "generatedAt">) {
  return (
    <section
      aria-label="Sign-off"
      data-sheet-label="Sign-off"
      className="break-inside-avoid"
    >
      <SheetTitle title="Official verification and sign-off">
        <span className="text-xs font-medium text-muted-foreground">
          Certified official scoresheet
        </span>
      </SheetTitle>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4 print:grid-cols-4">
        {signoff.map((s) => (
          <div key={s.role} className="min-w-0">
            <span className="block text-xs text-muted-foreground">
              {s.role}
            </span>
            {s.name ? (
              <span className="mt-0.5 block h-5 truncate text-sm font-medium text-foreground">
                {s.name}
              </span>
            ) : (
              <span
                aria-label="Name"
                data-blank-name=""
                className="mt-0.5 block h-5 border-b border-dashed border-muted-foreground/40"
              />
            )}
            <span className="mt-10 block border-b border-foreground/40" />
            <span className="mt-1 block text-xs text-muted-foreground">
              Signature and date
            </span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span>
          By signing, both teams and the umpires accept this scorecard as the
          final record of the match.
        </span>
        <span className="font-score">
          Match ID #{matchIdShort} · Generated{" "}
          <LocalDate value={generatedAt} format="short" />
        </span>
      </p>
    </section>
  );
}
