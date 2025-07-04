import { createTRPCRouter } from "~/server/api/trpc";
import { matchesRouter } from "~/server/api/routers/matches";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  matches: matchesRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter; 