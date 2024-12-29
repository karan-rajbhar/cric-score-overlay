export interface Player {
  id: string;
  name: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number;
  isStriker?: boolean;
}

export interface Bowler {
  id: string;
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
}

export interface Team {
  id: string;
  name: string;
  score: number;
  wickets: number;
  overs: number;
  runRate: number;
  players: Player[];
  bowlers: Bowler[];
}

export interface CricketMatch {
  id: string;
  team1: Team;
  team2: Team;
  currentInnings: 1 | 2;
  matchType: "T20" | "ODI" | "TEST";
  oversLimit?: number;
  target?: number;
  requiredRunRate?: number;
  lastBall?: string; // For ball-by-ball commentary
  currentOver: string[]; // Array of last 6 balls
  partnership: {
    runs: number;
    balls: number;
  };
}
