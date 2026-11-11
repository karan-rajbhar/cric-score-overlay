import Link from "next/link";
import { Card, CardHeader } from "~/components/ds/card";
import {
  playerMilestones,
  type BestFigure,
  type MilestoneBatting,
  type MilestoneBowling,
} from "~/lib/milestones";

/** Most recent milestones listed under the counts. */
const MAX_LISTED = 8;

function shortDate(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function MatchLine({
  matchId,
  title,
  date,
}: {
  matchId: string;
  title: string | null;
  date: string | null;
}) {
  const when = shortDate(date);
  // The title when known, else the date is the link (P3): never "Match".
  return (
    <span className="block min-w-0 truncate text-xs text-muted-foreground">
      <Link
        href={`/matches/${matchId}`}
        className="underline-offset-2 hover:text-foreground hover:underline"
      >
        {title ?? when ?? "Open the match"}
      </Link>
      {title && when && <> · {when}</>}
    </span>
  );
}

function Best({ label, best }: { label: string; best: BestFigure | null }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      {best ? (
        <>
          <p className="mt-1 font-score text-xl font-semibold tabular-nums text-foreground">
            {best.figure}{" "}
            <span className="text-sm font-normal text-muted-foreground">
              {best.detail}
            </span>
          </p>
          <MatchLine
            matchId={best.matchId}
            title={best.matchTitle}
            date={best.date}
          />
        </>
      ) : (
        <p className="mt-1 font-score text-xl font-semibold tabular-nums text-muted-foreground">
          –
        </p>
      )}
    </div>
  );
}

/**
 * Best batting and bowling and the latest milestones (hundreds, fifties,
 * 3 and 5 wicket hauls), from the records the player page already loaded
 * (no reads). Nothing when there are none yet.
 */
export function PlayerMilestones({
  batting,
  bowling,
}: {
  batting: readonly MilestoneBatting[];
  bowling: readonly MilestoneBowling[];
}) {
  if (batting.length === 0 && bowling.length === 0) return null;
  const m = playerMilestones(batting, bowling);
  const listed = m.milestones.slice(0, MAX_LISTED);
  // The counts of fifties, hundreds and hauls are on the Batting and
  // Bowling cards: here the bests and the latest milestones (P4).
  if (!m.bestBatting && !m.bestBowling && listed.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Milestones"
        description="From completed innings"
        className="pb-3"
      />
      <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {m.bestBatting && <Best label="Best batting" best={m.bestBatting} />}
          {m.bestBowling && <Best label="Best bowling" best={m.bestBowling} />}
        </div>
        {listed.length > 0 && (
          <section aria-labelledby="milestones-recent">
            <h4
              id="milestones-recent"
              className="text-sm font-semibold text-foreground"
            >
              Recent milestones
            </h4>
            <ul className="mt-2 divide-y divide-border">
              {listed.map((item) => (
                <li
                  key={`${item.kind}-${item.matchId}-${item.figure}`}
                  className="flex items-baseline gap-3 py-2"
                >
                  <span className="w-20 shrink-0 text-sm text-muted-foreground">
                    {item.label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-score text-base font-semibold tabular-nums text-foreground">
                      {item.figure}
                    </span>{" "}
                    <span className="text-sm text-muted-foreground">
                      {item.detail}
                    </span>
                    <MatchLine
                      matchId={item.matchId}
                      title={item.matchTitle}
                      date={item.date}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </Card>
  );
}
