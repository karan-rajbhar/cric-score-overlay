/**
 * Profile / username routines, ported from the SQL functions
 * `generate_unique_username`, `check_username_available`,
 * `update_own_username`, `ensure_own_profile` and `create_team_player`.
 */

import type { AppUser } from "../auth-types";
import type { DataSource, Doc } from "../datasource";
import { DbQueryError, newId } from "../query-builder";
import { USER_REFERENCES, TABLE_DEFAULTS, TABLE_COLUMNS } from "../schema";
import type { MatchesRow, TeamsRow, UsersRow } from "../types";
import {
  getUserPrivate,
  moveUserPrivate,
  upsertUserPrivate,
  userIdsByEmail,
  userIdsByPhone,
} from "../user-private";
import { remapScorecardUserId } from "../scorecard-sync";
import { isClubAdmin, isMatchAdmin } from "./auth-helpers";

export const RESERVED_USERNAMES = new Set([
  "about",
  "account",
  "admin",
  "administrator",
  "api",
  "app",
  "auth",
  "billing",
  "blog",
  "bot",
  "broadcast",
  "club",
  "clubs",
  "contact",
  "cricscore",
  "dashboard",
  "dev",
  "developer",
  "docs",
  "edit",
  "explore",
  "faq",
  "graphql",
  "help",
  "home",
  "inbox",
  "info",
  "jobs",
  "join",
  "legal",
  "live",
  "login",
  "logout",
  "match",
  "matches",
  "media",
  "message",
  "moderator",
  "news",
  "notifications",
  "official",
  "overlay",
  "overview",
  "player",
  "players",
  "privacy",
  "profile",
  "root",
  "score",
  "search",
  "security",
  "settings",
  "signin",
  "signup",
  "squad",
  "squads",
  "status",
  "stumps",
  "super",
  "support",
  "system",
  "team",
  "teams",
  "terms",
  "tournament",
  "tournaments",
  "user",
  "users",
  "verify",
]);

const USERNAME_RE = /^[a-z0-9][a-z0-9_]{1,28}[a-z0-9]$/;

async function usernameTaken(
  ds: DataSource,
  candidate: string,
  excludeUserId?: string | null,
) {
  const rows = await ds.query("users", [
    { field: "username", op: "==", value: candidate },
  ]);
  return rows.some((r) => r.id !== excludeUserId);
}

export async function generateUniqueUsername(
  ds: DataSource,
  fullName: string | null | undefined,
  email?: string | null,
  userId?: string | null,
): Promise<string> {
  let base: string | null = null;
  if (
    email &&
    !email.endsWith("@players.local") &&
    !email.endsWith("@example.com")
  ) {
    base = email.split("@")[0] ?? null;
  }
  if (!base || base.trim().length === 0) {
    base = fullName ?? "player";
  }

  let clean = base.toLowerCase();
  clean = clean.replace(/[^a-z0-9_]+/g, "_");
  clean = clean.replace(/^_+|_+$/g, "");
  clean = clean.replace(/_{2,}/g, "_");

  if (clean.length === 0) clean = "player";
  else if (clean.length < 3) clean = `user_${clean}`;

  if (clean.startsWith("_")) clean = `u${clean}`;
  if (clean.endsWith("_")) clean = `${clean}0`;

  if (clean.length > 22) {
    clean = clean.slice(0, 22).replace(/_+$/, "");
    if (clean.length < 3) clean = "player";
  }

  let candidate = clean;
  let counter = 0;
  while (
    RESERVED_USERNAMES.has(candidate) ||
    (await usernameTaken(ds, candidate, userId))
  ) {
    counter += 1;
    candidate = `${clean}_${counter}`;
    if (candidate.length > 30) {
      candidate = `${clean.slice(0, 29 - String(counter).length)}_${counter}`;
    }
  }
  return candidate;
}

export async function checkUsernameAvailable(
  ds: DataSource,
  username: string | null | undefined,
  targetUserId: string | null | undefined,
): Promise<{ available: boolean; error?: string; username?: string }> {
  const norm = (username ?? "").trim().toLowerCase();
  if (norm.length < 3) {
    return {
      available: false,
      error: "Username must be at least 3 characters",
    };
  }
  if (norm.length > 30) {
    return { available: false, error: "Username cannot exceed 30 characters" };
  }
  if (!USERNAME_RE.test(norm)) {
    return {
      available: false,
      error:
        "Username can only contain letters, numbers, and underscores, and cannot start or end with an underscore",
    };
  }
  if (RESERVED_USERNAMES.has(norm)) {
    return { available: false, error: "This username is reserved" };
  }
  if (await usernameTaken(ds, norm, targetUserId ?? null)) {
    return { available: false, error: "This username is already taken" };
  }
  return { available: true, username: norm };
}

export async function updateOwnUsername(
  ds: DataSource,
  uid: string | null,
  username: string,
): Promise<{ ok: boolean; error?: string; username?: string }> {
  if (!uid) throw new DbQueryError("not_authenticated", "42501");
  const norm = (username ?? "").trim().toLowerCase();
  const check = await checkUsernameAvailable(ds, norm, uid);
  if (!check.available) return { ok: false, error: check.error };
  await ds.update("users", uid, {
    username: norm,
    updated_at: new Date().toISOString(),
  });
  return { ok: true, username: norm };
}

/**
 * Rewrites every reference to `oldId` so an existing profile (seeded,
 * invited or created inline) is owned by the authenticated account.
 */
export async function remapUserId(
  ds: DataSource,
  oldId: string,
  newId: string,
): Promise<void> {
  if (oldId === newId) return;
  // Nested ids first: it finds the matches through the old team_players.
  await remapScorecardUserId(ds, oldId, newId);
  for (const ref of USER_REFERENCES) {
    if (ref.array) {
      const rows = await ds.query(ref.table, [
        { field: ref.column, op: "array-contains", value: oldId },
      ]);
      for (const row of rows) {
        const arr = row[ref.column];
        if (Array.isArray(arr) && arr.includes(oldId)) {
          await ds.update(ref.table, row.id, {
            [ref.column]: arr.map((v) => (v === oldId ? newId : v)),
          });
        }
      }
      continue;
    }
    const rows = await ds.query(ref.table, [
      { field: ref.column, op: "==", value: oldId },
    ]);
    for (const row of rows) {
      await ds.update(ref.table, row.id, { [ref.column]: newId });
    }
  }
  const old = await ds.getById("users", oldId);
  if (old) {
    const copy: Record<string, unknown> = { ...old };
    delete copy.id;
    await ds.insert("users", [{ ...copy, id: newId }]);
    await ds.delete("users", oldId);
  }
  await moveUserPrivate(ds, oldId, newId);
}

function buildUserDoc(values: Partial<UsersRow> & { id: string }): Doc {
  const now = new Date().toISOString();
  const doc: Doc = { id: values.id };
  const defaults = TABLE_DEFAULTS.users ?? {};
  for (const col of TABLE_COLUMNS.users) {
    if (col === "id") continue;
    if (
      col in values &&
      (values as Record<string, unknown>)[col] !== undefined
    ) {
      doc[col] = (values as Record<string, unknown>)[col];
    } else if (col === "created_at" || col === "updated_at") {
      doc[col] = now;
    } else if (col in defaults) {
      doc[col] = defaults[col];
    } else {
      doc[col] = null;
    }
  }
  return doc;
}

/** Profile fields to patch, or null when nothing changed (saves a write). */
function profilePatch(
  row: UsersRow,
  values: { fullName: string; avatarUrl: string | null; username: string },
): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};
  if (
    (!row.full_name || row.full_name === "Player") &&
    values.fullName !== row.full_name
  ) {
    patch.full_name = values.fullName;
  }
  if (values.avatarUrl && values.avatarUrl !== row.avatar_url) {
    patch.avatar_url = values.avatarUrl;
  }
  if (values.username !== row.username) patch.username = values.username;
  return Object.keys(patch).length ? patch : null;
}

/**
 * Guarantees a `users` profile (and its `users_private` contact details)
 * exists for the signed-in account, re-mapping a pre-existing profile with
 * the same email/phone onto the auth uid. Runs before most mutations, so
 * it only writes when something actually changed.
 */
export async function ensureOwnProfile(
  ds: DataSource,
  user: AppUser | null,
  /** The account's `users` document, when the caller has just read it. */
  known?: UsersRow | null,
): Promise<{
  ok: boolean;
  user_id: string;
  username: string | null;
  action: string;
}> {
  if (!user?.id) throw new DbQueryError("not_authenticated", "42501");
  const uid = user.id;
  const meta = user.user_metadata ?? {};
  let email = user.email ? user.email.toLowerCase() : null;
  const phone = user.phone || null;
  const fullName =
    (typeof meta.full_name === "string" && meta.full_name) ||
    (typeof meta.name === "string" && meta.name) ||
    email ||
    phone ||
    "Player";
  const avatarUrl =
    typeof meta.avatar_url === "string" && meta.avatar_url
      ? meta.avatar_url
      : null;
  const now = new Date().toISOString();
  // `undefined` keeps the stored value when the token has none.
  const contact = { email: email ?? undefined, phone: phone ?? undefined };

  // A: profile already keyed by the auth uid.
  const [existing, existingPrivate] = (await Promise.all([
    known === undefined ? ds.getById("users", uid) : known,
    getUserPrivate(ds, uid),
  ])) as [UsersRow | null, Awaited<ReturnType<typeof getUserPrivate>>];
  if (existing) {
    const username =
      existing.username ??
      (await generateUniqueUsername(ds, fullName, email, uid));
    const patch = profilePatch(existing, { fullName, avatarUrl, username });
    if (patch) await ds.update("users", uid, { ...patch, updated_at: now });
    await upsertUserPrivate(ds, uid, contact, existingPrivate);
    return { ok: true, user_id: uid, username, action: "updated" };
  }

  // B: profile exists under a different id with the same email / phone.
  const firstProfile = async (ids: string[]) => {
    for (const id of ids) {
      if (id === uid) continue;
      const row = (await ds.getById("users", id)) as unknown as UsersRow | null;
      if (row) return row;
    }
    return null;
  };
  let match = await firstProfile(await userIdsByEmail(ds, email));
  if (!match && phone)
    match = await firstProfile(await userIdsByPhone(ds, phone));
  if (match) {
    const username =
      match.username ??
      (await generateUniqueUsername(ds, fullName, email, uid));
    const patch = profilePatch(match, { fullName, avatarUrl, username });
    // A squad player claimed by the person signing in has an account now.
    if (match.is_placeholder) {
      await ds.update("users", match.id, {
        ...patch,
        is_placeholder: false,
        updated_at: now,
      });
    } else if (patch) {
      await ds.update("users", match.id, { ...patch, updated_at: now });
    }
    await upsertUserPrivate(ds, match.id, contact);
    await remapUserId(ds, match.id, uid);
    return { ok: true, user_id: uid, username, action: "remapped" };
  }

  // C: brand new profile.
  if (!email && !phone) {
    email = `player-${uid.slice(0, 8)}@players.local`;
  }
  const username = await generateUniqueUsername(ds, fullName, email, uid);
  await ds.insert("users", [
    buildUserDoc({
      id: uid,
      full_name: fullName,
      avatar_url: avatarUrl,
      username,
    }),
  ]);
  await upsertUserPrivate(ds, uid, { email, phone }, existingPrivate);
  return { ok: true, user_id: uid, username, action: "created" };
}

/** Whether `userId` scores `matchId`, an unfinished match `teamId` plays in. */
async function scoresMatchOf(
  ds: DataSource,
  matchId: string | null | undefined,
  teamId: string,
  userId: string,
): Promise<boolean> {
  if (!matchId) return false;
  const match = (await ds.getById(
    "matches",
    matchId,
  )) as unknown as MatchesRow | null;
  if (!match) return false;
  if (match.team1_id !== teamId && match.team2_id !== teamId) return false;
  if (match.status === "completed" || match.status === "abandoned") return false;
  return isMatchAdmin(ds, matchId, userId);
}

/**
 * Who may add players to a team: its creator, captain or vice-captain, a
 * club admin, or (with `matchId`) a scorer of an unfinished match it plays.
 */
async function assertMayAddPlayers(
  ds: DataSource,
  callerId: string,
  teamId: string,
  matchId: string | null | undefined,
): Promise<void> {
  const team = (await ds.getById(
    "teams",
    teamId,
  )) as unknown as TeamsRow | null;
  if (!team) throw new DbQueryError("team_not_found", "22000");
  const authorised =
    team.created_by === callerId ||
    team.captain_id === callerId ||
    team.vice_captain_id === callerId ||
    (await isClubAdmin(ds, team.club_id, callerId)) ||
    (await scoresMatchOf(ds, matchId, teamId, callerId));
  if (!authorised) {
    throw new DbQueryError(
      "not_authorized: Not authorized to add players to this team",
      "42501",
    );
  }
}

export async function createTeamPlayer(
  ds: DataSource,
  callerId: string | null,
  teamId: string,
  fullName: string,
  jerseyNumber?: number | null,
  /**
   * The match the player is added for: its scorers (including invited
   * co-scorers, `match_admins`) may add players to either of its teams
   * until it is over.
   */
  matchId?: string | null,
): Promise<{
  user_id: string;
  full_name: string;
  jersey_number: number | null;
  username: string;
}> {
  if (!callerId) throw new DbQueryError("Authentication required", "42501");
  const name = (fullName ?? "").trim();
  if (!name) throw new DbQueryError("Player name is required", "22023");

  await assertMayAddPlayers(ds, callerId, teamId, matchId);

  const slug = name.toLowerCase().replace(/[^a-z0-9]/g, "") || "player";
  const username = await generateUniqueUsername(ds, name, null, null);
  const userId = newId();
  const now = new Date().toISOString();
  await ds.insert("users", [
    buildUserDoc({
      id: userId,
      full_name: name,
      username,
      is_placeholder: true,
    }),
  ]);
  await upsertUserPrivate(
    ds,
    userId,
    { email: `player.${slug}.${userId.slice(0, 8)}@players.local` },
    null,
  );
  await ds.insert("team_players", [
    {
      id: newId(),
      team_id: teamId,
      user_id: userId,
      jersey_number: jerseyNumber ?? null,
      batting_order: null,
      is_playing_xi: true,
      role_in_team: null,
      added_by: callerId,
      created_at: now,
    },
  ]);
  return {
    user_id: userId,
    full_name: name,
    jersey_number: jerseyNumber ?? null,
    username,
  };
}

/**
 * Adds a registered player to a team's squad: the scorer picks someone who
 * already has a profile instead of creating a second one. The same people
 * may do it as `createTeamPlayer`.
 */
export async function addTeamPlayer(
  ds: DataSource,
  callerId: string | null,
  teamId: string,
  userId: string,
  matchId?: string | null,
): Promise<{ user_id: string; full_name: string }> {
  if (!callerId) throw new DbQueryError("Authentication required", "42501");
  await assertMayAddPlayers(ds, callerId, teamId, matchId);

  const user = (await ds.getById(
    "users",
    userId,
  )) as unknown as UsersRow | null;
  if (!user) throw new DbQueryError("player_not_found", "22000");
  const already = await ds.query(
    "team_players",
    [
      { field: "team_id", op: "==", value: teamId },
      { field: "user_id", op: "==", value: userId },
    ],
    { limit: 1 },
  );
  if (already.length === 0) {
    await ds.insert("team_players", [
      {
        id: newId(),
        team_id: teamId,
        user_id: userId,
        jersey_number: null,
        batting_order: null,
        is_playing_xi: true,
        role_in_team: null,
        added_by: callerId,
        created_at: new Date().toISOString(),
      },
    ]);
  }
  return { user_id: userId, full_name: user.full_name ?? "Player" };
}
