import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ScreenBar } from "~/components/ds/screen";
import { MatchPlayersEditor } from "~/components/matches/match-players-editor";
import { getMatch } from "~/app/matches/queries";
import { createServerClient } from "~/lib/firebase/server";
import type { Match } from "~/lib/match-types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Players",
  robots: { index: false, follow: false },
};

/** Whether the signed-in user (if any) scores this match. */
async function scores(matchId: string): Promise<boolean> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return false;
    const { data } = await db.rpc<boolean>("is_match_admin", {
      p_match_id: matchId,
    });
    return data === true;
  } catch {
    return false;
  }
}

/**
 * A match's players, for its scorers to replace one recorded by mistake,
 * during the match or after it. `?from=score`: opened from the scoring
 * screen, so Back returns there.
 */
export default async function MatchPlayersPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const [{ id }, { from }] = await Promise.all([params, searchParams]);
  const [{ data }, scorer] = await Promise.all([getMatch(id), scores(id)]);
  const match = (data as Match | null) ?? null;
  if (!match) notFound();
  const back = from === "score" ? `/matches/${id}/score` : `/matches/${id}`;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ScreenBar
        title="Players"
        backHref={back}
        backLabel={from === "score" ? "Back to scoring" : "Back to the match"}
      />
      <p className="text-balance text-center text-sm font-medium text-foreground">
        {match.title}
      </p>
      {scorer ? (
        <MatchPlayersEditor match={match} />
      ) : (
        <p className="rounded-xl bg-card p-5 text-center text-sm text-muted-foreground shadow-soft">
          Only this match&apos;s scorers can replace a player.
        </p>
      )}
    </div>
  );
}
