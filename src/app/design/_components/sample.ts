/*
 * Made-up clubs and players for the design reference. One consistent story:
 * a Summer League T20 where Hilltop Hawks are chasing Riverside's 168.
 */
import { CalendarDays, Home, Search, Trophy, User } from "lucide-react";
import type { TabBarItem } from "~/components/ds/app-bar";
import type { BallKind } from "~/components/ds/ball";
import type { InningsRef, TeamRef } from "~/components/ds/score";
import type { StandingRow } from "~/components/ds/standings";

/* A stand-in uploaded logo: a navy shield with a white monogram. */
export const SAMPLE_LOGO = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><path d="M32 4 56 12v18c0 15-10 26-24 30C18 56 8 45 8 30V12z" fill="#23226A"/><text x="32" y="40" font-family="Arial" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">CC</text></svg>',
)}`;

export const TEAMS = {
  riverside: { name: "Riverside Warriors", shortName: "RIV" },
  hilltop: { name: "Hilltop Hawks", shortName: "HIL" },
  bay: { name: "Bay Strikers", shortName: "BAY" },
  oldTown: { name: "Old Town CC", shortName: "OTC" },
  northfield: { name: "Northfield", shortName: "NOR" },
  eastside: { name: "Eastside Eagles", shortName: "EAS" },
} satisfies Record<string, TeamRef>;

export const LIVE = {
  competition: "Summer League · Match 12",
  format: "T20",
  first: {
    team: TEAMS.riverside,
    innings: { runs: 168, wickets: 6, overs: "20" },
  },
  second: {
    team: TEAMS.hilltop,
    innings: { runs: 142, wickets: 4, overs: "16.3" },
  },
  note: "Hilltop Hawks need 27 runs from 21 balls",
  target: "Target 169",
  rates: { current: "8.61", required: "7.71" },
} satisfies {
  competition: string;
  format: string;
  first: { team: TeamRef; innings: InningsRef };
  second: { team: TeamRef; innings: InningsRef };
  note: string;
  target: string;
  rates: { current: string; required: string };
};

export const THIS_OVER: { kind: BallKind; label: string }[] = [
  { kind: "run", label: "1" },
  { kind: "dot", label: "0" },
  { kind: "four", label: "4" },
];

export const LAST_OVER: { kind: BallKind; label: string }[] = [
  { kind: "run", label: "2" },
  { kind: "extra", label: "1wd" },
  { kind: "dot", label: "0" },
  { kind: "wicket", label: "W" },
  { kind: "six", label: "6" },
  { kind: "run", label: "1" },
  { kind: "extra", label: "2lb" },
];

export const CREASE = {
  striker: "Arjun Mehta",
  batters: [
    {
      name: "Arjun Mehta",
      runs: 58,
      balls: 41,
      fours: 5,
      sixes: 2,
      strikeRate: "141.5",
    },
    {
      name: "Kabir Shah",
      runs: 12,
      balls: 9,
      fours: 1,
      sixes: 0,
      strikeRate: "133.3",
    },
  ],
  bowler: {
    name: "Imran Qureshi",
    overs: "2.3",
    maidens: 0,
    runs: 19,
    wickets: 1,
    economy: "7.60",
  },
};

export const RESULT = {
  competition: "Summer League · Match 11",
  first: { team: TEAMS.bay, innings: { runs: 151, wickets: 8, overs: "20" } },
  second: {
    team: TEAMS.oldTown,
    innings: { runs: 152, wickets: 5, overs: "18.4" },
  },
  note: "Old Town CC won by 5 wickets (8 balls left)",
};

export const FIXTURE = {
  competition: "Summer League",
  stage: "Match 14",
  date: "Saturday 25 October",
  time: "9:30 am",
  home: TEAMS.northfield,
  away: TEAMS.eastside,
  venue: "Central Park Ground",
};

export const BATTING = {
  title: "Riverside Warriors innings",
  score: "168/6 (20 ov)",
  rows: [
    {
      name: "Rohan Iyer",
      dismissal: "c Mehta b Qureshi",
      runs: 34,
      balls: 26,
      fours: 4,
      sixes: 1,
      strikeRate: "130.8",
    },
    {
      name: "Sameer Khan",
      dismissal: "b Rao",
      runs: 8,
      balls: 10,
      fours: 1,
      sixes: 0,
      strikeRate: "80.0",
    },
    {
      name: "Aditya Joshi",
      dismissal: "lbw b Bhat",
      runs: 52,
      balls: 35,
      fours: 5,
      sixes: 2,
      strikeRate: "148.6",
    },
    {
      name: "Vikram Nair",
      dismissal: "run out (Sethi)",
      runs: 27,
      balls: 18,
      fours: 2,
      sixes: 1,
      strikeRate: "150.0",
    },
    {
      name: "Rahul Desai",
      dismissal: "c Shah b Qureshi",
      runs: 19,
      balls: 12,
      fours: 2,
      sixes: 1,
      strikeRate: "158.3",
    },
    {
      name: "Karthik Menon",
      dismissal: "st Sethi b Rao",
      runs: 6,
      balls: 6,
      fours: 0,
      sixes: 0,
      strikeRate: "100.0",
    },
    {
      name: "Yash Kulkarni",
      dismissal: "not out",
      notOut: true,
      runs: 9,
      balls: 7,
      fours: 1,
      sixes: 0,
      strikeRate: "128.6",
    },
    {
      name: "Om Prakash",
      dismissal: "not out",
      notOut: true,
      runs: 4,
      balls: 6,
      fours: 0,
      sixes: 0,
      strikeRate: "66.7",
    },
  ],
  extras: { total: 9, detail: "(b 1, lb 2, w 5, nb 1)" },
  total: { label: "168/6 (20 ov)", runRate: "8.40" },
  didNotBat: ["Tanmay Ghosh", "Ishaan Pillai", "Varun Saxena"],
};

export const BOWLING = {
  title: "Hilltop Hawks bowling",
  rows: [
    {
      name: "Imran Qureshi",
      overs: "4",
      maidens: 0,
      runs: 31,
      wickets: 2,
      economy: "7.75",
    },
    {
      name: "Nikhil Rao",
      overs: "4",
      maidens: 0,
      runs: 28,
      wickets: 2,
      economy: "7.00",
    },
    {
      name: "Dhruv Bhat",
      overs: "4",
      maidens: 1,
      runs: 30,
      wickets: 1,
      economy: "7.50",
    },
    {
      name: "Arjun Mehta",
      overs: "4",
      maidens: 0,
      runs: 41,
      wickets: 0,
      economy: "10.25",
    },
    {
      name: "Kabir Shah",
      overs: "4",
      maidens: 0,
      runs: 35,
      wickets: 0,
      economy: "8.75",
    },
  ],
};

export const FALL_OF_WICKETS = [
  { score: "1-21", name: "Sameer Khan", over: "3.1" },
  { score: "2-63", name: "Rohan Iyer", over: "8.2" },
  { score: "3-104", name: "Vikram Nair", over: "12.4" },
  { score: "4-131", name: "Rahul Desai", over: "15.3" },
  { score: "5-140", name: "Karthik Menon", over: "16.4" },
  { score: "6-152", name: "Aditya Joshi", over: "18.1" },
];

export const STANDINGS: StandingRow[] = [
  {
    team: TEAMS.oldTown,
    played: 6,
    won: 5,
    lost: 1,
    noResult: 0,
    points: 10,
    netRunRate: "+1.204",
  },
  {
    team: TEAMS.riverside,
    played: 6,
    won: 4,
    lost: 2,
    noResult: 0,
    points: 8,
    netRunRate: "+0.655",
  },
  {
    team: TEAMS.hilltop,
    played: 6,
    won: 3,
    lost: 2,
    noResult: 1,
    points: 7,
    netRunRate: "+0.112",
  },
  {
    team: TEAMS.bay,
    played: 6,
    won: 3,
    lost: 3,
    noResult: 0,
    points: 6,
    netRunRate: "−0.087",
  },
  {
    team: TEAMS.northfield,
    played: 6,
    won: 2,
    lost: 4,
    noResult: 0,
    points: 4,
    netRunRate: "−0.540",
  },
  {
    team: TEAMS.eastside,
    played: 6,
    won: 0,
    lost: 5,
    noResult: 1,
    points: 1,
    netRunRate: "−1.390",
  },
];

export const TOP_RUNS = [
  {
    name: "Aditya Joshi",
    team: "Riverside Warriors",
    value: 312,
    detail: "6 inns · SR 141.8",
  },
  {
    name: "Arjun Mehta",
    team: "Hilltop Hawks",
    value: 287,
    detail: "6 inns · SR 136.6",
  },
  {
    name: "Farhan Ali",
    team: "Old Town CC",
    value: 254,
    detail: "5 inns · SR 128.3",
  },
  {
    name: "Rohan Iyer",
    team: "Riverside Warriors",
    value: 231,
    detail: "6 inns · SR 131.2",
  },
  {
    name: "Neel Bhatt",
    team: "Bay Strikers",
    value: 198,
    detail: "6 inns · SR 119.3",
  },
];

export const PLAYER = {
  name: "Aditya Joshi",
  role: "Batter",
  detail: "Right-hand bat · Right-arm off break",
  team: TEAMS.riverside,
  stats: [
    { label: "Matches", value: "24" },
    { label: "Runs", value: "812" },
    { label: "Average", value: "38.7" },
    { label: "Strike rate", value: "139.4" },
    { label: "Highest", value: "88*" },
    { label: "50s", value: "6" },
    { label: "Wickets", value: "7" },
    { label: "Catches", value: "11" },
  ],
};

export const LIVE_2 = {
  competition: "Spring Cup",
  stage: "Semi-final",
  batting: {
    team: TEAMS.bay,
    innings: { runs: 96, wickets: 3, overs: "11.2" },
  },
  bowling: { team: TEAMS.northfield },
  note: "Bay Strikers chose to bat · CRR 8.47",
};

/** Top performers under each side on the match page (like scorers). */
export const PERFORMERS = {
  first: ["Joshi 52 (35)", "Qureshi 2/31"],
  second: ["Mehta 58* (41)", "Desai 1/24"],
};

/** Percentile among Summer League batters (100 = best), with the figure. */
export const PLAYER_METERS = [
  { label: "Runs", value: 91, display: "812" },
  { label: "Strike rate", value: 82, display: "139.4" },
  { label: "Average", value: 76, display: "38.7" },
  { label: "Balls per boundary", value: 64, display: "6.1" },
];

/** The phone tab bar: Home is the current tab in the examples. */
export const TAB_BAR_ITEMS: TabBarItem[] = [
  { href: "#screens", label: "Home", icon: Home, active: true },
  { href: "#screens", label: "Matches", icon: CalendarDays },
  { href: "#screens", label: "Tournaments", icon: Trophy },
  { href: "#screens", label: "Search", icon: Search },
  { href: "#screens", label: "Profile", icon: User },
];
