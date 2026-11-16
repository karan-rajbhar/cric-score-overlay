import { playerDetailLine, playingRoleLabel } from "./player-profile";
import { initialsOf } from "./utils";

/*
 * What a shared player or team link shows: the preview image's lines and
 * figures, and the description beside it. Pure, from the documents the
 * preview loads (`~/lib/share-card-server`).
 */

type Row = Record<string, unknown>;
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const text = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

export interface ShareFigure {
  value: string;
  label: string;
}

export interface PlayerCard {
  name: string;
  initials: string;
  /** "@sandeep_sir · Batter · Right-hand bat · Kamothe", whatever is set. */
  detail: string;
  /** Matches, Runs, Highest, Wickets, Best: those with something in them. */
  figures: ShareFigure[];
  /** The preview's text: "Sandeep sir on CricScore: 312 runs and 14 wickets in 22 matches." */
  description: string;
}

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

export function playerCard(user: Row, stats: Row | null): PlayerCard {
  const name = text(user.full_name) ?? "Player";
  const handle = text(user.username);
  const detail = playerDetailLine(
    {
      batting_hand: text(user.batting_hand),
      bowling_style: text(user.bowling_style),
      location: text(user.location),
    } as Parameters<typeof playerDetailLine>[0],
  );
  const role = playingRoleLabel(text(user.playing_role));
  const s = stats ?? {};
  const matches = num(s.total_matches);
  const runs = num(s.total_runs);
  const wickets = num(s.total_wickets);
  const highest = num(s.highest_score);
  const best = text(s.best_bowling_figures);
  const figures: ShareFigure[] = [{ value: String(matches), label: "Matches" }];
  if (runs > 0 || wickets === 0) {
    figures.push({ value: String(runs), label: "Runs" });
    if (highest > 0) figures.push({ value: String(highest), label: "Highest" });
  }
  if (wickets > 0) {
    figures.push({ value: String(wickets), label: "Wickets" });
    if (best) figures.push({ value: best, label: "Best" });
  }
  const done = [
    runs > 0 ? plural(runs, "run") : null,
    wickets > 0 ? plural(wickets, "wicket") : null,
  ].filter(Boolean);
  const description =
    matches > 0
      ? `${name} on CricScore: ${done.length ? `${done.join(" and ")} in ` : ""}${plural(matches, "match", "matches")}.`
      : `${name} on CricScore: figures from every match they play.`;
  return {
    name,
    initials: initialsOf(name, 2),
    detail: [handle ? `@${handle}` : null, role, detail || null]
      .filter(Boolean)
      .join(" · "),
    figures: figures.slice(0, 5),
    description,
  };
}

export interface TeamCard {
  name: string;
  initials: string;
  /** The team's colour for its badge ("#rrggbb"), when set. */
  color: string | null;
  /** "OMK · Unity Cricket Club · 21 players · Omkar (c)". */
  detail: string;
  description: string;
}

export function teamCard(team: Row, clubName: string | null): TeamCard {
  const name = text(team.name) ?? "Team";
  const short = text(team.short_name);
  const roster = Array.isArray(team.roster) ? (team.roster as Row[]) : [];
  const captain = roster.find(
    (r) => r.user_id === team.captain_id || r.role_in_team === "captain",
  );
  const captainName = text((captain?.user as Row | null | undefined)?.full_name);
  const players = roster.length > 0 ? plural(roster.length, "player") : null;
  const color = text(team.primary_color);
  return {
    name,
    initials: short ? short.slice(0, 3).toUpperCase() : initialsOf(name, 2),
    color: color && /^#[0-9a-f]{6}$/i.test(color) ? color : null,
    detail: [short, clubName, players, captainName ? `${captainName} (c)` : null]
      .filter(Boolean)
      .join(" · "),
    description: (() => {
      const about = [clubName ? `a ${clubName} team` : null, players].filter(
        Boolean,
      );
      return about.length
        ? `${name} on CricScore: ${about.join(", ")}.`
        : `${name} on CricScore.`;
    })(),
  };
}
