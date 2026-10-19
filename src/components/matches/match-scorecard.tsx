"use client";

import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Badge } from "~/components/ui/badge";
import type { Innings, Match } from "~/lib/match-types";
import {
  dismissalText,
  economyRate,
  formatDecimalOvers,
  inningsBalls,
  oversFromBalls,
  byBattingOrder,
  runRate,
  strikeRate,
  teamName,
} from "~/lib/cricket";
import { cn } from "~/lib/utils";

interface MatchScorecardProps {
  match: Match;
}

/**
 * Header rows of the two tables, in the colours the scoring screen uses for
 * the sides (batting green, bowling blue), so each table reads at a glance.
 */
const BATTING_HEAD =
  "bg-emerald-500/10 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-100";
const BOWLING_HEAD =
  "bg-sky-500/10 text-sky-900 dark:bg-sky-400/10 dark:text-sky-100";
const HEAD_CELL = "py-2.5 text-xs font-semibold text-current";

function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

/** "b 2, lb 1, w 5, nb 2" (penalty runs only when there are some). */
function extrasBreakdown(innings: Innings): string {
  const parts = [
    `b ${innings.extras_byes || 0}`,
    `lb ${innings.extras_leg_byes || 0}`,
    `w ${innings.extras_wides || 0}`,
    `nb ${innings.extras_no_balls || 0}`,
  ];
  if (innings.extras_penalties) parts.push(`p ${innings.extras_penalties}`);
  return parts.join(", ");
}

interface StandBatter {
  name: string;
  /** Runs and balls faced in the stand; null on stands recorded before. */
  runs: number | null;
  balls: number | null;
}

interface Stand {
  key: string;
  label: string;
  batters: [StandBatter, StandBatter];
  runs: number;
  balls: number;
  /** Runs of the stand that neither batter scored. */
  extras: number | null;
  /** How it ended, when not by the wicket it is named after. */
  ending: "unbroken" | "retired hurt" | null;
}

/**
 * The innings' stands in order, labelled by the wicket they were for, with
 * the batters' names from the batting rows (the stored stands hold ids).
 */
function standsOf(innings: Innings): Stand[] {
  const names = new Map(
    (innings.batting_performances ?? []).map((b) => [
      b.user_id,
      b.user?.full_name ?? "Unknown",
    ]),
  );
  const rows = innings.partnerships ?? [];
  let wicketsBefore = 0;
  return rows.flatMap((p, i) => {
    const wicket = p.wicket_number ?? null;
    // The wickets down before it, plus one: a stand a retirement closed (the
    // engine keeps the wicket count it had) and the next share a wicket.
    const n = wicketsBefore + 1;
    const fell = wicket !== null && wicket > wicketsBefore;
    if (fell) wicketsBefore = wicket;
    const runs = p.runs ?? 0;
    const balls = p.balls ?? 0;
    // A stand that never faced a ball and ended without a wicket (the
    // innings closed as it began) is not a stand.
    if (wicket === null && runs === 0 && balls === 0 && !p.is_current)
      return [];
    const split = p.batsman1_runs != null && p.batsman2_runs != null;
    const batter = (
      id: string,
      r: number | null | undefined,
      b: number | null | undefined,
    ): StandBatter => ({
      name: names.get(id) ?? "Unknown",
      runs: split ? (r ?? 0) : null,
      balls: split ? (b ?? 0) : null,
    });
    return [
      {
        key: `${i}`,
        label: `${ordinal(n)} wkt`,
        batters: [
          batter(p.batsman1_id, p.batsman1_runs, p.batsman1_balls),
          batter(p.batsman2_id, p.batsman2_runs, p.batsman2_balls),
        ],
        runs,
        balls,
        extras: split
          ? Math.max(0, runs - (p.batsman1_runs ?? 0) - (p.batsman2_runs ?? 0))
          : null,
        ending:
          wicket === null
            ? Boolean(p.is_current) || i === rows.length - 1
              ? "unbroken"
              : null
            : fell
              ? null
              : "retired hurt",
      },
    ];
  });
}

/** One batter's share: name (cut short if need be), then runs (balls). */
function StandShare({
  batter,
  align,
}: {
  batter: StandBatter;
  align: "start" | "end";
}) {
  return (
    <span
      className={cn(
        "flex min-w-0 items-baseline gap-1.5",
        align === "end" && "justify-end text-right",
      )}
    >
      <span className="min-w-0 truncate font-medium text-foreground">
        {batter.name}
      </span>
      <span className="shrink-0 tabular-nums">
        <span className="font-semibold text-foreground">{batter.runs}</span>{" "}
        <span className="text-muted-foreground">({batter.balls})</span>
      </span>
    </span>
  );
}

export function MatchScorecard({ match }: MatchScorecardProps) {
  const sortedInnings = [...(match.innings || [])].sort(
    (a, b) => a.innings_number - b.innings_number,
  );

  if (sortedInnings.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No innings data available yet
        </CardContent>
      </Card>
    );
  }

  const currentInningsNum =
    match.current_innings ?? sortedInnings[0]?.innings_number;
  const activeInningsExists = sortedInnings.some(
    (inn) => inn.innings_number === currentInningsNum,
  );
  const defaultTab = activeInningsExists
    ? `innings-${currentInningsNum}`
    : `innings-${sortedInnings[sortedInnings.length - 1]?.innings_number ?? 1}`;

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      {/* The selected side is filled in the primary colour; the other stays
          a plain, readable button (a muted one looks disabled). */}
      <TabsList
        aria-label="Innings"
        className="mb-4 grid h-auto w-full max-w-md grid-cols-2 gap-1.5 border bg-muted/50 p-1"
      >
        {sortedInnings.map((innings) => {
          const t =
            innings.team_id === match.team1_id ? match.team1 : match.team2;
          const name = t?.name || t?.short_name;
          return (
            <TabsTrigger
              key={innings.id}
              value={`innings-${innings.innings_number}`}
              className="h-auto min-w-0 flex-col items-start gap-0.5 border border-border/60 bg-background/70 px-3 py-2 text-left text-foreground hover:bg-background data-[state=active]:border-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
            >
              <span className="w-full truncate text-sm font-semibold">
                {name}
              </span>
              <span className="w-full truncate text-xs tabular-nums opacity-90">
                {sortedInnings.length > 2 && `Inn ${innings.innings_number} · `}
                {innings.total_runs}/{innings.total_wickets} (
                {formatDecimalOvers(innings.total_overs)} ov)
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>

      {sortedInnings.map((innings) => {
        const battedUserIds = new Set(
          innings.batting_performances?.map((bp) => bp.user_id),
        );
        const battingTeam =
          innings.team_id === match.team1_id ? match.team1 : match.team2;
        const dnbPlayers = battingTeam.team_players?.filter(
          (tp) => !battedUserIds.has(tp.user_id),
        );
        const rr = runRate(
          innings.total_runs,
          inningsBalls(innings, match.balls_per_over ?? 6),
          match.balls_per_over ?? 6,
        );
        const fallOfWickets = [...(innings.fall_of_wickets ?? [])].sort(
          (a, b) => a.wicket_number - b.wicket_number,
        );
        const stands = standsOf(innings);

        return (
          <TabsContent
            key={innings.id}
            value={`innings-${innings.innings_number}`}
          >
            <div className="space-y-6">
              {/* Innings Header */}
              <Card className="overflow-hidden border-border bg-card">
                <CardHeader className="py-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-sm font-semibold text-foreground">
                        {battingTeam.short_name?.slice(0, 3) ||
                          battingTeam.name.slice(0, 3)}
                      </div>
                      <div>
                        <CardTitle className="text-lg sm:text-xl">
                          {teamName(match, innings.team_id)} Innings
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">
                          Innings {innings.innings_number}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-score text-3xl font-bold tabular-nums text-foreground sm:text-4xl">
                        {innings.total_runs}/{innings.total_wickets}
                      </div>
                      <div className="text-xs font-medium tabular-nums text-muted-foreground sm:text-sm">
                        {formatDecimalOvers(innings.total_overs)} ov · RR {rr}
                      </div>
                      {innings.target_runs ? (
                        <div className="text-xs tabular-nums text-muted-foreground">
                          Target {innings.target_runs}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
              </Card>

              {/* Batting Card */}
              <Card className="content-visibility-auto overflow-hidden border-border">
                <CardHeader className="border-b border-border/50 py-3.5">
                  <CardTitle className="text-base sm:text-lg">
                    Batting
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className={BATTING_HEAD}>
                      <TableRow className="border-b-emerald-600/20 hover:bg-transparent">
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "w-auto min-w-[120px] px-3 sm:w-[220px] sm:px-4",
                          )}
                        >
                          Batter
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          R
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          B
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          4s
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          6s
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          SR
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...(innings.batting_performances || [])]
                        .sort(byBattingOrder)
                        .map((bp) => (
                          <TableRow
                            key={bp.id}
                            className="transition-colors hover:bg-muted/30"
                          >
                            <TableCell className="px-3 py-2.5 sm:px-4 sm:py-3">
                              <div>
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <span className="text-xs font-semibold text-foreground sm:text-sm">
                                    {bp.user?.full_name}
                                  </span>
                                  {!bp.is_out && (
                                    <Badge
                                      variant="outline"
                                      className="border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0 text-2xs font-semibold text-emerald-600 dark:text-emerald-400 sm:text-xs"
                                    >
                                      not out
                                    </Badge>
                                  )}
                                </div>
                                {bp.is_out && (
                                  <p className="text-2xs text-muted-foreground sm:text-xs">
                                    {dismissalText(
                                      bp,
                                      innings.fall_of_wickets ?? [],
                                    )}
                                  </p>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="px-1.5 py-2.5 text-center font-score text-sm font-bold tabular-nums text-foreground sm:px-2 sm:py-3 sm:text-base">
                              {bp.runs_scored}
                            </TableCell>
                            <TableCell className="px-1.5 py-2.5 text-center text-xs tabular-nums text-muted-foreground sm:px-2 sm:py-3 sm:text-sm">
                              {bp.balls_faced}
                            </TableCell>
                            <TableCell className="px-1.5 py-2.5 text-center text-xs tabular-nums sm:px-2 sm:py-3 sm:text-sm">
                              {bp.fours > 0 ? (
                                <span className="inline-block rounded bg-amber-500/10 px-1.5 py-0.5 font-bold text-amber-600 dark:text-amber-400">
                                  {bp.fours}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">
                                  0
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-1.5 py-2.5 text-center text-xs tabular-nums sm:px-2 sm:py-3 sm:text-sm">
                              {bp.sixes > 0 ? (
                                <span className="inline-block rounded bg-purple-500/10 px-1.5 py-0.5 font-bold text-purple-600 dark:text-purple-400">
                                  {bp.sixes}
                                </span>
                              ) : (
                                <span className="text-muted-foreground/60">
                                  0
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="px-1.5 py-2.5 text-center text-xs tabular-nums sm:px-2 sm:py-3 sm:text-sm">
                              {(() => {
                                const sr = strikeRate(
                                  bp.runs_scored,
                                  bp.balls_faced,
                                );
                                const srNum = parseFloat(sr);
                                const srColor = isNaN(srNum)
                                  ? "text-muted-foreground"
                                  : srNum >= 150
                                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                    : srNum >= 100
                                      ? "text-foreground font-semibold"
                                      : "text-muted-foreground";
                                return <span className={srColor}>{sr}</span>;
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      {/* As on a printed scorecard: extras, then the total
                          with the overs and run rate. */}
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={6} className="px-3 py-2.5 sm:px-4">
                          <div className="flex items-baseline justify-between gap-3 text-xs sm:text-sm">
                            <span className="min-w-0">
                              <span className="font-semibold text-foreground">
                                Extras
                              </span>{" "}
                              <span className="tabular-nums text-muted-foreground">
                                ({extrasBreakdown(innings)})
                              </span>
                            </span>
                            <span className="shrink-0 font-score font-semibold tabular-nums text-foreground">
                              {innings.extras_total || 0}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      <TableRow className="border-t-2 bg-muted/30 hover:bg-muted/30">
                        <TableCell colSpan={6} className="px-3 py-3 sm:px-4">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="min-w-0 text-sm">
                              <span className="font-semibold text-foreground">
                                Total
                              </span>{" "}
                              <span className="text-xs tabular-nums text-muted-foreground sm:text-sm">
                                ({formatDecimalOvers(innings.total_overs)} ov,
                                RR {rr})
                              </span>
                            </span>
                            <span
                              className="shrink-0 font-score text-base font-bold tabular-nums text-foreground sm:text-lg"
                              data-testid="innings-total"
                            >
                              {innings.total_runs}/{innings.total_wickets}
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  {dnbPlayers && dnbPlayers.length > 0 && (
                    <p className="border-t px-3 py-2.5 text-xs sm:px-4 sm:text-sm">
                      <span className="font-semibold text-muted-foreground">
                        {innings.is_completed ? "Did not bat" : "Yet to bat"}:
                      </span>{" "}
                      <span className="text-foreground">
                        {dnbPlayers
                          .map((p) => p.user?.full_name || "Player")
                          .join(", ")}
                      </span>
                    </p>
                  )}

                  {fallOfWickets.length > 0 && (
                    <div className="border-t px-3 py-3 sm:px-4">
                      <h4 className="mb-1.5 text-xs font-semibold text-muted-foreground sm:text-sm">
                        Fall of wickets
                      </h4>
                      <p className="text-xs leading-relaxed sm:text-sm">
                        {fallOfWickets.map((fow, i) => (
                          <span key={fow.id}>
                            <span className="whitespace-nowrap">
                              <strong className="font-score font-semibold tabular-nums text-foreground">
                                {fow.wicket_number}-{fow.runs_at_fall}
                              </strong>{" "}
                              <span className="text-muted-foreground">
                                ({fow.batsman?.full_name ?? "Unknown"},{" "}
                                {formatDecimalOvers(fow.overs_at_fall)} ov)
                              </span>
                            </span>
                            {i < fallOfWickets.length - 1 && ", "}
                          </span>
                        ))}
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Bowling Card */}
              <Card className="content-visibility-auto overflow-hidden border-border">
                <CardHeader className="border-b border-border/50 py-3.5">
                  <CardTitle className="text-base sm:text-lg">
                    Bowling
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className={BOWLING_HEAD}>
                      <TableRow className="border-b-sky-600/20 hover:bg-transparent">
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "w-auto min-w-[120px] px-3 sm:w-[220px] sm:px-4",
                          )}
                        >
                          Bowler
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          O
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          M
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          R
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          W
                        </TableHead>
                        <TableHead
                          className={cn(
                            HEAD_CELL,
                            "px-1.5 text-center sm:px-2",
                          )}
                        >
                          Econ
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {/* In the order they came on, as on a scorecard. */}
                      {(innings.bowling_performances || []).map((bp) => (
                        <TableRow
                          key={bp.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <TableCell className="px-3 py-2.5 text-xs font-semibold text-foreground sm:px-4 sm:py-3 sm:text-sm">
                            {bp.user?.full_name}
                          </TableCell>
                          <TableCell className="px-1.5 py-2.5 text-center text-xs tabular-nums text-muted-foreground sm:px-2 sm:py-3 sm:text-sm">
                            {oversFromBalls(bp.balls_bowled ?? 0)}
                          </TableCell>
                          <TableCell className="px-1.5 py-2.5 text-center text-xs tabular-nums sm:px-2 sm:py-3 sm:text-sm">
                            {bp.maidens > 0 ? (
                              <span className="font-bold text-primary">
                                {bp.maidens}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">
                                {bp.maidens}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="px-1.5 py-2.5 text-center text-xs tabular-nums sm:px-2 sm:py-3 sm:text-sm">
                            {bp.runs_conceded}
                          </TableCell>
                          <TableCell className="px-1.5 py-2.5 text-center font-score text-sm font-bold tabular-nums sm:px-2 sm:py-3 sm:text-base">
                            {bp.wickets_taken > 0 ? (
                              <span className="inline-flex items-center justify-center rounded-md bg-destructive/15 px-1.5 py-0.5 font-bold text-destructive">
                                {bp.wickets_taken}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </TableCell>
                          <TableCell className="px-1.5 py-2.5 text-center text-xs tabular-nums sm:px-2 sm:py-3 sm:text-sm">
                            {(() => {
                              const econ = economyRate(
                                bp.runs_conceded,
                                bp.balls_bowled,
                              );
                              const econNum = parseFloat(econ);
                              const econColor = isNaN(econNum)
                                ? "text-muted-foreground"
                                : econNum <= 6.0
                                  ? "text-emerald-600 dark:text-emerald-400 font-bold"
                                  : econNum > 10.0
                                    ? "text-destructive font-medium"
                                    : "text-foreground";
                              return <span className={econColor}>{econ}</span>;
                            })()}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {stands.length > 0 && (
                <Card className="content-visibility-auto overflow-hidden border-border">
                  <CardHeader className="border-b border-border/50 py-3.5">
                    <div className="flex items-baseline justify-between gap-3">
                      <CardTitle className="text-base sm:text-lg">
                        Partnerships
                      </CardTitle>
                      <span className="text-xs text-muted-foreground">
                        Runs (balls)
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    <ul className="divide-y" aria-label="Partnerships">
                      {stands.map((st) => {
                        const [a, b] = st.batters;
                        const split = a.runs !== null && b.runs !== null;
                        return (
                          <li key={st.key} className="px-3 py-2.5 sm:px-4">
                            <div className="flex items-baseline justify-between gap-3">
                              <span className="text-xs font-medium text-muted-foreground">
                                {st.label}
                                {st.ending && ` · ${st.ending}`}
                              </span>
                              <span className="shrink-0 text-right tabular-nums">
                                {split && st.extras ? (
                                  <span className="text-xs text-muted-foreground">
                                    {st.extras} extras ·{" "}
                                  </span>
                                ) : null}
                                <span className="font-score text-sm font-bold text-foreground">
                                  {st.runs}
                                </span>{" "}
                                <span className="text-xs text-muted-foreground">
                                  ({st.balls})
                                </span>
                              </span>
                            </div>
                            {split ? (
                              <>
                                <div className="mt-1 grid grid-cols-2 gap-3 text-xs sm:text-sm">
                                  <StandShare batter={a} align="start" />
                                  <StandShare batter={b} align="end" />
                                </div>
                                {/* Each batter's share of the stand, on their
                                    side; the gap between is extras. */}
                                <div
                                  className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-muted"
                                  aria-hidden="true"
                                >
                                  <div
                                    className="h-full bg-emerald-600 dark:bg-emerald-400"
                                    style={{
                                      width: `${st.runs ? ((a.runs ?? 0) / st.runs) * 100 : 0}%`,
                                    }}
                                  />
                                  <div className="flex-1" />
                                  <div
                                    className="h-full bg-emerald-600/45 dark:bg-emerald-400/45"
                                    style={{
                                      width: `${st.runs ? ((b.runs ?? 0) / st.runs) * 100 : 0}%`,
                                    }}
                                  />
                                </div>
                              </>
                            ) : (
                              <p className="mt-0.5 truncate text-xs font-medium text-foreground sm:text-sm">
                                {a.name} &amp; {b.name}
                              </p>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
