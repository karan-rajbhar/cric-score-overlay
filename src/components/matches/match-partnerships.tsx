"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "~/components/ds/card";
import { PartnershipList, type StandData } from "~/components/ds/partnership";
import { usePartnershipsQuery } from "~/lib/hooks/useMatchQueries";
import type { Match } from "~/lib/match-types";
import { inningsInPlay } from "~/lib/cricket";
import { Loader2 } from "lucide-react";

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

/**
 * A stand in the design system's form, with the split the engine stores
 * (each batter's runs and balls faced, as the batting card counts them;
 * older stands got theirs from `scripts/migrate-partnership-splits.mjs`).
 */
function standOf(p: Partnership, wicket: number, inPlay: boolean): StandData {
  return {
    key: p.id,
    wicket,
    names: [
      p.batsman1?.full_name ?? "Batter 1",
      p.batsman2?.full_name ?? "Batter 2",
    ],
    runs: p.runs,
    balls: p.balls,
    shares: storedShares(p),
    // The engine leaves the last stand current when an innings ends
    // without a wicket: live only while its innings is in play.
    live: Boolean(p.is_current) && inPlay,
    unbroken: Boolean(p.is_current) && !inPlay,
  };
}

function storedShares(p: Partnership): StandData["shares"] {
  if (p.batsman1_runs == null || p.batsman2_runs == null) return null;
  return [
    { runs: p.batsman1_runs, balls: p.batsman1_balls ?? 0 },
    { runs: p.batsman2_runs, balls: p.batsman2_balls ?? 0 },
  ];
}

/** Stands by innings, in batting order, with the best one marked. */
function groupStands(rows: Partnership[], match: Match) {
  const byInnings = new Map<string, Partnership[]>();
  for (const r of rows) {
    if (!byInnings.has(r.innings_id)) byInnings.set(r.innings_id, []);
    byInnings.get(r.innings_id)!.push(r);
  }

  return [...byInnings.entries()].map(([inningsId, group]) => {
    const inn = match.innings?.find((i) => i.id === inningsId);
    const inPlay = inningsInPlay(match, inn);
    const stands = group
      .slice()
      .sort((a, b) => a.start_over - b.start_over)
      .map((p, idx) => standOf(p, idx + 1, inPlay));
    const best = stands.reduce<StandData | null>(
      (top, s) => (s.runs > (top?.runs ?? 0) ? s : top),
      null,
    );
    const someRecorded = stands.some((s) => s.shares);
    return {
      inningsId,
      teamName: inn
        ? inn.team_id === match.team1_id
          ? match.team1.name
          : match.team2.name
        : "—",
      inningsTotal: inn?.total_runs ?? 0,
      noneRecorded: !someRecorded,
      stands: stands.map((s) => ({
        ...s,
        best: s === best,
        noteMissing: !s.shares && someRecorded,
      })),
    };
  });
}

/** Partnerships: each wicket stand, split between its two batters. */
export function MatchPartnerships({ match }: { match: Match }) {
  const { data, error } = usePartnershipsQuery(match.id);

  const inningsGroups = useMemo(
    () => (data ? groupStands(data as unknown as Partnership[], match) : null),
    [data, match],
  );

  return (
    <Card>
      <CardHeader
        title="Partnerships"
        description="Each wicket stand in batting order, with each batter's runs and balls faced. The bar is split by who scored: first batter dark, second light, extras grey."
      />
      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
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
              <section
                key={g.inningsId}
                aria-label={`Partnerships for ${g.teamName}`}
              >
                <div className="mb-2 flex items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold text-foreground">
                    {g.teamName}
                  </h3>
                  <p className="font-score text-xs tabular-nums text-muted-foreground">
                    {g.stands.length} stand{g.stands.length === 1 ? "" : "s"} ·{" "}
                    {g.inningsTotal} total
                  </p>
                </div>
                {g.noneRecorded && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    Each batter's runs and balls are not recorded for these
                    stands.
                  </p>
                )}
                <PartnershipList
                  stands={g.stands}
                  inningsTotal={g.inningsTotal}
                />
              </section>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
