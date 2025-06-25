import { z } from "zod";
import { createTRPCRouter, publicProcedure, protectedProcedure } from "~/server/api/trpc";
import { TRPCError } from "@trpc/server";
import type { CricketMatch, ScoringEvent } from "~/types/cricket";

// Input schemas
const createMatchSchema = z.object({
  title: z.string().min(1),
  team1Name: z.string().min(1),
  team2Name: z.string().min(1),
  matchType: z.enum(["T20", "ODI", "TEST", "T10"]),
  venue: z.string().optional(),
  startTime: z.date().optional(),
  clubId: z.string().optional(),
  tournamentId: z.string().optional(),
});

const scoringEventSchema = z.object({
  matchId: z.string(),
  event: z.union([
    z.object({
      type: z.literal("runs"),
      runs: z.number().min(0).max(6),
      batsman: z.string(),
      extras: z.number().optional(),
    }),
    z.object({
      type: z.literal("wicket"),
      batsman: z.string(),
      bowler: z.string(),
      dismissalType: z.string(),
    }),
    z.object({
      type: z.literal("wide"),
      runs: z.number().min(1),
    }),
    z.object({
      type: z.literal("no-ball"),
      runs: z.number().min(1),
    }),
    z.object({
      type: z.literal("bye"),
      runs: z.number().min(1),
    }),
    z.object({
      type: z.literal("leg-bye"),
      runs: z.number().min(1),
    }),
  ]),
});

export const matchesRouter = createTRPCRouter({
  // Get all matches
  getAll: publicProcedure
    .input(
      z.object({
        status: z.enum(["upcoming", "live", "completed", "abandoned"]).optional(),
        clubId: z.string().optional(),
        tournamentId: z.string().optional(),
        limit: z.number().min(1).max(100).default(10),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      // TODO: Implement with actual database queries
      const mockMatches: CricketMatch[] = [
        {
          id: "1",
          title: "Mumbai Indians vs Chennai Super Kings",
          team1: {
            id: "team1",
            name: "Mumbai Indians",
            shortName: "MI",
            score: 185,
            wickets: 6,
            overs: 20,
            runRate: 9.25,
            players: [],
            bowlers: [],
            extras: { wides: 5, noBalls: 2, byes: 3, legByes: 1, penalties: 0 },
          },
          team2: {
            id: "team2", 
            name: "Chennai Super Kings",
            shortName: "CSK",
            score: 165,
            wickets: 8,
            overs: 20,
            runRate: 8.25,
            players: [],
            bowlers: [],
            extras: { wides: 8, noBalls: 1, byes: 2, legByes: 4, penalties: 0 },
          },
          currentInnings: 2,
          matchType: "T20",
          oversLimit: 20,
          target: 186,
          requiredRunRate: 12.5,
          currentOver: ["1", "4", "6", "W", "2"],
          partnership: { runs: 45, balls: 32 },
          status: "live",
          venue: "Wankhede Stadium",
          startTime: new Date(),
        },
      ];
      
      return {
        matches: mockMatches,
        total: mockMatches.length,
      };
    }),

  // Get match by ID
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      // TODO: Implement with actual database query
      const mockMatch: CricketMatch = {
        id: input.id,
        title: "Mumbai Indians vs Chennai Super Kings",
        team1: {
          id: "team1",
          name: "Mumbai Indians",
          shortName: "MI",
          score: 185,
          wickets: 6,
          overs: 20,
          runRate: 9.25,
          players: [
            {
              id: "p1",
              name: "Rohit Sharma",
              runs: 45,
              balls: 32,
              fours: 4,
              sixes: 2,
              strikeRate: 140.6,
              isStriker: true,
            },
            {
              id: "p2",
              name: "Ishan Kishan",
              runs: 28,
              balls: 22,
              fours: 3,
              sixes: 1,
              strikeRate: 127.3,
              isStriker: false,
            },
          ],
          bowlers: [],
          extras: { wides: 5, noBalls: 2, byes: 3, legByes: 1, penalties: 0 },
        },
        team2: {
          id: "team2",
          name: "Chennai Super Kings", 
          shortName: "CSK",
          score: 165,
          wickets: 8,
          overs: 20,
          runRate: 8.25,
          players: [],
          bowlers: [
            {
              id: "b1",
              name: "Deepak Chahar",
              overs: 4,
              maidens: 0,
              runs: 32,
              wickets: 2,
              economy: 8.0,
              isCurrentBowler: true,
            },
          ],
          extras: { wides: 8, noBalls: 1, byes: 2, legByes: 4, penalties: 0 },
        },
        currentInnings: 2,
        matchType: "T20",
        oversLimit: 20,
        target: 186,
        requiredRunRate: 12.5,
        currentOver: ["1", "4", "6", "W", "2"],
        partnership: { runs: 45, balls: 32 },
        status: "live",
        venue: "Wankhede Stadium",
        startTime: new Date(),
      };
      
      return mockMatch;
    }),

  // Create new match
  create: protectedProcedure
    .input(createMatchSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement with actual database insertion
      const newMatch: CricketMatch = {
        id: `match_${Date.now()}`,
        title: input.title,
        team1: {
          id: `team1_${Date.now()}`,
          name: input.team1Name,
          shortName: input.team1Name.substring(0, 3).toUpperCase(),
          score: 0,
          wickets: 0,
          overs: 0,
          runRate: 0,
          players: [],
          bowlers: [],
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
        },
        team2: {
          id: `team2_${Date.now()}`,
          name: input.team2Name,
          shortName: input.team2Name.substring(0, 3).toUpperCase(),
          score: 0,
          wickets: 0,
          overs: 0,
          runRate: 0,
          players: [],
          bowlers: [],
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
        },
        currentInnings: 1,
        matchType: input.matchType,
        oversLimit: input.matchType === "T20" ? 20 : input.matchType === "T10" ? 10 : 50,
        currentOver: [],
        partnership: { runs: 0, balls: 0 },
        status: "upcoming",
        venue: input.venue,
        startTime: input.startTime,
        clubId: input.clubId,
        tournamentId: input.tournamentId,
      };
      
      return newMatch;
    }),

  // Update match score
  updateScore: protectedProcedure
    .input(scoringEventSchema)
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement actual scoring logic with database updates
      // This is where the real-time scoring magic happens
      
      // For now, return a mock updated match
      const updatedMatch: CricketMatch = {
        id: input.matchId,
        title: "Updated Match",
        team1: {
          id: "team1",
          name: "Team 1",
          shortName: "T1",
          score: 150,
          wickets: 4,
          overs: 15.3,
          runRate: 9.68,
          players: [],
          bowlers: [],
          extras: { wides: 5, noBalls: 2, byes: 3, legByes: 1, penalties: 0 },
        },
        team2: {
          id: "team2",
          name: "Team 2", 
          shortName: "T2",
          score: 0,
          wickets: 0,
          overs: 0,
          runRate: 0,
          players: [],
          bowlers: [],
          extras: { wides: 0, noBalls: 0, byes: 0, legByes: 0, penalties: 0 },
        },
        currentInnings: 1,
        matchType: "T20",
        oversLimit: 20,
        currentOver: ["1", "4", "6"],
        partnership: { runs: 35, balls: 24 },
        status: "live",
      };
      
      return {
        success: true,
        match: updatedMatch,
        event: input.event,
      };
    }),

  // Start match
  start: protectedProcedure
    .input(z.object({ matchId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement match start logic
      return { success: true, message: "Match started successfully" };
    }),

  // End match
  end: protectedProcedure
    .input(z.object({ 
      matchId: z.string(),
      result: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      // TODO: Implement match end logic
      return { success: true, message: "Match ended successfully" };
    }),

  // Get live matches (for real-time updates)
  getLiveMatches: publicProcedure
    .query(async ({ ctx }) => {
      // TODO: Implement with actual database query
      return [];
    }),
}); 