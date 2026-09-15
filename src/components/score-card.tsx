/**
 * Live scorecard demo used on the landing page.
 */

import { Card, CardContent } from "~/components/ui/card";
import { Badge } from "~/components/ui/badge";
import { strikeRate } from "~/lib/cricket";

interface ScoreCardProps {
  match: {
    id: string;
    team1: string;
    team2: string;
    status: "upcoming" | "live" | "completed";
    team1Score?: {
      runs: number;
      wickets: number;
      overs: number;
    };
    team2Score?: {
      runs: number;
      wickets: number;
      overs: number;
    };
    currentBatsmen?: {
      batsman1: { name: string; runs: number; balls: number };
      batsman2: { name: string; runs: number; balls: number };
    };
    recentOvers?: string[];
  };
}

function TeamScore({
  name,
  score,
  batting,
}: {
  name: string;
  score?: ScoreCardProps["match"]["team1Score"];
  batting?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        batting ? "border-primary/40 bg-primary/5" : "border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium">{name}</p>
        {batting && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">
            Batting
          </span>
        )}
      </div>
      {score ? (
        <div className="mt-2 flex items-baseline gap-2">
          <span className="score-display text-3xl font-semibold leading-none">
            {score.runs}/{score.wickets}
          </span>
          <span className="tabular text-sm text-muted-foreground">
            ({score.overs.toFixed(1)} ov)
          </span>
        </div>
      ) : (
        <p className="mt-2 text-lg text-muted-foreground">Yet to bat</p>
      )}
    </div>
  );
}

export function ScoreCard({ match }: ScoreCardProps) {
  return (
    <Card className="mx-auto w-full max-w-4xl">
      <CardContent className="space-y-5 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {match.team1} vs {match.team2}
          </p>
          {match.status === "live" && <Badge variant="live">Live</Badge>}
        </div>

        {/* Scores */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TeamScore name={match.team1} score={match.team1Score} />
          <TeamScore
            name={match.team2}
            score={match.team2Score}
            batting={match.status === "live"}
          />
        </div>

        {/* Current batters */}
        {match.status === "live" && match.currentBatsmen && (
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border p-4 sm:grid-cols-2">
            {[match.currentBatsmen.batsman1, match.currentBatsmen.batsman2].map(
              (b, index) => (
                <div key={index} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {b.name}
                      {index === 0 && (
                        <span className="ml-1.5 text-primary">*</span>
                      )}
                    </p>
                    <p className="tabular text-xs text-muted-foreground">
                      SR {strikeRate(b.runs, b.balls)}
                    </p>
                  </div>
                  <p className="score-display tabular text-xl font-semibold">
                    {b.runs}
                    <span className="ml-1 text-sm font-normal text-muted-foreground">
                      ({b.balls})
                    </span>
                  </p>
                </div>
              ),
            )}
          </div>
        )}

        {/* Recent overs */}
        {match.recentOvers && match.recentOvers.length > 0 && (
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {match.recentOvers.map((over, overIndex) => (
              <div key={overIndex} className="flex items-center gap-1.5">
                <span className="mr-1 text-xs text-muted-foreground">
                  Ov {overIndex + 1}
                </span>
                {over.split(" ").map((ball, ballIndex) => {
                  let cls =
                    "bg-secondary text-secondary-foreground border-border";
                  if (ball === "W")
                    cls = "bg-red-600 text-white border-red-600";
                  else if (ball === "4")
                    cls =
                      "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/40";
                  else if (ball === "6")
                    cls =
                      "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/40";
                  return (
                    <span
                      key={ballIndex}
                      className={`tabular inline-flex h-7 min-w-7 items-center justify-center rounded-full border px-1.5 text-xs font-semibold ${cls}`}
                    >
                      {ball}
                    </span>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
