"use server";

import { createServerClient } from "~/lib/firebase/server";
import { attachMatchTeams } from "~/lib/firebase/team-snapshot";
import type { OnboardingProgress } from "./onboarding";

/** Teams / matches checked per step (a new user has none or a few). */
const SAMPLE = 5;

/**
 * Progress of the dashboard's "Get started" checklist for the signed-in
 * user: three small limited equality queries (their teams, their matches,
 * one sent invite), at most 11 documents. The dashboard calls it only
 * while the checklist is visible (not dismissed, not yet complete).
 */
export async function getOnboardingProgress(): Promise<OnboardingProgress | null> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const [teams, matches, invites] = await Promise.all([
    db
      .from("teams")
      .select("id, roster")
      .eq("created_by", user.id)
      .limit(SAMPLE),
    db
      .from("matches")
      .select("id, match_admins")
      .eq("created_by", user.id)
      .limit(SAMPLE),
    db.from("invitations").select("id").eq("invited_by", user.id).limit(1),
  ]);
  const teamRows = (teams.data ?? []) as {
    id: string;
    roster?: unknown[] | null;
  }[];
  const matchRows = (matches.data ?? []) as {
    id: string;
    match_admins?: string[] | null;
  }[];

  return {
    teamId: teamRows[0]?.id ?? null,
    // The creator is added to their own team; a second entry is a player.
    hasPlayers: teamRows.some((t) => (t.roster?.length ?? 0) > 1),
    matchId: matchRows[0]?.id ?? null,
    // The creator is one of a match's scorers; a co-scorer is anyone else.
    hasCoScorer:
      matchRows.some((m) =>
        (m.match_admins ?? []).some((id) => id !== user.id),
      ) ||
      (invites.data ?? []).length > 0,
  };
}

/** Rows per query, and in the result. */
const MY_UPCOMING = 6;

/**
 * Upcoming (scheduled) matches the signed-in user scores or plays in,
 * soonest first: the ones they score (`match_admins`, which lists the
 * creator), the ones they created before that, and those of the teams in
 * whose squads they are. Indexed queries of at most 6 matches each (see
 * firestore.indexes.json); null when signed out.
 */
export async function getMyUpcomingMatches(): Promise<Record<
  string,
  unknown
>[] | null> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;

  const scheduled = () =>
    db
      .from("matches")
      .select("*")
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true, nullsFirst: true })
      .limit(MY_UPCOMING);

  const [scoring, created, squads] = await Promise.all([
    scheduled().contains("match_admins", [user.id]),
    scheduled().eq("created_by", user.id),
    db.from("team_players").select("team_id").eq("user_id", user.id),
  ]);
  // One `in` query per side covers up to 30 teams.
  const teamIds = [
    ...new Set(
      ((squads.data ?? []) as { team_id: string | null }[])
        .map((r) => r.team_id)
        .filter((id): id is string => Boolean(id)),
    ),
  ].slice(0, 30);
  const [home, away] = teamIds.length
    ? await Promise.all([
        scheduled().in("team1_id", teamIds),
        scheduled().in("team2_id", teamIds),
      ])
    : [{ data: [] }, { data: [] }];

  const byId = new Map<string, Record<string, unknown>>();
  for (const res of [scoring, created, home, away]) {
    for (const m of (res.data ?? []) as Record<string, unknown>[]) {
      byId.set(String(m.id), m);
    }
  }
  const mine = [...byId.values()]
    .sort((a, b) =>
      String(a.scheduled_at ?? "").localeCompare(String(b.scheduled_at ?? "")),
    )
    .slice(0, MY_UPCOMING);
  return attachMatchTeams(db, mine);
}
