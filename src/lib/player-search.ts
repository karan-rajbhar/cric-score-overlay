/**
 * Existing players offered while a name is typed, so the person who already
 * has a profile is added instead of a duplicate. The search itself is
 * `GET /api/players/search` (`~/lib/player-lookup`, `usePlayerSearch`).
 */

import {
  matchesEveryWord,
  NAME_EXTRAS,
  normalizeText,
  soundKey,
} from "~/lib/firebase/derive.mjs";

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
 * How a name sounds, to catch a spelling variant of someone who already
 * exists: lower case without accents or punctuation, honorifics dropped,
 * common spellings folded (ee/i, oo/u, aa/a, w/v, sh/s, ph/f) and doubled
 * letters single. "Sandeep sir" and "Sandip Sir" both give "sandip".
 */
export function nameSoundKey(name: string): string {
  return normalizeText(name)
    .split(/\s+/)
    .filter((w) => w && !NAME_EXTRAS.has(w))
    // The search's own rule (its sound tokens), so screen and server agree.
    .map(soundKey)
    .join(" ");
}

/** A squad player who may be someone else in the squad, and who. */
export interface DuplicatePair {
  duplicate: { id: string; name: string };
  keeper: { id: string; name: string };
}

/**
 * Squad players added by name who may be someone else in the squad: the
 * same name as it sounds ("Sandip Sir" and "Sandeep sir"), or a short form
 * of it ("Sa" beside "Sanket", "Amit" beside "Amit Jaiswal"). Only players
 * not on CricScore are offered as the duplicate (an account is never
 * merged away), each once, with someone on CricScore preferred as the one
 * kept. Suggestions only: the merge itself refuses two players who played
 * in the same match.
 */
export function possibleDuplicates(
  players: readonly { id: string; name: string }[],
  isPlaceholder: (id: string) => boolean,
): DuplicatePair[] {
  const keyed = players
    .map((p) => ({ ...p, key: nameSoundKey(p.name) }))
    .filter((p) => p.key.length >= 2);
  const pairs: DuplicatePair[] = [];
  const paired = new Set<string>();
  for (const dup of keyed) {
    if (!isPlaceholder(dup.id) || paired.has(dup.id)) continue;
    const short = !dup.key.includes(" ");
    const candidates = keyed.filter((other) => {
      if (other.id === dup.id || paired.has(other.id)) return false;
      if (other.key === dup.key) return true;
      // A short form: one word that starts the other's first word, and
      // the other is the longer name (so the shorter one is the duplicate).
      const first = other.key.split(" ")[0] ?? "";
      return short && first.startsWith(dup.key) && other.key.length > dup.key.length;
    });
    // Same sound first, then someone on CricScore.
    const keeper =
      candidates.find((c) => c.key === dup.key && !isPlaceholder(c.id)) ??
      candidates.find((c) => c.key === dup.key) ??
      candidates.find((c) => !isPlaceholder(c.id)) ??
      candidates[0];
    if (!keeper) continue;
    // Two placeholders of the same sound: the longer name is kept.
    if (
      keeper.key === dup.key &&
      isPlaceholder(keeper.id) &&
      keeper.name.length < dup.name.length
    ) {
      continue;
    }
    pairs.push({
      duplicate: { id: dup.id, name: dup.name },
      keeper: { id: keeper.id, name: keeper.name },
    });
    paired.add(dup.id);
    paired.add(keeper.id);
  }
  return pairs;
}

/**
 * Someone whose name is, or sounds like, the one being added: an exact
 * name first, then a spelling variant among `players` and `squad`, then,
 * in `squad` only (the people on the screen), the same first name ("Amit"
 * beside "Amit Jaiswal"). Null when nobody is close.
 */
export function similarNamePlayer(
  query: string,
  players: readonly FoundPlayer[],
  squad: readonly FoundPlayer[] = [],
): FoundPlayer | null {
  const everyone = [...players, ...squad];
  const exact = sameNamePlayer(query, everyone);
  if (exact) return exact;
  const key = nameSoundKey(query);
  if (key.replace(/\s/g, "").length < 3) return null;
  const sounds = everyone.find((p) => nameSoundKey(p.name) === key);
  if (sounds) return sounds;
  const firstOf = (k: string) => k.split(" ")[0] ?? "";
  const one = !key.includes(" ");
  return (
    squad.find((p) => {
      const other = nameSoundKey(p.name);
      if (!other) return false;
      // One of the two is a single word that is the other's first name.
      return one
        ? firstOf(other) === key
        : !other.includes(" ") && firstOf(key) === other;
    }) ?? null
  );
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
  // Compared as typed too: `normalizeText` drops punctuation and accents.
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
