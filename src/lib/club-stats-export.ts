/**
 * The club's combined statistics for the downloads (CSV and the PDF report):
 * one row per player who batted, bowled or fielded, ranked by points, with
 * their batting, bowling and fielding figures beside the points. Built from
 * the same leaderboard the Stats tab shows (`LeaderboardData`), so the
 * downloads and the page never disagree.
 */

import type {
  BattingLeaderboardEntry,
  BowlingLeaderboardEntry,
  FieldingLeaderboardEntry,
  LeaderboardData,
  MvpLeaderboardEntry,
} from "~/lib/leaderboard";

export interface ClubStatsRow {
  /** Competition ranking: players level on points share a rank. */
  rank: number;
  userId: string;
  name: string;
  matches: number;
  points: {
    total: number;
    batting: number;
    bowling: number;
    fielding: number;
  };
  batting: BattingLeaderboardEntry | null;
  bowling: BowlingLeaderboardEntry | null;
  fielding: FieldingLeaderboardEntry | null;
}

/** Players ranked by total points (ties: more runs, more wickets, name). */
export function clubStatsRows(data: LeaderboardData): ClubStatsRow[] {
  const batting = new Map(data.batting.map((e) => [e.userId, e]));
  const bowling = new Map(data.bowling.map((e) => [e.userId, e]));
  const fielding = new Map(data.fielding.map((e) => [e.userId, e]));
  const ranked = [...data.mvp].sort(
    (a: MvpLeaderboardEntry, b: MvpLeaderboardEntry) =>
      b.totalPoints - a.totalPoints ||
      b.runs - a.runs ||
      b.wickets - a.wickets ||
      a.name.localeCompare(b.name) ||
      (a.userId < b.userId ? -1 : 1),
  );
  let rank = 0;
  return ranked.map((m, i) => {
    const prev = ranked[i - 1];
    if (!prev || prev.totalPoints !== m.totalPoints) rank = i + 1;
    return {
      rank,
      userId: m.userId,
      name: m.name,
      matches: m.matches,
      points: {
        total: m.totalPoints,
        batting: m.battingPoints,
        bowling: m.bowlingPoints,
        fielding: m.fieldingPoints,
      },
      batting: batting.get(m.userId) ?? null,
      bowling: bowling.get(m.userId) ?? null,
      fielding: fielding.get(m.userId) ?? null,
    };
  });
}

/** "—" is a display value; a spreadsheet cell is empty instead. */
const figure = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "—" ? "" : v;

const COLUMNS: readonly [string, (r: ClubStatsRow) => string | number][] = [
  ["Rank", (r) => r.rank],
  ["Player", (r) => r.name],
  ["Matches", (r) => r.matches],
  ["Points", (r) => r.points.total],
  ["Batting points", (r) => r.points.batting],
  ["Bowling points", (r) => r.points.bowling],
  ["Fielding points", (r) => r.points.fielding],
  ["Batting innings", (r) => figure(r.batting?.innings ?? 0)],
  ["Not outs", (r) => figure(r.batting?.notOuts ?? 0)],
  ["Runs", (r) => figure(r.batting?.runs ?? 0)],
  ["Balls faced", (r) => figure(r.batting?.balls ?? 0)],
  ["Highest score", (r) => figure(r.batting?.highestScoreDisplay)],
  ["Batting average", (r) => figure(r.batting?.averageDisplay)],
  ["Strike rate", (r) => figure(r.batting?.strikeRateDisplay)],
  ["Fours", (r) => figure(r.batting?.fours ?? 0)],
  ["Sixes", (r) => figure(r.batting?.sixes ?? 0)],
  ["Fifties", (r) => figure(r.batting?.fifties ?? 0)],
  ["Hundreds", (r) => figure(r.batting?.centuries ?? 0)],
  ["Bowling innings", (r) => figure(r.bowling?.innings ?? 0)],
  ["Overs", (r) => figure(r.bowling?.overs ?? "0.0")],
  ["Maidens", (r) => figure(r.bowling?.maidens ?? 0)],
  ["Runs conceded", (r) => figure(r.bowling?.runsConceded ?? 0)],
  ["Wickets", (r) => figure(r.bowling?.wickets ?? 0)],
  ["Best bowling", (r) => figure(r.bowling?.bestBowling.display)],
  ["Bowling average", (r) => figure(r.bowling?.averageDisplay)],
  ["Economy", (r) => figure(r.bowling?.economyDisplay)],
  ["Bowling strike rate", (r) => figure(r.bowling?.strikeRateDisplay)],
  ["Three-wicket hauls", (r) => figure(r.bowling?.threeWickets ?? 0)],
  ["Five-wicket hauls", (r) => figure(r.bowling?.fiveWickets ?? 0)],
  ["Catches", (r) => figure(r.fielding?.catches ?? 0)],
  ["Stumpings", (r) => figure(r.fielding?.stumpings ?? 0)],
  ["Run outs", (r) => figure(r.fielding?.runOuts ?? 0)],
];

/**
 * One CSV cell. A text cell a spreadsheet would run as a formula (a name
 * starting with = + - @) is led by a tab, so it stays text.
 */
function cell(value: string | number): string {
  let text = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(text))
    text = `\t${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Byte order mark: tells Excel the file is UTF-8 (names with accents). */
const BOM = String.fromCharCode(0xfeff);

/** The CSV, opening cleanly in Excel (byte order mark, CRLF lines). */
export function clubStatsCsv(rows: readonly ClubStatsRow[]): string {
  const lines = [
    COLUMNS.map(([head]) => cell(head)).join(","),
    ...rows.map((r) => COLUMNS.map(([, get]) => cell(get(r))).join(",")),
  ];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

// ---------------------------------------------------------------------------
// One table per leaderboard tab
// ---------------------------------------------------------------------------

/** The leaderboard's tabs that have a table of their own. */
export type StatsTab = "batting" | "bowling" | "fielding" | "mvp";
export const STATS_TABS: readonly StatsTab[] = [
  "batting",
  "bowling",
  "fielding",
  "mvp",
];

/** The tab named by `?tab=` (null: the combined statistics). */
export function parseStatsTab(raw: string | null | undefined): StatsTab | null {
  return STATS_TABS.find((t) => t === raw) ?? null;
}

export interface TabColumn<E> {
  /** The spreadsheet's heading. */
  head: string;
  /** The printed heading and what it stands for. */
  short: string;
  full?: string;
  /** A method, so a table of any entry type passes as a generic one. */
  value(entry: E): string | number;
  /** The figure the tab ranks by. */
  strong?: boolean;
}

export interface TabTable<E extends { userId: string; name: string }> {
  /** "Batting", for headings and file names. */
  label: string;
  /** "Ranked by runs", under the heading. */
  rankedBy: string;
  columns: readonly TabColumn<E>[];
  rows: readonly { rank: number; entry: E }[];
}

/** Competition ranking on `metric` over the list as given. */
function ranked<E>(list: readonly E[], metric: (e: E) => number) {
  let rank = 0;
  return list.map((entry, i) => {
    const prev = list[i - 1];
    if (prev === undefined || metric(prev) !== metric(entry)) rank = i + 1;
    return { rank, entry };
  });
}

const BATTING_COLUMNS: readonly TabColumn<BattingLeaderboardEntry>[] = [
  { head: "Matches", short: "M", full: "Matches", value: (e) => e.matches },
  { head: "Innings", short: "Inn", full: "Innings", value: (e) => e.innings },
  { head: "Not outs", short: "NO", full: "Not outs", value: (e) => e.notOuts },
  {
    head: "Runs",
    short: "R",
    full: "Runs",
    value: (e) => e.runs,
    strong: true,
  },
  {
    head: "Balls faced",
    short: "B",
    full: "Balls faced",
    value: (e) => e.balls,
  },
  {
    head: "Highest score",
    short: "HS",
    full: "Highest score",
    value: (e) => e.highestScoreDisplay,
  },
  {
    head: "Batting average",
    short: "Avg",
    full: "Batting average",
    value: (e) => e.averageDisplay,
  },
  {
    head: "Strike rate",
    short: "SR",
    full: "Strike rate",
    value: (e) => e.strikeRateDisplay,
  },
  { head: "Fours", short: "4s", full: "Fours", value: (e) => e.fours },
  { head: "Sixes", short: "6s", full: "Sixes", value: (e) => e.sixes },
  { head: "Fifties", short: "50", full: "Fifties", value: (e) => e.fifties },
  {
    head: "Hundreds",
    short: "100",
    full: "Hundreds",
    value: (e) => e.centuries,
  },
  {
    head: "Boundary runs",
    short: "Bnd%",
    full: "Share of runs in boundaries",
    value: (e) => e.boundaryPercent,
  },
];

const BOWLING_COLUMNS: readonly TabColumn<BowlingLeaderboardEntry>[] = [
  { head: "Matches", short: "M", full: "Matches", value: (e) => e.matches },
  { head: "Innings", short: "Inn", full: "Innings", value: (e) => e.innings },
  { head: "Overs", short: "O", full: "Overs", value: (e) => e.overs },
  { head: "Maidens", short: "Mdn", full: "Maidens", value: (e) => e.maidens },
  {
    head: "Runs conceded",
    short: "R",
    full: "Runs conceded",
    value: (e) => e.runsConceded,
  },
  {
    head: "Wickets",
    short: "W",
    full: "Wickets",
    value: (e) => e.wickets,
    strong: true,
  },
  {
    head: "Best bowling",
    short: "BBI",
    full: "Best bowling",
    value: (e) => e.bestBowling.display,
  },
  {
    head: "Bowling average",
    short: "Avg",
    full: "Bowling average",
    value: (e) => e.averageDisplay,
  },
  {
    head: "Economy",
    short: "Econ",
    full: "Economy",
    value: (e) => e.economyDisplay,
  },
  {
    head: "Bowling strike rate",
    short: "SR",
    full: "Bowling strike rate",
    value: (e) => e.strikeRateDisplay,
  },
  {
    head: "Three-wicket hauls",
    short: "3w",
    full: "Three-wicket hauls",
    value: (e) => e.threeWickets,
  },
  {
    head: "Five-wicket hauls",
    short: "5w",
    full: "Five-wicket hauls",
    value: (e) => e.fiveWickets,
  },
];

const FIELDING_COLUMNS: readonly TabColumn<FieldingLeaderboardEntry>[] = [
  { head: "Matches", short: "M", full: "Matches", value: (e) => e.matches },
  { head: "Catches", short: "Ct", full: "Catches", value: (e) => e.catches },
  {
    head: "Stumpings",
    short: "St",
    full: "Stumpings",
    value: (e) => e.stumpings,
  },
  { head: "Run outs", short: "RO", full: "Run outs", value: (e) => e.runOuts },
  {
    head: "Dismissals",
    short: "Total",
    full: "Dismissals",
    value: (e) => e.totalDismissals,
    strong: true,
  },
];

const MVP_COLUMNS: readonly TabColumn<MvpLeaderboardEntry>[] = [
  { head: "Matches", short: "M", full: "Matches", value: (e) => e.matches },
  {
    head: "Batting points",
    short: "Bat",
    full: "Batting points",
    value: (e) => e.battingPoints,
  },
  {
    head: "Bowling points",
    short: "Bowl",
    full: "Bowling points",
    value: (e) => e.bowlingPoints,
  },
  {
    head: "Fielding points",
    short: "Field",
    full: "Fielding points",
    value: (e) => e.fieldingPoints,
  },
  {
    head: "Points",
    short: "Pts",
    full: "Total points",
    value: (e) => e.totalPoints,
    strong: true,
  },
  { head: "Runs", short: "R", full: "Runs", value: (e) => e.runs },
  { head: "Wickets", short: "W", full: "Wickets", value: (e) => e.wickets },
  { head: "Catches", short: "Ct", full: "Catches", value: (e) => e.catches },
  {
    head: "Stumpings",
    short: "St",
    full: "Stumpings",
    value: (e) => e.stumpings,
  },
  { head: "Run outs", short: "RO", full: "Run outs", value: (e) => e.runOuts },
];

interface TabTables {
  batting: TabTable<BattingLeaderboardEntry>;
  bowling: TabTable<BowlingLeaderboardEntry>;
  fielding: TabTable<FieldingLeaderboardEntry>;
  mvp: TabTable<MvpLeaderboardEntry>;
}

/** A tab's table, in the order its leaderboard lists the players. */
export function tabTable<K extends StatsTab>(
  data: LeaderboardData,
  tab: K,
): TabTables[K] {
  const tables: TabTables = {
    batting: {
      label: "Batting",
      rankedBy: "Ranked by runs",
      columns: BATTING_COLUMNS,
      rows: ranked(data.batting, (e) => e.runs),
    },
    bowling: {
      label: "Bowling",
      rankedBy: "Ranked by wickets",
      columns: BOWLING_COLUMNS,
      rows: ranked(data.bowling, (e) => e.wickets),
    },
    fielding: {
      label: "Fielding",
      rankedBy: "Ranked by dismissals",
      columns: FIELDING_COLUMNS,
      rows: ranked(data.fielding, (e) => e.totalDismissals),
    },
    mvp: {
      label: "Points",
      rankedBy: "Ranked by total points",
      columns: MVP_COLUMNS,
      rows: ranked(data.mvp, (e) => e.totalPoints),
    },
  };
  return tables[tab];
}

/** The tab's CSV: rank and player, then its columns. */
export function tabCsv(
  table: TabTable<{ userId: string; name: string }>,
): string {
  const cols = table.columns as readonly TabColumn<{
    userId: string;
    name: string;
  }>[];
  const lines = [
    ["Rank", "Player", ...cols.map((c) => c.head)].map(cell).join(","),
    ...table.rows.map(({ rank, entry }) =>
      [rank, entry.name, ...cols.map((c) => figure(c.value(entry)))]
        .map(cell)
        .join(","),
    ),
  ];
  return `${BOM}${lines.join("\r\n")}\r\n`;
}

/** "Unity Cricket Club – statistics 2026-10-25.csv" */
export function clubStatsFileName(
  clubName: string,
  extension: "csv" | "pdf",
  date: Date = new Date(),
  label = "statistics",
): string {
  const safe =
    clubName
      .replace(/[\\/:*?"<>|\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .trim() || "Club";
  return `${safe} – ${label} ${date.toISOString().slice(0, 10)}.${extension}`;
}
