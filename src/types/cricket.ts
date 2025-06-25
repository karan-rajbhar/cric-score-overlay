// Core cricket types
export interface Player {
  id: string;
  name: string;
  email?: string;
  avatar?: string;
  runs?: number;
  balls?: number;
  fours?: number;
  sixes?: number;
  strikeRate?: number;
  isStriker?: boolean;
  isOut?: boolean;
  dismissalType?: string;
}

export interface Bowler {
  id: string;
  name: string;
  overs: number;
  maidens: number;
  runs: number;
  wickets: number;
  economy: number;
  isCurrentBowler?: boolean;
}

export interface Team {
  id: string;
  name: string;
  shortName: string;
  logo?: string;
  score: number;
  wickets: number;
  overs: number;
  runRate: number;
  players: Player[];
  bowlers: Bowler[];
  extras: {
    wides: number;
    noBalls: number;
    byes: number;
    legByes: number;
    penalties: number;
  };
}

export interface CricketMatch {
  id: string;
  title: string;
  team1: Team;
  team2: Team;
  currentInnings: 1 | 2;
  matchType: "T20" | "ODI" | "TEST" | "T10";
  oversLimit?: number;
  target?: number;
  requiredRunRate?: number;
  lastBall?: string;
  currentOver: string[];
  partnership: {
    runs: number;
    balls: number;
  };
  status: "upcoming" | "live" | "completed" | "abandoned";
  venue?: string;
  startTime?: Date;
  endTime?: Date;
  tossWinner?: string;
  tossDecision?: "bat" | "bowl";
  result?: string;
  clubId?: string;
  tournamentId?: string;
}

export interface Club {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  location?: string;
  createdAt: Date;
  ownerId: string;
  memberCount: number;
  isActive: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  description?: string;
  format: "knockout" | "round-robin" | "league";
  matchType: "T20" | "ODI" | "TEST" | "T10";
  startDate: Date;
  endDate: Date;
  registrationDeadline: Date;
  maxTeams: number;
  entryFee?: number;
  prizePool?: number;
  status: "upcoming" | "registration" | "ongoing" | "completed";
  clubId: string;
  rules?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: "admin" | "scorer" | "player" | "viewer";
  createdAt: Date;
  lastActive?: Date;
  preferences: {
    notifications: boolean;
    theme: "light" | "dark";
    language: string;
  };
}

// Scoring events
export type ScoringEvent = 
  | { type: "runs"; runs: number; batsman: string; extras?: number }
  | { type: "wicket"; batsman: string; bowler: string; dismissalType: string }
  | { type: "wide"; runs: number }
  | { type: "no-ball"; runs: number }
  | { type: "bye"; runs: number }
  | { type: "leg-bye"; runs: number }
  | { type: "over-complete"; over: number }
  | { type: "innings-complete"; innings: number };

// Real-time update payload
export interface MatchUpdate {
  matchId: string;
  event: ScoringEvent;
  timestamp: Date;
  updatedBy: string;
  match: CricketMatch;
} 