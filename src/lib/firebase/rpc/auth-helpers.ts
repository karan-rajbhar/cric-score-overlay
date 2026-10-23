/**
 * Permission predicates, ported from the `is_*` SQL helper functions.
 * They run on any DataSource (server or browser).
 */

import type { DataSource } from "../datasource";
import type { ClubsRow, MatchesRow, TournamentsRow } from "../types";

export async function isClubAdmin(
  ds: DataSource,
  clubId: string | null | undefined,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!clubId || !userId) return false;
  const club = (await ds.getById(
    "clubs",
    clubId,
  )) as unknown as ClubsRow | null;
  if (club?.owner_id === userId) return true;
  const memberships = await ds.query("club_memberships", [
    { field: "club_id", op: "==", value: clubId },
    { field: "user_id", op: "==", value: userId },
  ]);
  return memberships.some(
    (m) => (m.role === "owner" || m.role === "admin") && m.status === "active",
  );
}

export async function isClubMember(
  ds: DataSource,
  clubId: string | null | undefined,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!clubId || !userId) return false;
  const club = (await ds.getById(
    "clubs",
    clubId,
  )) as unknown as ClubsRow | null;
  if (club?.owner_id === userId) return true;
  const memberships = await ds.query("club_memberships", [
    { field: "club_id", op: "==", value: clubId },
    { field: "user_id", op: "==", value: userId },
  ]);
  return memberships.some((m) => m.status === "active");
}

export async function isTeamMember(
  ds: DataSource,
  teamId: string | null | undefined,
  userId: string | null | undefined,
): Promise<boolean> {
  if (!teamId || !userId) return false;
  const rows = await ds.query("team_players", [
    { field: "team_id", op: "==", value: teamId },
    { field: "user_id", op: "==", value: userId },
  ]);
  return rows.length > 0;
}

/**
 * Who may delete a match: stricter than scoring. The match creator, admins
 * of the match's club, and for tournament matches the tournament creator
 * and admins of the tournament's club. Co-scorers listed in `match_admins`
 * may score but not delete.
 */
export async function canDeleteMatch(
  ds: DataSource,
  matchId: string | null | undefined,
  userId: string | null | undefined,
  loaded?: Pick<MatchesRow, "created_by" | "club_id" | "tournament_id"> | null,
): Promise<boolean> {
  if (!matchId || !userId) return false;
  const match =
    loaded ??
    ((await ds.getById("matches", matchId)) as unknown as MatchesRow | null);
  if (!match) return false;
  if (match.created_by === userId) return true;
  if (match.club_id && (await isClubAdmin(ds, match.club_id, userId)))
    return true;
  if (match.tournament_id) {
    const tournament = (await ds.getById(
      "tournaments",
      match.tournament_id,
    )) as unknown as TournamentsRow | null;
    if (tournament?.created_by === userId) return true;
    if (
      tournament?.club_id &&
      tournament.club_id !== match.club_id &&
      (await isClubAdmin(ds, tournament.club_id, userId))
    )
      return true;
  }
  return false;
}

export async function isMatchAdmin(
  ds: DataSource,
  matchId: string | null | undefined,
  userId: string | null | undefined,
  loaded?: Pick<
    MatchesRow,
    "created_by" | "match_admins" | "club_id" | "tournament_id"
  > | null,
): Promise<boolean> {
  if (!matchId || !userId) return false;
  const match =
    loaded ??
    ((await ds.getById("matches", matchId)) as unknown as MatchesRow | null);
  if (!match) return false;
  if (match.created_by === userId) return true;
  if ((match.match_admins ?? []).includes(userId)) return true;
  if (match.club_id && (await isClubAdmin(ds, match.club_id, userId)))
    return true;
  if (match.tournament_id) {
    const tournament = (await ds.getById(
      "tournaments",
      match.tournament_id,
    )) as unknown as TournamentsRow | null;
    if (tournament?.created_by === userId) return true;
    if (
      tournament?.club_id &&
      (await isClubAdmin(ds, tournament.club_id, userId))
    )
      return true;
  }
  return false;
}

/**
 * Who may drive a match's overlay graphics (control room, producer
 * commands, remote tokens, putting it on a stream channel): its admins
 * ({@link isMatchAdmin}) plus its streamers (`match_streamers`). Streamers
 * may not score: `isMatchAdmin` stays false for them.
 */
export async function canProduceOverlay(
  ds: DataSource,
  matchId: string | null | undefined,
  userId: string | null | undefined,
  loaded?: MatchesRow | null,
): Promise<boolean> {
  if (!matchId || !userId) return false;
  const match =
    loaded ??
    ((await ds.getById("matches", matchId)) as unknown as MatchesRow | null);
  if (!match) return false;
  if ((match.match_streamers ?? []).includes(userId)) return true;
  return isMatchAdmin(ds, matchId, userId, match);
}
