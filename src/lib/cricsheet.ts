/**
 * Cricsheet Universal Open Standard Exporter
 *
 * Formats match scorecard and full delivery events into the standard Cricsheet JSON format (v1.2.0)
 * used across the cricket open-source ecosystem, ESPN Cricinfo researchers, and data analytics tools.
 */

import type { Match, BallEvent } from "./match-types";
import { fieldingCreditOf } from "./cricket";
import { noBallByesOf } from "./firebase/scoring/recompute";

export interface CricsheetDelivery {
  batter: string;
  bowler: string;
  non_striker: string;
  runs: {
    batter: number;
    extras: number;
    total: number;
    non_boundary?: boolean;
  };
  extras?: {
    wides?: number;
    noballs?: number;
    byes?: number;
    legbyes?: number;
    penalty?: number;
  };
  wickets?: Array<{
    player_out: string;
    kind: string;
    fielders?: Array<{ name: string; substitute?: boolean }>;
  }>;
}

export interface CricsheetOver {
  over: number;
  deliveries: CricsheetDelivery[];
}

export interface CricsheetInnings {
  team: string;
  super_over?: boolean;
  target?: {
    runs: number;
    overs?: number;
  };
  penalty_runs?: {
    pre?: number;
    post?: number;
  };
  overs: CricsheetOver[];
}

export interface CricsheetMatch {
  meta: {
    data_version: string;
    created: string;
    revision: number;
  };
  info: {
    balls_per_over: number;
    city?: string;
    dates: string[];
    event?: {
      name: string;
      match_number?: number | string;
      stage?: string;
    };
    gender?: "male" | "female";
    match_type: string;
    match_type_number?: number;
    officials?: {
      umpires?: string[];
      tv_umpires?: string[];
      match_referees?: string[];
      reserve_umpires?: string[];
    };
    overs: number;
    team_type?: "club" | "international";
    teams: [string, string];
    toss: {
      winner: string;
      decision: "bat" | "field";
    };
    outcome?: {
      winner?: string;
      by?: {
        runs?: number;
        wickets?: number;
      };
      result?: string;
      eliminator?: string;
      method?: string;
    };
    player_of_match?: string[];
    players: Record<string, string[]>;
    registry: {
      people: Record<string, string>;
    };
    venue?: string;
  };
  innings: CricsheetInnings[];
}

/** Official Cricsheet dismissal kinds, by normalised internal type. */
const CRICSHEET_DISMISSALS = new Map<string, string>([
  ["caught", "caught"],
  ["bowled", "bowled"],
  ["lbw", "lbw"],
  ["run_out", "run out"],
  ["runout", "run out"],
  ["stumped", "stumped"],
  ["hit_wicket", "hit wicket"],
  ["hitwicket", "hit wicket"],
  ["obstructing", "obstructing the field"],
  ["obstructing_the_field", "obstructing the field"],
  ["handled_ball", "handled the ball"],
  ["hit_the_ball_twice", "hit the ball twice"],
  ["hit_twice", "hit the ball twice"],
  ["timed_out", "timed out"],
  ["timedout", "timed out"],
  ["retired_hurt", "retired hurt"],
  ["retired_out", "retired out"],
]);

/**
 * Maps database/internal dismissal types to official Cricsheet dismissal kind strings.
 */
export function toCricsheetDismissalKind(
  rawDismissal: string | null | undefined,
  isCaughtAndBowled: boolean = false,
): string {
  if (isCaughtAndBowled) return "caught and bowled";
  const normalized = (rawDismissal ?? "bowled")
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, "_");
  return CRICSHEET_DISMISSALS.get(normalized) ?? "bowled";
}

type Innings = NonNullable<Match["innings"]>[number];

/** The people of the match: Cricsheet's registry and each side's players. */
interface People {
  registry: Record<string, string>;
  nameById: Map<string, string>;
  playersByTeam: Record<string, string[]>;
  register: (
    name: string | null | undefined,
    id: string | null | undefined,
    teamName?: string,
  ) => void;
}

function peopleOf(team1Name: string, team2Name: string): People {
  const registry: Record<string, string> = {};
  const nameById = new Map<string, string>();
  const playersByTeam: Record<string, string[]> = {
    [team1Name]: [],
    [team2Name]: [],
  };
  const register: People["register"] = (name, id, teamName) => {
    if (!name || !name.trim()) return;
    const trimmed = name.trim();
    if (id && id.trim()) {
      registry[trimmed] = id.trim();
      nameById.set(id.trim(), trimmed);
    } else if (!registry[trimmed]) {
      // Deterministic pseudo-ID for officials/players lacking DB UUID
      registry[trimmed] =
        `person-${trimmed.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    }
    const players = teamName ? playersByTeam[teamName] : undefined;
    if (players && !players.includes(trimmed)) players.push(trimmed);
  };
  return { registry, nameById, playersByTeam, register };
}

/** The two sides' names, and which bats and bowls in an innings. */
interface Sides {
  team1: string;
  team2: string;
  of: (inn: Innings) => { batting: string; bowling: string };
}

function sidesOf(match: Match): Sides {
  const team1 = match.team1?.name ?? "Team 1";
  const team2 = match.team2?.name ?? "Team 2";
  return {
    team1,
    team2,
    of: (inn) =>
      inn.team_id === match.team1_id
        ? { batting: team1, bowling: team2 }
        : { batting: team2, bowling: team1 },
  };
}

/** Squad players (rosters), then everyone on the innings scorecards. */
function registerSquads(match: Match, people: People, sides: Sides): void {
  const rosters = [
    [match.team1?.team_players, sides.team1],
    [match.team2?.team_players, sides.team2],
  ] as const;
  for (const [roster, teamName] of rosters) {
    for (const tp of roster || []) {
      people.register(tp.user?.full_name, tp.user?.id || tp.user_id, teamName);
    }
  }
  for (const inn of match.innings || []) registerScorecard(inn, people, sides);
}

function registerScorecard(inn: Innings, people: People, sides: Sides): void {
  const { batting, bowling } = sides.of(inn);
  for (const bp of inn.batting_performances || []) {
    people.register(bp.user?.full_name, bp.user?.id || bp.user_id, batting);
  }
  for (const bowl of inn.bowling_performances || []) {
    people.register(bowl.user?.full_name, bowl.user_id, bowling);
  }
  for (const fow of inn.fall_of_wickets || []) {
    people.register(fow.batsman?.full_name, fow.batsman_out_id, batting);
    people.register(fow.bowler?.full_name, fow.bowler_id, bowling);
    people.register(fow.fielder?.full_name, fow.fielder_id, bowling);
  }
}

/** The umpires (registered as people), when the match names any. */
function officialsOf(
  match: Match,
  people: People,
): CricsheetMatch["info"]["officials"] {
  const umpires: string[] = [];
  const tvUmpires: string[] = [];
  const named = [
    [match.umpire1_name, umpires, `umpire-1-${match.id}`],
    [match.umpire2_name, umpires, `umpire-2-${match.id}`],
    [match.third_umpire_name, tvUmpires, `tv-umpire-${match.id}`],
  ] as const;
  for (const [raw, list, id] of named) {
    const name = raw?.trim();
    if (!name) continue;
    list.push(name);
    people.register(name, id);
  }
  if (umpires.length === 0 && tvUmpires.length === 0) return undefined;
  return {
    ...(umpires.length > 0 ? { umpires } : {}),
    ...(tvUmpires.length > 0 ? { tv_umpires: tvUmpires } : {}),
  };
}

/** The tournament, or else the club, the match was played in. */
function eventOf(match: Match): CricsheetMatch["info"]["event"] {
  const name = match.tournament?.name || match.club?.name;
  return name ? { name, match_number: match.title } : undefined;
}

function tossOf(match: Match, sides: Sides): CricsheetMatch["info"]["toss"] {
  return {
    winner:
      match.toss_winner_team_id === match.team2_id ? sides.team2 : sides.team1,
    decision: match.toss_decision === "bowl" ? "field" : "bat",
  };
}

/** The winning margin: stored, or read from the result's wording. */
function marginOf(
  match: Match,
): { runs?: number; wickets?: number } | undefined {
  if (match.win_margin_type === "runs" && match.win_margin) {
    return { runs: match.win_margin };
  }
  if (match.win_margin_type === "wickets" && match.win_margin) {
    return { wickets: match.win_margin };
  }
  const desc = match.result_description;
  const runs = desc?.match(/by\s+(\d+)\s+runs?/i)?.[1];
  if (runs) return { runs: parseInt(runs, 10) };
  const wickets = desc?.match(/by\s+(\d+)\s+wickets?/i)?.[1];
  if (wickets) return { wickets: parseInt(wickets, 10) };
  return undefined;
}

/** A completed match's result (before any D/L method). */
function completedOutcome(
  match: Match,
  sides: Sides,
  desc: string,
): CricsheetMatch["info"]["outcome"] {
  const isTie =
    match.result_type === "tie" ||
    desc.includes("tie") ||
    desc.includes("tied");
  const isSuperOver =
    desc.includes("super over") || desc.includes("eliminator");
  const winnerName =
    match.winning_team_id === match.team1_id ? sides.team1 : sides.team2;
  if (isTie && isSuperOver && match.winning_team_id) {
    return { winner: winnerName, result: "tie", eliminator: winnerName };
  }
  if (isTie) return { result: "tie" };
  if (!match.winning_team_id) return undefined;
  const by = marginOf(match);
  return { winner: winnerName, ...(by ? { by } : {}) };
}

function outcomeOf(
  match: Match,
  sides: Sides,
): CricsheetMatch["info"]["outcome"] {
  if (match.status === "completed") {
    const desc = match.result_description?.toLowerCase() ?? "";
    const outcome = completedOutcome(match, sides, desc);
    const dl = ["d/l", "dls", "duckworth"].some((w) => desc.includes(w));
    return dl ? { ...outcome, method: "D/L" } : outcome;
  }
  if (match.status === "abandoned" || match.result_type === "no_result") {
    return { result: "no result" };
  }
  return undefined;
}

const CRICSHEET_EXTRAS = new Map<
  string,
  keyof NonNullable<CricsheetDelivery["extras"]>
>([
  ["wide", "wides"],
  ["no_ball", "noballs"],
  ["bye", "byes"],
  ["leg_bye", "legbyes"],
  ["penalty", "penalty"],
]);

function extrasOf(b: BallEvent): CricsheetDelivery["extras"] {
  const runs = b.extras ?? 0;
  if (!b.extra_type || runs <= 0) return undefined;
  // Byes off a no-ball: the penalty is a no-ball, the rest byes.
  const nbByes = noBallByesOf(b);
  if (nbByes?.runs) {
    return {
      noballs: runs - nbByes.runs,
      [nbByes.kind === "bye" ? "byes" : "legbyes"]: nbByes.runs,
    };
  }
  const field = CRICSHEET_EXTRAS.get(b.extra_type);
  return field ? { [field]: runs } : {};
}

/** A person's name: from the ball's embedded user, else from the registry. */
function nameOn(
  people: People,
  user: { full_name?: string | null } | null | undefined,
  id: string | null | undefined,
): string | undefined {
  return user?.full_name || (id ? people.nameById.get(id) : undefined);
}

/** The wicket `b` records, with its people registered. */
function wicketOf(
  b: BallEvent,
  batterName: string,
  people: People,
  side: { batting: string; bowling: string },
): NonNullable<CricsheetDelivery["wickets"]>[number] {
  const outPlayerName =
    nameOn(people, b.dismissed_player, b.dismissed_player_id) || batterName;
  people.register(
    outPlayerName,
    b.dismissed_player_id || b.batsman_id,
    side.batting,
  );
  const isCaughtAndBowled =
    (b.dismissal_type === "caught" ||
      b.dismissal_type === "caught and bowled") &&
    !!b.fielder_id &&
    b.fielder_id === b.bowler_id;
  const kind = toCricsheetDismissalKind(b.dismissal_type, isCaughtAndBowled);
  const fielderName = nameOn(people, b.fielder, b.fielder_id);
  // A bowled wicket can name a fielder left over from the scorer's first
  // pick (older records): only a catch, stumping or run out has one.
  if (!fielderName || isCaughtAndBowled || !fieldingCreditOf(b.dismissal_type)) {
    return { player_out: outPlayerName, kind };
  }
  people.register(fielderName, b.fielder_id, side.bowling);
  return { player_out: outPlayerName, kind, fielders: [{ name: fielderName }] };
}

/** One ball in Cricsheet's form, with its people registered. */
function deliveryOf(
  b: BallEvent,
  inn: Innings,
  people: People,
  side: { batting: string; bowling: string },
): CricsheetDelivery {
  const batterName =
    nameOn(people, b.batsman, b.batsman_id) || "Unknown Batter";
  const bowlerName = nameOn(people, b.bowler, b.bowler_id) || "Unknown Bowler";
  const nonStrikerName =
    nameOn(people, b.non_striker, b.non_striker_id) ??
    // The other batter on the innings scorecard.
    inn.batting_performances?.find(
      (bp) => bp.user_id !== b.batsman_id && bp.user?.full_name,
    )?.user?.full_name ??
    "Non-Striker";

  people.register(batterName, b.batsman_id, side.batting);
  if (b.bowler_id) people.register(bowlerName, b.bowler_id, side.bowling);
  if (b.non_striker_id) {
    people.register(nonStrikerName, b.non_striker_id, side.batting);
  }

  const batRuns = b.runs_scored ?? 0;
  const extraRuns = b.extras ?? 0;
  const delivery: CricsheetDelivery = {
    batter: batterName,
    bowler: bowlerName,
    non_striker: nonStrikerName,
    runs: { batter: batRuns, extras: extraRuns, total: batRuns + extraRuns },
  };
  const extras = extrasOf(b);
  if (extras) delivery.extras = extras;
  if (b.is_wicket) {
    delivery.wickets = [wicketOf(b, batterName, people, side)];
  }
  return delivery;
}

function byOverThenSeq(a: BallEvent, b: BallEvent): number {
  if (a.over_number !== b.over_number) return a.over_number - b.over_number;
  if (a.seq != null && b.seq != null) return a.seq - b.seq;
  return a.ball_number - b.ball_number;
}

/** One innings: its balls by over (embedded, or else the external ones). */
function inningsOf(
  match: Match,
  inn: Innings,
  balls: BallEvent[],
  people: People,
  sides: Sides,
): CricsheetInnings {
  const side = sides.of(inn);
  const rawBalls =
    inn.ball_by_ball && inn.ball_by_ball.length > 0 ? inn.ball_by_ball : balls;
  const oversMap = new Map<number, CricsheetDelivery[]>();
  for (const b of [...rawBalls].sort(byOverThenSeq)) {
    const delivery = deliveryOf(b, inn, people, side);
    const over = oversMap.get(b.over_number) ?? [];
    over.push(delivery);
    oversMap.set(b.over_number, over);
  }
  const overs: CricsheetOver[] = Array.from(oversMap.entries())
    .sort(([o1], [o2]) => o1 - o2)
    .map(([over, deliveries]) => ({ over, deliveries }));

  const innObj: CricsheetInnings = {
    team: side.batting,
    ...(inn.innings_number > 2 ? { super_over: true } : {}),
    overs,
  };
  if (inn.target_runs) {
    innObj.target = { runs: inn.target_runs, overs: match.overs_per_innings };
  }
  if (inn.extras_penalties && inn.extras_penalties > 0) {
    innObj.penalty_runs = { post: inn.extras_penalties };
  }
  return innObj;
}

export function buildCricsheetJson(
  match: Match,
  externalBalls?: BallEvent[],
): CricsheetMatch {
  const sides = sidesOf(match);
  const people = peopleOf(sides.team1, sides.team2);
  const dateStr = (
    match.actual_start_time ||
    match.scheduled_at ||
    new Date().toISOString()
  ).split("T")[0]!;

  registerSquads(match, people, sides);
  const officials = officialsOf(match, people);
  const potm = match.player_of_the_match;
  if (potm?.full_name) people.register(potm.full_name, potm.id);

  const ballsByInnings = new Map<string, BallEvent[]>();
  for (const b of externalBalls ?? []) {
    const list = ballsByInnings.get(b.innings_id) ?? [];
    list.push(b);
    ballsByInnings.set(b.innings_id, list);
  }
  const innings = [...(match.innings || [])]
    .sort((a, b) => a.innings_number - b.innings_number)
    .map((inn) =>
      inningsOf(match, inn, ballsByInnings.get(inn.id) ?? [], people, sides),
    );

  return {
    meta: {
      data_version: "1.2.0",
      created: dateStr,
      revision: 1,
    },
    info: {
      balls_per_over: 6,
      dates: [dateStr],
      event: eventOf(match),
      gender: "male",
      match_type: match.match_format ? match.match_format.toUpperCase() : "T20",
      officials,
      overs: match.overs_per_innings,
      outcome: outcomeOf(match, sides),
      player_of_match: potm?.full_name ? [potm.full_name] : undefined,
      players: people.playersByTeam,
      registry: {
        people: people.registry,
      },
      team_type: "club",
      teams: [sides.team1, sides.team2],
      toss: tossOf(match, sides),
      venue: match.venue?.trim() || "Unknown Venue",
    },
    innings,
  };
}

export function downloadCricsheetJson(
  match: Match,
  externalBalls?: BallEvent[],
) {
  const data = buildCricsheetJson(match, externalBalls);
  const jsonStr = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const slug = match.title
    ? match.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")
    : "match";
  const fileName = `${slug}-cricsheet.json`;
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
