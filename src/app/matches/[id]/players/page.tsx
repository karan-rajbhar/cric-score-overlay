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
 * during the match or after it. Back returns where they came from (the
 * scoring screen or the match).
 */
export default async function MatchPlayersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [{ data }, scorer] = await Promise.all([getMatch(id), scores(id)]);
  const match = (data as Match | null) ?? null;
  if (!match) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <ScreenBar
        title="Players"
        backHref={`/matches/${id}`}
        backLabel="Back to the match"
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
