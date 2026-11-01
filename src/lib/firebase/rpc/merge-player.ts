/**
 * Cleaning up a duplicate player from the app.
 *
 * `mergePlayer` turns a placeholder profile into another player: match by
 * match it runs the scoring engine's own move (`movePlayer`, the same as
 * Replace a player, so scorecards, ball logs, records, statistics, live
 * documents and archives all follow), then repoints the profile's squads and
 * memberships and removes it. It reads only the documents of those matches,
 * unlike `scripts/lib/merge-players.mjs`, which reads every collection and
 * remains the tool for bulk clean-ups.
 *
 * It cannot be undone, so it refuses what it cannot be sure of: an account
 * or an invited player (only a placeholder is merged away), and two players
 * who played together (they are different people). Each match is its own
 * transaction, so a batch that fails leaves every match whole, and running
 * it again carries on.
 */

import { DbQueryError } from "../query-builder";
import { USER_REFERENCES } from "../schema";
import { CAREER_COLLECTION } from "../stats.mjs";
import { PLAYER_MATCHES_COLLECTION } from "../scorecard";
import type { DataSource } from "../datasource";
import type { UsersRow } from "../types";
import { getUserPrivate, USERS_PRIVATE } from "../user-private";
import { assertMayAddPlayers, rewriteUserReferences } from "./profiles";
import { movePlayer, type ScoringContext } from "./scoring";

/** Matches moved per call: the browser calls again until none are left. */
export const MERGE_BATCH = 10;

const PLACEHOLDER_EMAIL_SUFFIX = "@players.local";

async function placeholderOf(ds: DataSource, userId: string): Promise<UsersRow> {
  const user = (await ds.getById("users", userId)) as unknown as UsersRow | null;
  if (!user) throw new DbQueryError("player_not_found", "22000");
  const email = (await getUserPrivate(ds, userId))?.email ?? "";
  if (user.is_placeholder !== true || (email && !email.endsWith(PLACEHOLDER_EMAIL_SUFFIX))) {
    throw new DbQueryError("player_has_account", "22000");
  }
  return user;
}

async function squadRow(ds: DataSource, teamId: string, userId: string) {
  const rows = await ds.query(
    "team_players",
    [
      { field: "team_id", op: "==", value: teamId },
      { field: "user_id", op: "==", value: userId },
    ],
    { limit: 1 },
  );
  return rows[0] ?? null;
}

/** The matches a player has records in. */
async function recordedMatches(ds: DataSource, userId: string): Promise<string[]> {
  const rows = await ds.query(PLAYER_MATCHES_COLLECTION, [
    { field: "user_id", op: "==", value: userId },
  ]);
  return Array.from(new Set(rows.map((r) => String(r.match_id))));
}

/**
 * Live matches of the player's teams: an innings in play has no records
 * yet, so `recordedMatches` cannot see them.
 */
async function liveMatchesOfTeams(
  ds: DataSource,
  userId: string,
): Promise<string[]> {
  const rows = await ds.query("team_players", [
    { field: "user_id", op: "==", value: userId },
  ]);
  const teams = Array.from(new Set(rows.map((r) => String(r.team_id))));
  const ids = new Set<string>();
  for (let i = 0; i < teams.length; i += 10) {
    const group = teams.slice(i, i + 10);
    for (const field of ["team1_id", "team2_id"]) {
      const matches = await ds.query("matches", [
        { field, op: "in", value: group },
        { field: "status", op: "==", value: "live" },
      ]);
      for (const m of matches) ids.add(m.id);
    }
  }
  return [...ids];
}

interface MergeArgs {
  teamId: string;
  from: string;
  to: string;
}

async function checkMerge(
  ds: DataSource,
  uid: string | null,
  { teamId, from, to }: MergeArgs,
) {
  if (!uid) throw new DbQueryError("Authentication required", "42501");
  if (!from || !to || from === to) {
    throw new DbQueryError("invalid_input", "22000");
  }
  await assertMayAddPlayers(ds, uid, teamId, null);
  const duplicate = await placeholderOf(ds, from);
  if (!(await squadRow(ds, teamId, from))) {
    throw new DbQueryError("player_not_in_team", "22000");
  }
  const keeper = await ds.getById("users", to);
  if (!keeper) throw new DbQueryError("player_not_found", "22000");
  const [fromMatches, toMatches] = await Promise.all([
    recordedMatches(ds, from),
    recordedMatches(ds, to),
  ]);
  const theirs = new Set(toMatches);
  return {
    duplicate,
    fromMatches,
    together: fromMatches.filter((id) => theirs.has(id)).length,
  };
}

/** What a merge would do, before anyone confirms it. */
export async function previewPlayerMerge(
  ds: DataSource,
  uid: string | null,
  args: MergeArgs,
): Promise<{ matches: number; together: number }> {
  const { fromMatches, together } = await checkMerge(ds, uid, args);
  return { matches: fromMatches.length, together };
}

/**
 * One batch of the merge. `done` false: call again. Live matches come first
 * every time; a match the player has no part in is left alone.
 */
export async function mergePlayer(
  ctx: ScoringContext,
  args: MergeArgs,
): Promise<{ moved: number; remaining: number; done: boolean }> {
  const { from, to } = args;
  const { fromMatches, together } = await checkMerge(ctx.ds, ctx.uid, args);
  if (together > 0) {
    throw new DbQueryError("players_played_together", "22000");
  }
  for (const matchId of await liveMatchesOfTeams(ctx.ds, from)) {
    await movePlayer(ctx, matchId, from, to, { asScorer: false });
  }
  const batch = fromMatches.slice(0, MERGE_BATCH);
  for (const matchId of batch) {
    await movePlayer(ctx, matchId, from, to, { asScorer: false });
  }
  const remaining = fromMatches.length - batch.length;
  if (remaining > 0) return { moved: batch.length, remaining, done: false };

  await rewriteUserReferences(ctx.ds, from, to, { merge: true });
  await removeProfile(ctx.ds, from);
  return { moved: batch.length, remaining: 0, done: true };
}

async function removeProfile(ds: DataSource, userId: string): Promise<void> {
  await ds.delete(USERS_PRIVATE, userId);
  await ds.delete(CAREER_COLLECTION, userId);
  await ds.delete("users", userId);
}

/**
 * After Replace: can the player replaced simply go? `removable` when they
 * never signed in and have no other match; otherwise `otherMatches` says
 * what a merge would have to move.
 */
export async function playerLeftover(
  ds: DataSource,
  userId: string,
): Promise<{ placeholder: boolean; otherMatches: number }> {
  let placeholder = true;
  try {
    await placeholderOf(ds, userId);
  } catch {
    placeholder = false;
  }
  const otherMatches = (await recordedMatches(ds, userId)).length;
  return { placeholder, otherMatches };
}

/** Whether anything but squads still names the player. */
async function stillReferenced(ds: DataSource, userId: string): Promise<boolean> {
  for (const ref of USER_REFERENCES) {
    if (ref.table === "team_players" && ref.column === "user_id") continue;
    const rows = await ds.query(
      ref.table,
      [
        {
          field: ref.column,
          op: ref.array ? "array-contains" : "==",
          value: userId,
        },
      ],
      { limit: 1 },
    );
    if (rows.length > 0) return true;
  }
  return false;
}

/**
 * Takes a replaced duplicate off a squad, for the match's scorers (the same
 * people who may add players for it). Their profile goes too once nothing
 * names it, so they stop turning up in searches. Only a placeholder with no
 * matches recorded, and no part in this match, which may still be in play.
 */
export async function removeLeftoverPlayer(
  ds: DataSource,
  uid: string | null,
  args: { matchId: string; teamId: string; userId: string },
): Promise<{ profile_removed: boolean }> {
  const { matchId, teamId, userId } = args;
  if (!uid) throw new DbQueryError("Authentication required", "42501");
  await assertMayAddPlayers(ds, uid, teamId, matchId);
  await placeholderOf(ds, userId);
  if ((await recordedMatches(ds, userId)).length > 0) {
    throw new DbQueryError("player_has_records", "22000");
  }
  const needle = JSON.stringify(userId);
  const [innings, overs] = await Promise.all([
    ds.query("innings", [{ field: "match_id", op: "==", value: matchId }]),
    ds.query("overs", [{ field: "match_id", op: "==", value: matchId }]),
  ]);
  if ([...innings, ...overs].some((d) => JSON.stringify(d).includes(needle))) {
    throw new DbQueryError("player_in_match", "22000");
  }

  const row = await squadRow(ds, teamId, userId);
  if (row) await ds.delete("team_players", row.id);
  const others = await ds.query(
    "team_players",
    [{ field: "user_id", op: "==", value: userId }],
    { limit: 1 },
  );
  if (others.length > 0 || (await stillReferenced(ds, userId))) {
    return { profile_removed: false };
  }
  await removeProfile(ds, userId);
  return { profile_removed: true };
}
