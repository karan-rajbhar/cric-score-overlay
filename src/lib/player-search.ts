/**
 * Existing players offered while a name is typed (`searchUsers`), so the
 * person who already has a profile is added instead of a duplicate.
 */

/** A player found by name. */
export interface FoundPlayer {
  id: string;
  name: string;
  username?: string | null;
  /** Matches played (career), to tell two players of one name apart. */
  matches?: number | null;
  /** Teams of the user's they are in (known without a read). */
  teams?: readonly string[];
}

/**
 * Who they are, in a few words: "Plays for Lions, Tigers" for someone on
 * one or two of the user's teams, "In 40 of your teams" for a regular of
 * sides made afresh each day (their names would only be noise), else
 * "@rahul · 42 matches", "1 match", "No matches yet".
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
  return p.username ? `@${p.username} · ${played}` : played;
}

/**
 * Whether `name` matches what is typed the way the server's search does:
 * every typed word starts a word of the name ("rah sh" finds "Rahul
 * Sharma").
 */
export function nameMatches(name: string, query: string): boolean {
  const words = name.toLowerCase().split(/\s+/).filter(Boolean);
  return query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((q) => words.some((w) => w.startsWith(q)));
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
