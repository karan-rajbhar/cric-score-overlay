/**
 * Existing players offered while a name is typed, so the person who already
 * has a profile is added instead of a duplicate. The search itself is
 * `GET /api/players/search` (`~/lib/player-lookup`, `usePlayerSearch`).
 */

import { matchesEveryWord, normalizeText } from "~/lib/firebase/derive.mjs";

/** A player found by name. */
export interface FoundPlayer {
  id: string;
  name: string;
  username?: string | null;
  /** Matches played (career), to tell two players of one name apart. */
  matches?: number | null;
  /** Teams of the user's they are in (known without a read). */
  teams?: readonly string[];
  /** A member of the club being added to. */
  clubMember?: boolean;
  /** The team they have already played for in this match. */
  playedFor?: string | null;
  /** Why this box cannot use them, when something else rules them out. */
  unavailable?: string | null;
}

/** Found players listed at once: on a phone the keyboard covers the rest. */
export const SUGGESTIONS_SHOWN = 5;

/** What one search answered. */
export interface PlayerSearchResult {
  players: FoundPlayer[];
  /** More people match than were read: typing more narrows it down. */
  more: boolean;
}

/**
 * Who they are, in a few words: "Plays for Lions, Tigers" for someone on
 * one or two of the user's teams, "In 40 of your teams" for a regular of
 * sides made afresh each day (their names would only be noise), else
 * "@rahul · 42 matches", "1 match", "No matches yet", after "Club member"
 * for a member of the club being added to.
 */
export function foundPlayerHint(p: FoundPlayer): string {
  if (p.teams?.length) {
    return p.teams.length > 2
      ? `In ${p.teams.length} of your teams`
      : `Plays for ${p.teams.join(", ")}`;
  }
  const n = p.matches ?? 0;
  const played =
    n === 0 ? "No matches yet" : `${n} ${n === 1 ? "match" : "matches"}`;
  const who = p.username ? `@${p.username} · ${played}` : played;
  return p.clubMember ? `Club member · ${who}` : who;
}

/** Someone found with exactly the name being added, if anyone. */
export function sameNamePlayer(
  query: string,
  players: readonly FoundPlayer[],
): FoundPlayer | null {
  const typed = normalizeText(query);
  if (!typed) return null;
  return players.find((p) => normalizeText(p.name) === typed) ?? null;
}

/**
 * The username being typed, lower-cased, when the text starts with "@"
 * (empty for "@" alone), else null: a handle finds a player but is never
 * the name of a new one.
 */
export function typedHandle(query: string): string | null {
  const text = query.trim();
  return text.startsWith("@") ? text.slice(1).toLowerCase() : null;
}

/**
 * Whether a player already on the screen matches what is typed, the way
 * the server's search does and a little wider: part of the name or
 * username, or every typed word starting a word of either ("rah sh" and
 * "sharma rahul" find "Rahul Sharma"). "@name" looks at usernames only.
 */
export function playerMatches(
  query: string,
  player: { name: string; username?: string | null },
): boolean {
  const handle = typedHandle(query);
  if (handle !== null) return Boolean(player.username?.includes(handle));
  const raw = query.trim().toLowerCase().replace(/\s+/g, " ");
  // Compared as typed too: `normalizeText` keeps Latin letters only.
  if (raw && player.name.toLowerCase().includes(raw)) return true;
  const texts = [player.name, player.username];
  const typed = normalizeText(query);
  return (
    Boolean(typed) &&
    (texts.some((t) => normalizeText(t).includes(typed)) ||
      matchesEveryWord(typed, texts))
  );
}

/**
 * Why `player` cannot join `team` for this match, or null when they can.
 * A squad is a team's standing roster, not who plays today, so being in
 * the other side's squad is no reason: only having played for it is.
 */
export function whyNotAddable(p: FoundPlayer, team: string): string | null {
  if (p.unavailable) return p.unavailable;
  if (p.playedFor && p.playedFor !== team) return `Played for ${p.playedFor}`;
  return p.teams?.includes(team) ? `Already in ${team}` : null;
}

/**
 * The people on the user's teams (each once, with the teams they are in),
 * from the teams' roster copies already read.
 */
export function teammatesOf(
  teams: readonly { name: string; players?: readonly { id: string; name: string }[] }[],
): FoundPlayer[] {
  const byId = new Map<string, { id: string; name: string; teams: string[] }>();
  for (const team of teams) {
    for (const p of team.players ?? []) {
      const entry = byId.get(p.id) ?? { id: p.id, name: p.name, teams: [] };
      if (!entry.teams.includes(team.name)) entry.teams.push(team.name);
      byId.set(p.id, entry);
    }
  }
  return [...byId.values()];
}
