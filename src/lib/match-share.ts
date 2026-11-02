/**
 * What a shared match link shows (page title, Open Graph / Twitter text
 * and the generated preview image), from the match document alone: its
 * team snapshots and `innings_summary` (one read; a live match's innings in
 * progress is re-read, see `loadShareMatch`).
 */

import { matchFormatLabel, oversFromBalls } from "./cricket";
import type { MatchesRow } from "./firebase/types";

export type ShareMatch = Pick<
  MatchesRow,
  | "id"
  | "title"
  | "status"
  | "team1_id"
  | "team2_id"
  | "team1_snapshot"
  | "team2_snapshot"
  | "innings_summary"
  | "balls_per_over"
  | "result_description"
  | "venue"
  | "match_format"
  | "overs_per_innings"
>;

export interface ShareSide {
  name: string;
  shortName: string | null;
  /** "145/6", or null before the side bats. */
  score: string | null;
  /** "18.2", or null before the side bats. */
  overs: string | null;
  batting: boolean;
  /** "Batting now", "Innings closed", "Yet to bat" or "" (finished). */
  note: string;
}

export interface MatchShareSummary {
  title: string;
  description: string;
  /** "Live", "Result", "Scheduled", ... */
  status: string;
  sides: [ShareSide, ShareSide];
  /** Result, or format and venue. */
  footer: string;
  /** Changes whenever the score does (cache key for the image URL). */
  version: string;
}

type Entry = NonNullable<MatchesRow["innings_summary"]>[number];

const STATUS_LABEL: Record<string, string> = {
  live: "Live",
  completed: "Result",
  scheduled: "Scheduled",
  abandoned: "Abandoned",
  cancelled: "Cancelled",
};

function scoreOf(inn: Entry, bpo: number) {
  const runs = inn.total_runs ?? 0;
  const wickets = inn.total_wickets ?? 0;
  const balls =
    inn.total_balls ??
    (inn.total_overs != null
      ? Math.floor(inn.total_overs) * bpo +
        Math.round((inn.total_overs % 1) * 10)
      : 0);
  return {
    score: `${runs}/${wickets}`,
    overs: oversFromBalls(balls, bpo),
  };
}

/** "Strikers need 39 runs from 38 balls" while a chase is on. */
function chaseLine(
  match: ShareMatch,
  latest: Entry,
  bpo: number,
  sides: [ShareSide, ShareSide],
): string | null {
  if (latest.is_completed || !latest.target_runs) return null;
  const need = latest.target_runs - (latest.total_runs ?? 0);
  if (need <= 0) return null;
  const name =
    latest.team_id === match.team1_id
      ? sides[0].name
      : latest.team_id === match.team2_id
        ? sides[1].name
        : "They";
  const runs = `${need} ${need === 1 ? "run" : "runs"}`;
  if (!match.overs_per_innings) return `${name} need ${runs}`;
  const left = match.overs_per_innings * bpo - (latest.total_balls ?? 0);
  if (left <= 0) return `${name} need ${runs}`;
  return `${name} need ${runs} from ${left} ${left === 1 ? "ball" : "balls"}`;
}

export function matchShareSummary(match: ShareMatch): MatchShareSummary {
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  const innings = [...(match.innings_summary ?? [])].sort(
    (a, b) => (a.innings_number ?? 0) - (b.innings_number ?? 0),
  );
  const latest = innings[innings.length - 1] ?? null;
  const live = match.status === "live";

  const side = (
    teamId: string | null | undefined,
    snap: MatchesRow["team1_snapshot"],
    fallback: string,
  ): ShareSide => {
    const own = innings.filter((i) => i.team_id === teamId);
    const last = own[own.length - 1];
    const s = last ? scoreOf(last, bpo) : null;
    const batting = Boolean(
      live && last && latest && last.id === latest.id && !last.is_completed,
    );
    const finished = match.status === "completed";
    return {
      name: snap?.name?.trim() || fallback,
      shortName: snap?.short_name ?? null,
      score: s?.score ?? null,
      overs: s?.overs ?? null,
      batting,
      note: batting
        ? "Batting now"
        : last
          ? finished
            ? ""
            : "Innings closed"
          : finished
            ? ""
            : "Yet to bat",
    };
  };
  const sides: [ShareSide, ShareSide] = [
    side(match.team1_id, match.team1_snapshot, "Team 1"),
    side(match.team2_id, match.team2_snapshot, "Team 2"),
  ];

  const vs = `${sides[0].name} vs ${sides[1].name}`;
  const result = match.result_description?.trim() || "";
  let title = vs;
  if (match.status === "completed" && result) {
    title = `${vs} — ${result}`;
  } else if (latest && (live || match.status === "completed")) {
    const s = scoreOf(latest, bpo);
    title = `${vs} — ${s.score} (${s.overs} ov)`;
  }

  const lines = sides
    .filter((s) => s.score)
    .map((s) => `${s.name} ${s.score} (${s.overs} ov)`);
  const format = [matchFormatLabel(match), match.venue]
    .filter(Boolean)
    .join(" · ");
  const status = STATUS_LABEL[match.status ?? ""] ?? "Match";
  const chase = live && latest ? chaseLine(match, latest, bpo, sides) : null;
  const descriptionParts = [
    lines.join(", "),
    result || chase || (live ? "Live on CricScore" : format),
  ].filter(Boolean);

  return {
    title,
    description: descriptionParts.join(". "),
    status,
    sides,
    footer: result || chase || format,
    version: [
      match.status,
      ...innings.map(
        (i) =>
          `${i.total_runs ?? 0}-${i.total_wickets ?? 0}-${i.total_balls ?? 0}`,
      ),
    ].join("_"),
  };
}
