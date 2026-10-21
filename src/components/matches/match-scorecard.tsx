"use client";

import { Card, CardHeader } from "~/components/ds/card";
import { PartnershipList, type StandData } from "~/components/ds/partnership";
import {
  BattingCard,
  BowlingCard,
  FallOfWickets,
} from "~/components/ds/scorecard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import type { Innings, Match } from "~/lib/match-types";
import { allInnings, type ReportInnings } from "~/lib/match-report";
import { inningsInPlay } from "~/lib/cricket";

interface MatchScorecardProps {
  match: Match;
}

/**
 * The innings' stands in order, numbered by the wicket they were for, with
 * the batters' names from the batting rows (the stored stands hold ids)
 * and the best one marked.
 */
function standDataOf(innings: Innings, inPlay: boolean): StandData[] {
  const names = new Map(
    (innings.batting_performances ?? []).map((b) => [
      b.user_id,
      b.user?.full_name ?? "Unknown",
    ]),
  );
  const rows = innings.partnerships ?? [];
  let wicketsBefore = 0;
  const stands = rows.flatMap((p, i): StandData[] => {
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
    return [
      {
        key: `${i}`,
        wicket: n,
        names: [
          names.get(p.batsman1_id) ?? "Unknown",
          names.get(p.batsman2_id) ?? "Unknown",
        ],
        runs,
        balls,
        shares: split
          ? [
              { runs: p.batsman1_runs ?? 0, balls: p.batsman1_balls ?? 0 },
              { runs: p.batsman2_runs ?? 0, balls: p.batsman2_balls ?? 0 },
            ]
          : null,
        // The engine leaves the last stand current when an innings ends
        // without a wicket: live only while the innings is in play.
        live: Boolean(p.is_current) && inPlay,
        unbroken: wicket === null && i === rows.length - 1,
        ending: wicket !== null && !fell ? "Retired hurt" : undefined,
      },
    ];
  });
  const best = Math.max(0, ...stands.map((s) => s.runs));
  return stands.map((s) => ({ ...s, best: best > 0 && s.runs === best }));
}

/**
 * The scorecard of each innings, one tab per side (score in the tab): the
 * batting card, fall of wickets, partnerships and bowling, in the design
 * system's tables, as in the match report.
 */
export function MatchScorecard({ match }: MatchScorecardProps) {
  const innings = allInnings(match);

  if (innings.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-muted-foreground">
        No innings data available yet
      </Card>
    );
  }

  const current = innings.find((i) => i.inProgress) ?? innings.at(-1)!;
  const sideName = (inn: ReportInnings) => inn.team.name;

  return (
    <Tabs defaultValue={current.id} className="w-full">
      {/* The selected side is filled in the primary colour; the other stays
          a plain, readable button (a muted one looks disabled). */}
      <TabsList
        aria-label="Innings"
        className="mb-4 grid h-auto w-full max-w-md grid-cols-2 gap-2"
      >
        {innings.map((inn) => (
          <TabsTrigger
            key={inn.id}
            value={inn.id}
            className="h-auto min-w-0 flex-col items-start gap-0.5 rounded-2xl px-4 py-2.5 text-left text-foreground hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
          >
            <span className="w-full truncate text-sm font-semibold">
              {sideName(inn)}
            </span>
            <span className="w-full truncate font-score text-xs tabular-nums opacity-90">
              {innings.length > 2 && `${inn.heading} · `}
              {inn.score} ({inn.overs} ov)
            </span>
          </TabsTrigger>
        ))}
      </TabsList>

      {innings.map((inn) => {
        const source = match.innings?.find((i) => i.id === inn.id);
        const stands = source
          ? standDataOf(source, inningsInPlay(match, source))
          : [];
        return (
          <TabsContent key={inn.id} value={inn.id} className="space-y-4">
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
              className="[contain-intrinsic-size:auto_36rem] [content-visibility:auto]"
            />
            <BowlingCard title="Bowling" rows={inn.bowlers} />
            {inn.fallOfWickets.length > 0 && (
              <Card className="p-4 sm:p-5">
                <h3 className="mb-3 text-sm font-semibold text-foreground">
                  Fall of wickets
                </h3>
                <FallOfWickets wickets={inn.fallOfWickets} />
              </Card>
            )}
            {stands.length > 0 && (
              <Card className="[contain-intrinsic-size:auto_18rem] [content-visibility:auto]">
                <CardHeader title="Partnerships" />
                <div className="px-4 pb-4 sm:px-5 sm:pb-5">
                  <PartnershipList
                    stands={stands}
                    inningsTotal={source?.total_runs ?? undefined}
                    aria-label="Partnerships"
                  />
                </div>
              </Card>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}
