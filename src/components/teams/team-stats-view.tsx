import Link from "next/link";
import { Card, CardHeader } from "~/components/ds/card";
import { Facts, factsOf } from "~/components/ds/facts";
import { StatGrid, StatTile } from "~/components/ds/stat-tile";
import type { TeamStats, TeamTotal } from "~/lib/team-stats";

/** "4 of 6" (won), for a side of the toss; "–" before any. */
const record = ({ played, won }: { played: number; won: number }) =>
  played > 0 ? `${won} of ${played}` : "–";

/** "168/6 (20 ov) v Tigers", linking to the match. */
function Total({ total }: { total: TeamTotal }) {
  return (
    <Link
      href={`/matches/${total.matchId}`}
      prefetch={false}
      className="hover:text-primary hover:underline"
    >
      <span className="font-score tabular-nums">
        {total.runs}/{total.wickets}
        {total.overs !== null && ` (${total.overs} ov)`}
      </span>{" "}
      v {total.opponent}
    </Link>
  );
}

/**
 * A team's Stats tab: how it does batting first and chasing, its totals
 * and its biggest wins, from the matches the page has (`teamStatsOf`).
 * `partial`: only its latest matches are at hand, and the tab says so.
 */
export function TeamStatsView({
  stats,
  partial = false,
}: {
  stats: TeamStats;
  partial?: boolean;
}) {
  const facts = factsOf(
    stats.highest && ["Highest total", <Total key="h" total={stats.highest} />],
    stats.lowest &&
      stats.lowest.matchId !== stats.highest?.matchId && [
        "Lowest total",
        <Total key="l" total={stats.lowest} />,
      ],
    stats.biggestByRuns && [
      "Biggest win by runs",
      <Link
        key="r"
        href={`/matches/${stats.biggestByRuns.matchId}`}
        prefetch={false}
        className="hover:text-primary hover:underline"
      >
        <span className="font-score tabular-nums">{stats.biggestByRuns.margin}</span>{" "}
        runs v {stats.biggestByRuns.opponent}
      </Link>,
    ],
    stats.biggestByWickets && [
      "Biggest win by wickets",
      <Link
        key="w"
        href={`/matches/${stats.biggestByWickets.matchId}`}
        prefetch={false}
        className="hover:text-primary hover:underline"
      >
        <span className="font-score tabular-nums">{stats.biggestByWickets.margin}</span>{" "}
        wickets v {stats.biggestByWickets.opponent}
      </Link>,
    ],
  );
  return (
    <div className="space-y-4">
      {/* Three figures, one row at every size. */}
      <StatGrid className="grid-cols-3 gap-2 sm:grid-cols-3 sm:gap-3">
        {/* "0 of 1" with "won" under it: "Won batting first" did not fit
            a phone's third of a row. */}
        <StatTile
          label="Batting first"
          value={record(stats.battingFirst)}
          hint={stats.battingFirst.played > 0 ? "won" : undefined}
        />
        <StatTile
          label="Chasing"
          value={record(stats.chasing)}
          hint={stats.chasing.played > 0 ? "won" : undefined}
        />
        <StatTile label="Average total" value={stats.average ?? "–"} />
      </StatGrid>
      {facts.length > 0 && (
        <Card>
          <CardHeader title="Records" />
          <Facts facts={facts} />
        </Card>
      )}
      <p className="px-1 text-xs text-muted-foreground">
        {partial
          ? `From the team's latest ${stats.matches} finished matches.`
          : `From the team's ${stats.matches} finished ${stats.matches === 1 ? "match" : "matches"}.`}
      </p>
    </div>
  );
}
