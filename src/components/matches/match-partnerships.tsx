"use client";

import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import {
  usePartnershipsQuery,
  useMatchBallLogQuery,
} from "~/lib/hooks/useMatchQueries";
import type { BallEvent, Match } from "~/lib/match-types";
import { Loader2 } from "lucide-react";
import { LiveIndicator } from "./live-indicator";
import { cn } from "~/lib/utils";

interface Partnership {
  id: string;
  innings_id: string;
  runs: number;
  balls: number;
  start_over: number;
  end_over?: number | null;
  is_current: boolean | null;
  batsman1_id?: string | null;
  batsman2_id?: string | null;
  /** Each batter's share, kept by the engine (absent on older stands). */
  batsman1_runs?: number | null;
  batsman1_balls?: number | null;
  batsman2_runs?: number | null;
  batsman2_balls?: number | null;
  batsman1: { full_name: string } | null;
  batsman2: { full_name: string } | null;
}

interface StandSplit {
  b1Runs: number;
  b2Runs: number;
  extras: number;
  b1Balls: number;
  b2Balls: number;
}

const pairKey = (a?: string | null, b?: string | null) =>
  [a ?? "", b ?? ""].sort().join("|");

/** The split the engine stored with the stand, as the batting card counts. */
function storedSplit(p: Partnership): StandSplit | null {
  if (p.batsman1_runs == null || p.batsman2_runs == null) return null;
  return {
    b1Runs: p.batsman1_runs,
    b2Runs: p.batsman2_runs,
    extras: Math.max(0, (p.runs ?? 0) - p.batsman1_runs - p.batsman2_runs),
    b1Balls: p.batsman1_balls ?? 0,
    b2Balls: p.batsman2_balls ?? 0,
  };
}

/**
 * Derive per-batter splits for each stand from ball-by-ball data by
 * grouping consecutive balls with the same batting pair: for stands
 * recorded before the engine kept them ({@link storedSplit}).
 */
function deriveSplits(
  balls: BallEvent[],
  stands: Partnership[],
): Map<string, StandSplit> {
  const out = new Map<string, StandSplit>();
  if (balls.length === 0 || stands.length === 0) return out;

  const sorted = balls.slice().sort((x, y) => {
    const seq = (x.seq ?? 0) - (y.seq ?? 0);
    if (seq !== 0) return seq;
    const ov = (x.over_number ?? 0) - (y.over_number ?? 0);
    if (ov !== 0) return ov;
    return (x.ball_number ?? 0) - (y.ball_number ?? 0);
  });

  // Segment into consecutive-pair stands.
  const segments: { key: string; balls: BallEvent[] }[] = [];
  for (const b of sorted) {
    const key = pairKey(b.batsman_id, b.non_striker_id);
    const last = segments[segments.length - 1];
    if (last && last.key === key) last.balls.push(b);
    else segments.push({ key, balls: [b] });
  }

  // Match DB stands to segments in order (same innings, same pair → same stand).
  const unmatched = segments.slice();
  for (const stand of stands) {
    const key = pairKey(stand.batsman1_id, stand.batsman2_id);
    const idx = unmatched.findIndex((s) => s.key === key);
    const seg = idx >= 0 ? unmatched.splice(idx, 1)[0] : undefined;
    if (!seg) continue;
    const b1 = stand.batsman1_id;
    let b1Runs = 0;
    let b2Runs = 0;
    let extras = 0;
    let b1Balls = 0;
    let b2Balls = 0;
    for (const d of seg.balls) {
      const batRuns = d.runs_scored ?? 0;
      const ex = d.extras ?? 0;
      const isStrikerB1 = d.batsman_id === b1;
      if (d.extra_type === "no_ball") {
        // Scorer payload: runs_scored = bat runs, extras = 1 (the no-ball).
        // Not a ball faced (the engine counts legal deliveries only).
        if (isStrikerB1) b1Runs += batRuns;
        else b2Runs += batRuns;
        extras += ex;
        continue;
      }
      if (d.extra_type === "wide") {
        // Wides never count as balls faced (engine semantics).
        extras += ex;
        continue;
      }
      // Other team extras (bye/leg_bye/penalty): not the striker's runs.
      // A legal ball: faced, as the engine counts it.
      if (
        d.extra_type === "bye" ||
        d.extra_type === "leg_bye" ||
        d.extra_type === "penalty"
      ) {
        extras += ex;
        if (isStrikerB1) b1Balls += 1;
        else b2Balls += 1;
        continue;
      }
      extras += ex;
      if (d.batsman_id === b1) {
        b1Runs += batRuns;
        b1Balls += 1;
      } else {
        b2Runs += batRuns;
        b2Balls += 1;
      }
    }
    out.set(stand.id, { b1Runs, b2Runs, extras, b1Balls, b2Balls });
  }
  return out;
}

/** Partnerships — each stand split into two batter colours. */
export function MatchPartnerships({ match }: { match: Match }) {
  const { data, error } = usePartnershipsQuery(match.id);
  const { data: ballLog } = useMatchBallLogQuery(match.id);

  const inningsGroups = useMemo(() => {
    if (!data) return null;

    const rows = data as unknown as Partnership[];
    const balls = ((ballLog ?? []) as BallEvent[]).length
      ? ((ballLog ?? []) as BallEvent[])
      : (match.innings ?? []).flatMap((i) => i.ball_by_ball ?? []);
    const ballsByInnings = new Map<string, BallEvent[]>();
    for (const b of balls) {
      if (!ballsByInnings.has(b.innings_id)) ballsByInnings.set(b.innings_id, []);
      ballsByInnings.get(b.innings_id)!.push(b);
    }

    const byInnings = new Map<string, Partnership[]>();
    for (const r of rows) {
      if (!byInnings.has(r.innings_id)) byInnings.set(r.innings_id, []);
      byInnings.get(r.innings_id)!.push(r);
    }

    return [...byInnings.entries()].map(([inningsId, group]) => {
      const inn = match.innings?.find((i) => i.id === inningsId);
      const sorted = group.slice().sort((a, b) => a.start_over - b.start_over);
      const splits = deriveSplits(ballsByInnings.get(inningsId) ?? [], sorted);
      const bestId = sorted.reduce((best, p) =>
        p.runs > (best?.runs ?? -1) ? p : best,
      sorted[0] ?? null)?.id;
      return {
        inningsId,
        teamName: inn
          ? inn.team_id === match.team1_id
            ? match.team1.name
            : match.team2.name
          : "—",
        inningsTotal: inn?.total_runs ?? 0,
        bestId,
        rows: sorted.map((p) => ({
          ...p,
          split: storedSplit(p) ?? splits.get(p.id) ?? null,
        })),
      };
    });
  }, [data, ballLog, match]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-balance text-lg">Partnerships</CardTitle>
        <CardDescription className="text-balance">
          Each row is one wicket stand in batting order. The bar is split in
          two — blue is the first-named batter, purple the second-named batter,
          grey is extras. Bar length = stand runs as a share of the team total.
        </CardDescription>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-2xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-sky-500" /> Batter 1 (first name)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-violet-500" /> Batter 2 (second name)
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-full bg-slate-300" /> Extras
          </span>
        </div>
      </CardHeader>
      <CardContent>
        {inningsGroups === null ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : String(error)}
          </p>
        ) : inningsGroups.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No partnerships recorded yet.
          </p>
        ) : (
          <div className="space-y-6">
            {inningsGroups.map((g) => (
              <div key={g.inningsId}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-muted-foreground">
                    {g.teamName}
                  </p>
                  <p className="text-2xs tabular-nums text-muted-foreground">
                    {g.rows.length} stand{g.rows.length === 1 ? "" : "s"} ·{" "}
                    {g.inningsTotal} total
                  </p>
                </div>
                <ul
                  className="space-y-2"
                  aria-label={`Partnerships for ${g.teamName}`}
                >
                  {g.rows.map((p, idx) => {
                    const total = Math.max(1, p.runs);
                    const split = p.split;
                    // Scale the split to the authoritative DB total so the
                    // segments always add up to the stand runs.
                    const splitTotal = split
                      ? split.b1Runs + split.b2Runs + split.extras
                      : 0;
                    const scale =
                      split && splitTotal > 0 ? p.runs / splitTotal : 0;
                    const seg1 = split ? Math.round(split.b1Runs * scale) : 0;
                    const segEx = split ? Math.round(split.extras * scale) : 0;
                    const seg2 = Math.max(0, p.runs - seg1 - segEx);
                    const share =
                      g.inningsTotal > 0
                        ? (p.runs / g.inningsTotal) * 100
                        : 0;
                    const sr =
                      p.balls > 0
                        ? ((p.runs / p.balls) * 100).toFixed(1)
                        : "—";
                    const pct1 = p.runs > 0 ? Math.round((seg1 / total) * 100) : 0;
                    const pct2 = p.runs > 0 ? Math.round((seg2 / total) * 100) : 0;
                    const isBest = p.id === g.bestId && p.runs > 0;
                    const name1 = p.batsman1?.full_name ?? "Batter 1";
                    const name2 = p.batsman2?.full_name ?? "Batter 2";
                    return (
                      <li
                        key={p.id}
                        className={cn(
                          "rounded-xl border p-2.5",
                          p.is_current
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/70 bg-card",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-2xs font-bold tabular-nums text-muted-foreground"
                              title={`Wicket ${idx + 1} stand`}
                            >
                              {idx + 1}
                            </span>
                            <span className="truncate font-medium">
                              <span className="text-sky-600 dark:text-sky-400">{name1}</span>
                              {" & "}
                              <span className="text-violet-600 dark:text-violet-400">{name2}</span>
                            </span>
                            {p.is_current ? (
                              <LiveIndicator className="shrink-0 text-2xs" />
                            ) : null}
                            {isBest ? (
                              <Badge
                                variant="outline"
                                className="shrink-0 px-1.5 py-0 text-2xs font-medium"
                              >
                                Best
                              </Badge>
                            ) : null}
                          </span>
                          <span className="shrink-0 text-right tabular-nums">
                            <strong className="text-base font-bold tabular-nums">
                              {p.runs}
                            </strong>{" "}
                            <span className="text-xs text-muted-foreground">
                              <span className="hidden sm:inline">({p.balls} balls · SR {sr})</span>
                              <span className="sm:hidden">({p.balls}b · {sr})</span>
                            </span>
                          </span>
                        </div>

                        {/* Split contribution bar */}
                        <div className="mt-2 flex h-3 flex-1 overflow-hidden rounded-full bg-muted">
                          {seg1 > 0 && (
                            <div
                              className="h-full bg-sky-500"
                              style={{ width: `${(seg1 / total) * 100}%` }}
                              title={`${name1}: ${seg1} runs (${pct1}%)`}
                            />
                          )}
                          {seg2 > 0 && (
                            <div
                              className="h-full bg-violet-500"
                              style={{ width: `${(seg2 / total) * 100}%` }}
                              title={`${name2}: ${seg2} runs (${pct2}%)`}
                            />
                          )}
                          {segEx > 0 && (
                            <div
                              className="h-full bg-slate-300"
                              style={{ width: `${(segEx / total) * 100}%` }}
                              title={`Extras: ${segEx} runs`}
                            />
                          )}
                          {p.runs === 0 && (
                            <span className="flex w-full items-center justify-center text-2xs text-muted-foreground">
                              Duck — no runs
                            </span>
                          )}
                        </div>

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs tabular-nums">
                          {split ? (
                            <>
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                <span className="font-medium">{name1}</span>
                                <span className="text-muted-foreground">
                                  {seg1} ({pct1}%)
                                  {split.b1Balls > 0 ? ` · ${split.b1Balls}b` : ""}
                                </span>
                              </span>
                              <span className="flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-violet-500" />
                                <span className="font-medium">{name2}</span>
                                <span className="text-muted-foreground">
                                  {seg2} ({pct2}%)
                                  {split.b2Balls > 0 ? ` · ${split.b2Balls}b` : ""}
                                </span>
                              </span>
                              {segEx > 0 && (
                                <span className="text-muted-foreground">
                                  + {segEx} extras
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-muted-foreground">
                              Ball-by-ball not available — showing stand total only.
                            </span>
                          )}
                          <span className="ml-auto text-muted-foreground">
                            {share.toFixed(0)}% of team total
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
