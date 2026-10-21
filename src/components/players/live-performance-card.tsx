import Link from "next/link";
import type { LivePerformance } from "~/lib/firebase/live-player";
import { LiveIndicator } from "~/components/matches/live-indicator";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

type Team = { name?: string | null } | null | undefined;

export interface LivePerformanceItem extends LivePerformance {
  match: {
    id: unknown;
    title?: unknown;
    team1?: unknown;
    team2?: unknown;
  };
}

function matchLabel(m: LivePerformanceItem["match"]): string {
  const t1 = (m.team1 as Team)?.name;
  const t2 = (m.team2 as Team)?.name;
  if (t1 && t2) return `${t1} vs ${t2}`;
  return typeof m.title === "string" && m.title ? m.title : "Live match";
}

/**
 * The player's figures in innings still being played (not yet part of the
 * career history below, which counts completed innings).
 */
export function LivePerformanceCard({
  performances,
}: {
  performances: LivePerformanceItem[];
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          Playing now
          <LiveIndicator />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {performances.map((p) => (
          <div
            key={p.matchId}
            className="flex flex-col gap-1.5 rounded-lg border border-border/70 p-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <Link
              href={`/matches/${String(p.match.id)}`}
              className="min-w-0 truncate text-sm font-semibold text-foreground underline-offset-2 hover:underline"
            >
              {matchLabel(p.match)}
            </Link>
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              {p.batting.map((b) => (
                <div key={`bat-${b.inningsId}`} className="flex gap-1.5">
                  <dt className="text-muted-foreground">Batting</dt>
                  <dd className="tabular-nums">
                    <span className="font-semibold">
                      {b.runs}
                      {b.isOut ? "" : "*"}
                    </span>{" "}
                    <span className="text-muted-foreground">({b.balls})</span>
                    {b.isOut && b.dismissal && (
                      <span className="text-muted-foreground">
                        {" "}
                        {b.dismissal.replace(/_/g, " ")}
                      </span>
                    )}
                    {b.atCrease && (
                      <span className="sr-only"> not out, at the crease</span>
                    )}
                  </dd>
                </div>
              ))}
              {p.bowling.map((b) => (
                <div key={`bowl-${b.inningsId}`} className="flex gap-1.5">
                  <dt className="text-muted-foreground">Bowling</dt>
                  <dd className="tabular-nums">
                    <span className="font-semibold">
                      {b.wickets}/{b.runs}
                    </span>{" "}
                    <span className="text-muted-foreground">
                      ({b.overs} ov)
                    </span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
