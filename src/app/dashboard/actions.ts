"use server";

import { createServerClient } from "~/lib/firebase/server";
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
    hasCoScorer:
      matchRows.some((m) => (m.match_admins ?? []).length > 0) ||
      (invites.data ?? []).length > 0,
  };
}
