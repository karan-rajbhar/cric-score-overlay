"use server";

/**
 * Data for the overlay's tournament cards, loaded by the control room
 * (signed in as someone who may produce the match's overlay) and sent to
 * the overlay inside a `SET_SNAPSHOTS` command. Reads: the match, the
 * tournament's points table and its two teams' documents, the leaderboard
 * shards (8) and its next few fixtures.
 */

import type { OverlaySnapshots } from "~/components/overlay/types";
import { loadScopeLeaderboard } from "~/lib/firebase/leaderboards";
import { canProduceOverlay } from "~/lib/firebase/permissions";
import { createServerClient } from "~/lib/firebase/server";
import type { RosterEntry } from "~/lib/firebase/types";
import {
  leaderboardSnapshot,
  nextFixtureSnapshot,
  overlaySnapshots,
  pointsTableSnapshot,
  seriesSnapshot,
  type FixtureInput,
  type LeaderBoardKind,
  type StandingInput,
  type TeamInput,
} from "~/lib/overlay/snapshots";

type Result =
  | { data: OverlaySnapshots; error: null }
  | { data: null; error: string };

const MATCH_ID = /^[\w-]{1,128}$/;

export async function getOverlaySnapshots(
  matchId: string,
  board: LeaderBoardKind = "runs",
): Promise<Result> {
  try {
    if (typeof matchId !== "string" || !MATCH_ID.test(matchId)) {
      return { data: null, error: "Match not found" };
    }
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { data: null, error: "You must be logged in" };
    if (!(await canProduceOverlay(db, matchId, user.id))) {
      return { data: null, error: "Only this match's producers can do that" };
    }
    const { data: match } = await db
      .from("matches")
      .select("id, tournament_id, team1_id, team2_id")
      .eq("id", matchId)
      .single();
    if (!match) return { data: null, error: "Match not found" };
    if (!match.tournament_id) {
      return { data: null, error: "This match is not part of a tournament" };
    }
    const tournamentId = match.tournament_id as string;

    const [{ data: tournament }, { data: standings }, { data: fixtures }] =
      await Promise.all([
        db.from("tournaments").select("id, name").eq("id", tournamentId).single(),
        db
          .from("tournament_standings")
          .select("*")
          .eq("tournament_id", tournamentId)
          .order("points", { ascending: false })
          .order("net_run_rate", { ascending: false }),
        db
          .from("matches")
          .select("id, title, status, scheduled_at, venue, team1_snapshot, team2_snapshot")
          .eq("tournament_id", tournamentId)
          .gte("scheduled_at", new Date().toISOString())
          .order("scheduled_at", { ascending: true })
          .limit(5),
      ]);

    const teamIds = [
      ...new Set(
        [
          ...((standings ?? []) as StandingInput[]).map((s) => s.team_id),
          match.team1_id,
          match.team2_id,
        ].filter((id): id is string => !!id),
      ),
    ];
    const [{ data: teamDocs }, leaderboard] = await Promise.all([
      db.from("teams").select("id, name, short_name, logo_url, roster").in("id", teamIds),
      loadScopeLeaderboard(db, "tournament", tournamentId, []),
    ]);
    const teams = new Map<string, TeamInput & { roster?: RosterEntry[] }>(
      ((teamDocs ?? []) as (TeamInput & { roster?: RosterEntry[] })[]).map(
        (t) => [t.id, t],
      ),
    );
    const players = [match.team1_id, match.team2_id].flatMap((id) =>
      (teams.get(id as string)?.roster ?? [])
        .map((r) => r.user?.id ?? r.user_id)
        .filter((u): u is string => !!u),
    );

    return {
      data: overlaySnapshots({
        pointsTable: pointsTableSnapshot(
          (tournament?.name as string | undefined) ?? "Points table",
          (standings ?? []) as StandingInput[],
          teams,
          [match.team1_id, match.team2_id].filter(Boolean) as string[],
        ),
        leaderboard: leaderboardSnapshot(leaderboard, board),
        nextFixture: nextFixtureSnapshot(
          (fixtures ?? []) as FixtureInput[],
          matchId,
          new Date(),
        ),
        series: seriesSnapshot(leaderboard, players),
      }),
      error: null,
    };
  } catch (err) {
    console.error("overlay snapshots failed:", err);
    return { data: null, error: "Could not load the tournament data" };
  }
}
