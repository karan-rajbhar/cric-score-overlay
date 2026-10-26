import Link from "next/link";
import { Card, CardHeader } from "~/components/ds/card";
import {
  recentBatting,
  recentBowling,
  type FormBatting,
  type FormBowling,
  type FormEntry,
} from "~/lib/recent-form";
import { cn } from "~/lib/utils";

function Strip({ label, entries }: { label: string; entries: FormEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <section aria-label={label}>
      <h4 className="text-sm font-semibold text-foreground">{label}</h4>
      <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
        {entries.map((e, i) => (
          <li key={`${e.matchId}-${i}`} className="min-w-0">
            <Link
              href={`/matches/${e.matchId}`}
              className="block rounded-xl bg-muted p-3 transition-colors hover:bg-accent"
            >
              <span
                className={cn(
                  "block font-score text-xl font-semibold tabular-nums",
                  e.notable ? "text-success" : "text-foreground",
                )}
              >
                {e.figure}
              </span>
              <span className="block text-xs text-muted-foreground">
                {e.detail}
              </span>
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {e.matchTitle ?? "Match"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The last five innings with the bat and the ball, newest first. */
export function RecentForm({
  batting,
  bowling,
}: {
  batting: readonly FormBatting[];
  bowling: readonly FormBowling[];
}) {
  const bat = recentBatting(batting);
  const bowl = recentBowling(bowling);
  if (bat.length === 0 && bowl.length === 0) return null;
  return (
    <Card>
      <CardHeader
        title="Recent form"
        description="Latest completed innings, newest first. * is not out."
        className="pb-3"
      />
      <div className="space-y-4 px-4 pb-4 sm:px-5 sm:pb-5">
        <Strip label="Batting" entries={bat} />
        <Strip label="Bowling" entries={bowl} />
      </div>
    </Card>
  );
}
