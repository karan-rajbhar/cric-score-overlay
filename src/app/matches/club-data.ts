/**
 * What the "Add to club" dialog reads (browser Firestore client): the
 * clubs the user belongs to, and its first answer to "whose stats count".
 */

import type { QueryBuilder } from "~/lib/firebase/query-builder";
import type { ClubSide, SourceName } from "~/lib/firebase/types";
import { hasClubRecords } from "./create/wizard-data";

export interface MyClub {
  id: string;
  name: string;
  /** "admin": owner or admin; "member": any other active member. */
  role: "admin" | "member";
}

interface ClubsClient {
  from<T extends SourceName>(table: T): QueryBuilder<T>;
}

type Row = Record<string, unknown>;

/** The user's clubs, by name (a few reads: memberships, owned, names). */
export async function fetchMyClubs(
  db: ClubsClient,
  userId: string,
): Promise<MyClub[]> {
  const [{ data: memberships }, { data: owned }] = await Promise.all([
    db
      .from("club_memberships")
      .select("club_id, role")
      .eq("user_id", userId)
      .eq("status", "active"),
    db.from("clubs").select("id, name").eq("owner_id", userId),
  ]);
  const roles = new Map<string, MyClub["role"]>();
  for (const m of (memberships ?? []) as Row[]) {
    if (typeof m.club_id !== "string") continue;
    const admin = m.role === "owner" || m.role === "admin";
    if (admin || !roles.has(m.club_id)) {
      roles.set(m.club_id, admin ? "admin" : "member");
    }
  }
  const names = new Map<string, string>();
  for (const c of (owned ?? []) as Row[]) {
    roles.set(String(c.id), "admin");
    names.set(String(c.id), String(c.name));
  }
  const missing = [...roles.keys()].filter((id) => !names.has(id));
  if (missing.length) {
    const { data } = await db.from("clubs").select("id, name").in("id", missing);
    for (const c of (data ?? []) as Row[]) names.set(String(c.id), String(c.name));
  }
  return [...roles]
    .filter(([id]) => names.has(id))
    .map(([id, role]) => ({ id, name: names.get(id)!, role }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Clubs a finished match is checked against, at most (1 read each). */
const SUGGEST_CLUBS = 3;

/**
 * The first of `clubs` whose matches any of `userIds` has played in (a
 * finished match not in a club yet probably belongs there), or null.
 */
export async function clubWithRecords(
  db: ClubsClient,
  clubs: readonly MyClub[],
  userIds: readonly string[],
): Promise<MyClub | null> {
  for (const club of clubs.slice(0, SUGGEST_CLUBS)) {
    if (await hasClubRecords(db, club.id, userIds)) return club;
  }
  return null;
}

/**
 * The clubs to offer for a match: the user's own when they may change its
 * club (`mayChange`: the right to delete it, `canSetMatchClub`), none
 * otherwise (running a club gives no rights over a match outside it).
 */
export function clubsForMatch(
  clubs: readonly MyClub[],
  mayChange: boolean,
): MyClub[] {
  return mayChange ? [...clubs] : [];
}

/**
 * Whether the user may change a match's club: not a tournament match (it
 * counts for the tournament's club), the club it is in (if any) is one
 * they may take it out of, and there is a club to choose or leave.
 */
export function canChangeMatchClub(
  match: { club_id?: string | null; tournament_id?: string | null },
  choosable: readonly MyClub[],
): boolean {
  if (match.tournament_id) return false;
  if (match.club_id) return choosable.some((c) => c.id === match.club_id);
  return choosable.length > 0;
}

/**
 * Whether to offer "Add to club" at all: whenever the user may, and to
 * whoever may change the match's club (`mayChange`) when it is in none yet
 * and they belong to no club (the dialog then says how to join one), so
 * the action is never missing without a reason.
 */
export function offerAddToClub(
  match: { club_id?: string | null; tournament_id?: string | null },
  choosable: readonly MyClub[],
  mayChange: boolean,
): boolean {
  if (canChangeMatchClub(match, choosable)) return true;
  return mayChange && !match.club_id && !match.tournament_id;
}

/**
 * The first answer to "whose stats count for the club", from whether each
 * team's players have played for it before (`hasClubRecords`): the one
 * side that has, else both. Null until both are known.
 */
export function guessClubSide(
  team1HasRecords: boolean | undefined,
  team2HasRecords: boolean | undefined,
): ClubSide | null {
  if (team1HasRecords === undefined || team2HasRecords === undefined) {
    return null;
  }
  if (team1HasRecords && !team2HasRecords) return "team1";
  if (team2HasRecords && !team1HasRecords) return "team2";
  return "both";
}
