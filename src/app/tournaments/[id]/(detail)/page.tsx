import { notFound } from "next/navigation";
import { LeaderboardView } from "~/components/leaderboard/leaderboard-view";
import {
  loadScopeLeaderboard,
  type ScopeMatch,
} from "~/lib/firebase/leaderboards";
import { createServerClient } from "~/lib/firebase/server";
import {
  isTournamentId,
  loadTournament,
  TOURNAMENT_MATCH_COLUMNS,
} from "../tournament-view";

export const dynamic = "force-dynamic";

/**
 * The tournament's Stats tab, the one that costs reads to fill: its stored
 * leaderboard (8 shards) plus any innings in play. This page is what
 * re-renders when `?tab=` changes, so only opening Stats reads them. See
 * `OnDemandTabs`.
 */
export default async function TournamentTabPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  if ((await searchParams)?.tab !== "analysis") return null;
  if (!isTournamentId(id)) notFound();
  const { data: tournament } = await loadTournament(id);
  if (!tournament) notFound();
  const db = await createServerClient();
  const { data: live } = await db
    .from("matches")
    .select(TOURNAMENT_MATCH_COLUMNS)
    .eq("tournament_id", id)
    .eq("status", "live");
  const data = await loadScopeLeaderboard(
    db,
    "tournament",
    id,
    (live ?? []) as unknown as ScopeMatch[],
  );
  return (
    <div className="space-y-6">
      <LeaderboardView
        // The tab is Stats: the section says what it holds (T9).
        title="Leading players"
        subtitle={`Run scorers, wicket takers and all-rounders in ${tournament.name}`}
        data={data}
        showHighlights={true}
      />
    </div>
  );
}
