"use server";

import { revalidatePath } from "next/cache";
import { prefixSearch } from "~/lib/firebase/search";
import { createServerClient } from "~/lib/firebase/server";
import { isClubAdminOf } from "~/lib/firebase/permissions";
import { refreshLiveState } from "~/lib/firebase/live-sync";
import {
  inningsEndEventOf,
  matchEventOf,
  notifyFollowersAfter,
  progressEventOf,
  type MatchProgress,
} from "~/lib/push/notify";
import { ensureUserProfile } from "~/lib/firebase/user-profile";
import { teamSnapshot } from "~/lib/firebase/team-snapshot";
import { isClubSide } from "~/lib/firebase/derive.mjs";
import { isSuperOverInnings } from "~/lib/firebase/scoring/result";
import type { ClubSide, DlsRevision } from "~/lib/firebase/types";
import { refreshLiveMatchesFor } from "~/lib/firebase/live-sync";
import { invalidateMatchCache } from "~/lib/match-cache";
import { afterDeleteHref } from "~/lib/match-delete";
import type { DeleteMatchResult } from "~/lib/firebase/rpc/delete-match";
import { friendlyError } from "./errors";
import type {
  BallEvent,
  MatchFormData,
  ScoringState,
  ExtraType,
  NoBallRuns,
} from "./types";
import { getMatch } from "./queries";
import { calculatePlayerOfTheMatch } from "~/lib/cricket";
import type { Match } from "~/lib/match-types";
import type { ScoringDelta } from "~/lib/scoring-delta";

export async function createMatch(formData: MatchFormData) {
  const db = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { data: null, error: "You must be logged in to create a match" };
  }

  await ensureUserProfile(db, user);

  if (!formData.team1Id || !formData.team2Id) {
    return { data: null, error: "Both Team 1 and Team 2 must be selected" };
  }
  if (formData.team1Id === formData.team2Id) {
    return { data: null, error: "Team 1 and Team 2 must be different teams" };
  }
  if (
    !Number.isInteger(formData.oversPerInnings) ||
    formData.oversPerInnings < 1
  ) {
    return { data: null, error: "Overs per innings must be at least 1" };
  }
  if (
    formData.ballsPerOver !== undefined &&
    (!Number.isInteger(formData.ballsPerOver) ||
      formData.ballsPerOver < 2 ||
      formData.ballsPerOver > 12)
  ) {
    return { data: null, error: "Balls per over must be between 2 and 12" };
  }
  if (formData.clubSide !== undefined && !isClubSide(formData.clubSide)) {
    return { data: null, error: "Choose which side plays for the club" };
  }
  if (
    formData.wicketsPerInnings !== undefined &&
    (!Number.isInteger(formData.wicketsPerInnings) ||
      formData.wicketsPerInnings < 1 ||
      formData.wicketsPerInnings > 15)
  ) {
    return { data: null, error: "Wickets must be between 1 and 15" };
  }

  // Parallel fetch of Team 1, Team 2, and optional tournament/registration context
  const [
    teamsRes,
    tournamentRes,
    playerMembershipsRes,
    tournRegsRes,
  ] = await Promise.all([
    db
      .from("teams")
      .select(
        "id, name, short_name, logo_url, primary_color, secondary_color, created_by, captain_id, vice_captain_id, club_id",
      )
      .in("id", [formData.team1Id, formData.team2Id]),
    formData.tournamentId
      ? db
          .from("tournaments")
          .select(
            "id, created_by, club_id, season_id, last_man_stands, golden_ball",
          )
          .eq("id", formData.tournamentId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    db
      .from("team_players")
      .select("team_id")
      .eq("user_id", user.id)
      .in("team_id", [formData.team1Id, formData.team2Id]),
    formData.tournamentId
      ? db
          .from("tournament_registrations")
          .select("team_id, status")
          .eq("tournament_id", formData.tournamentId)
          .in("team_id", [formData.team1Id, formData.team2Id])
      : Promise.resolve({ data: null, error: null }),
  ]);

  const teams = teamsRes.data ?? [];
  const team1 = teams.find((t) => t.id === formData.team1Id);
  const team2 = teams.find((t) => t.id === formData.team2Id);

  if (!team1) {
    return { data: null, error: "Selected Team 1 does not exist" };
  }
  if (!team2) {
    return { data: null, error: "Selected opponent team does not exist" };
  }

  // A tournament match counts for the tournament's club and season and
  // plays its special rules, whatever the form sent (as its generated
  // fixtures do).
  const tournament = formData.tournamentId ? tournamentRes.data : null;
  const clubId = formData.tournamentId
    ? (tournament?.club_id ?? null)
    : formData.clubId || null;

  // Collect relevant club IDs to check admin / ownership in one batch
  const relevantClubIds = Array.from(
    new Set(
      [team1.club_id, team2.club_id, clubId].filter((id): id is string =>
        Boolean(id),
      ),
    ),
  );

  const [clubsRes, clubMembershipsRes] =
    relevantClubIds.length > 0
      ? await Promise.all([
          db
            .from("clubs")
            .select("id, owner_id")
            .in("id", relevantClubIds),
          db
            .from("club_memberships")
            .select("club_id")
            .eq("user_id", user.id)
            .in("club_id", relevantClubIds)
            .in("role", ["owner", "admin"])
            .eq("status", "active"),
        ])
      : [{ data: [] }, { data: [] }];

  const adminClubIds = new Set<string>();
  for (const c of clubsRes.data ?? []) {
    if (c.owner_id === user.id) adminClubIds.add(c.id);
  }
  for (const m of clubMembershipsRes.data ?? []) {
    if (m.club_id) adminClubIds.add(m.club_id);
  }
  const isClubAdmin = (clubId?: string | null) =>
    Boolean(clubId && adminClubIds.has(clubId));

  const myTeamIds = new Set(
    (playerMembershipsRes.data ?? [])
      .map((p) => p.team_id)
      .filter((id): id is string => Boolean(id)),
  );

  // Authorization check for Team 1
  const isTeam1Mine =
    team1.created_by === user.id ||
    team1.captain_id === user.id ||
    team1.vice_captain_id === user.id;

  const isTournamentAdmin = Boolean(
    tournament &&
      (tournament.created_by === user.id || isClubAdmin(tournament.club_id)),
  );

  const isAuthorized =
    isTeam1Mine ||
    myTeamIds.has(team1.id) ||
    isClubAdmin(team1.club_id) ||
    isTournamentAdmin;

  if (!isAuthorized) {
    return {
      data: null,
      error:
        "You do not have permission to create matches for Team 1. You must be an owner, captain, or squad member of Team 1, or an administrator of the linked club or tournament.",
    };
  }

  // Validate tournamentId association if provided
  if (formData.tournamentId) {
    if (!tournament) {
      return { data: null, error: "Selected tournament does not exist" };
    }

    // Only confirmed teams play: a request still waiting does not count.
    const registeredTeamIds = new Set(
      (tournRegsRes.data ?? [])
        .filter((r) => r.status === "confirmed")
        .map((r) => r.team_id),
    );

    if (!registeredTeamIds.has(formData.team2Id)) {
      return {
        data: null,
        error: "The selected opponent team is not registered in this tournament.",
      };
    }

    // Only organisers may bring in a host side the tournament has not
    // confirmed: the match counts in its points table.
    if (!isTournamentAdmin && !registeredTeamIds.has(formData.team1Id)) {
      return {
        data: null,
        error: "Team 1 is not registered in this tournament.",
      };
    }
  }

  // Validate the club chosen for a match outside a tournament
  if (!formData.tournamentId && clubId) {
    const club = (clubsRes.data ?? []).find((c) => c.id === clubId);
    if (!club) {
      return { data: null, error: "Selected club does not exist" };
    }

    if (!isClubAdmin(clubId) && team1.club_id !== clubId) {
      return {
        data: null,
        error:
          "You can only link matches to a club you manage or that your team belongs to.",
      };
    }
  }

  // Validate Team 2 (Opponent) eligibility under Option 1
  if (!formData.tournamentId) {
    if (clubId) {
      const isTeam2InClub = team2.club_id === clubId;
      const isTeam2Mine =
        team2.created_by === user.id ||
        team2.captain_id === user.id ||
        team2.vice_captain_id === user.id;

      if (!isTeam2InClub && !isTeam2Mine) {
        return {
          data: null,
          error:
            "For club matches, the opponent team must belong to the club or be a squad you manage.",
        };
      }
    } else {
      // Independent match: opponent must be managed/created by user
      const isTeam2Authorized =
        team2.created_by === user.id ||
        team2.captain_id === user.id ||
        team2.vice_captain_id === user.id ||
        isClubAdmin(team2.club_id) ||
        myTeamIds.has(formData.team2Id);

      if (!isTeam2Authorized) {
        return {
          data: null,
          error:
            "You can only select an opponent team you manage, or create a new opponent team for this match. You cannot schedule matches against other clubs' official teams without authorization.",
        };
      }
    }
  }

  const { data: match, error: matchError } = await db
    .from("matches")
    .insert({
      title: formData.title?.trim() || `${team1.name} vs ${team2.name}`,
      match_format: formData.matchFormat,
      overs_per_innings: formData.oversPerInnings,
      balls_per_over: formData.ballsPerOver ?? 6,
      max_balls_per_over: formData.maxBallsPerOver ?? null,
      wide_counts_as_ball_faced: formData.wideCountsAsBallFaced ?? false,
      wide_runs_to_batsman: formData.wideRunsToBatsman ?? false,
      noball_extras_to_batsman: formData.noballExtrasToBatsman ?? false,
      team1_id: formData.team1Id,
      team2_id: formData.team2Id,
      team1_snapshot: teamSnapshot(team1),
      team2_snapshot: teamSnapshot(team2),
      venue: formData.venue,
      scheduled_at: formData.scheduledAt,
      umpire1_name: formData.umpire1Name,
      umpire2_name: formData.umpire2Name,
      club_id: clubId,
      // Only a club match has sides that count for a club; "both" is the
      // default, so it is not stored.
      club_side:
        clubId && formData.clubSide && formData.clubSide !== "both"
          ? formData.clubSide
          : null,
      tournament_id: formData.tournamentId,
      wickets_per_innings: formData.wicketsPerInnings ?? 10,
      ...(tournament
        ? {
            season_id: tournament.season_id ?? null,
            last_man_stands: tournament.last_man_stands ?? false,
            golden_ball: tournament.golden_ball ?? false,
          }
        : {
            season_id: formData.seasonId,
            last_man_stands: formData.lastManStands ?? false,
            golden_ball: formData.goldenBall ?? false,
          }),
      created_by: user.id,
      match_admins: [user.id],
      status: "scheduled",
    })
    .select()
    .single();
  if (matchError) {
    console.error("Error creating match:", matchError);
    return { data: null, error: matchError.message };
  }
  revalidatePath("/matches");
  return { data: match, error: null };
}

async function checkMatchAdminAuth(
  db: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
  userId: string,
): Promise<boolean> {
  return (await matchAdminCheck(db, matchId, userId)).allowed;
}

/**
 * checkMatchAdminAuth, also answering where the match stood (from the same
 * read), so an action can tell what it changed (`progressEventOf`).
 */
async function matchAdminCheck(
  db: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
  userId: string,
): Promise<{ allowed: boolean; match: MatchProgress | null }> {
  const { data: match } = await db
    .from("matches")
    .select(
      "created_by, match_admins, club_id, tournament_id, status, current_innings",
    )
    .eq("id", matchId)
    .single();
  if (!match) return { allowed: false, match: null };
  return { allowed: await isAdminOfMatch(db, match, userId), match };
}

/**
 * What a finished match needs however it finished (a delivery, End
 * innings, an edit, penalty runs, a retirement): its tournament and club
 * pages revalidated and the automatic player of the match. Never fails the
 * action that finished it.
 */
async function afterMatchCompleted(
  db: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
): Promise<void> {
  try {
    const { data: matchData } = await db
      .from("matches")
      .select("tournament_id, club_id")
      .eq("id", matchId)
      .single();
    if (matchData?.tournament_id) {
      revalidatePath(`/tournaments/${matchData.tournament_id}`);
      revalidatePath("/tournaments");
    }
    if (matchData?.club_id) {
      revalidatePath(`/clubs/${matchData.club_id}`);
      revalidatePath("/clubs");
    }
    await autoAssignPlayerOfTheMatch(matchId);
  } catch (err) {
    console.error("After the match completed:", err);
  }
}

/**
 * What an action other than a delivery changed (an edit, penalty runs, a
 * retirement), handled as `recordBall` handles a delivery: followers hear
 * about the result or the innings break, and a match it finished gets
 * `afterMatchCompleted`.
 */
async function settleProgress(
  db: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
  before: MatchProgress | null,
  after: MatchProgress | null | undefined,
): Promise<void> {
  const progress = progressEventOf(before, after);
  if (!progress) return;
  notifyFollowersAfter(matchId, progress.event, progress.state);
  if (progress.event === "result") await afterMatchCompleted(db, matchId);
}

/**
 * settleProgress for an action answered with the committed documents: the
 * match as committed, read again only when the reply could not carry it.
 * Never fails the action.
 */
async function settleProgressAfterEvent(
  db: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
  before: MatchProgress | null,
  reply: { delta: ScoringDelta | null } | null,
): Promise<void> {
  if (!before || before.status === "completed") return;
  try {
    let after: MatchProgress | null = reply?.delta?.match ?? null;
    if (!after) {
      const { data } = await db
        .from("matches")
        .select("status, current_innings, result_description")
        .eq("id", matchId)
        .single();
      after = data;
    }
    await settleProgress(db, matchId, before, after);
  } catch (err) {
    console.error("Could not settle the change:", err);
  }
}

async function isAdminOfMatch(
  db: Awaited<ReturnType<typeof createServerClient>>,
  match: {
    created_by?: string | null;
    match_admins?: string[] | null;
    club_id?: string | null;
    tournament_id?: string | null;
  },
  userId: string,
): Promise<boolean> {
  if (match.created_by === userId) return true;
  if ((match.match_admins ?? []).includes(userId)) return true;

  const checks: Promise<boolean>[] = [];

  if (match.club_id) {
    checks.push(isClubAdminOf(db, match.club_id, userId));
  }

  if (match.tournament_id) {
    checks.push(
      (async () => {
        const { data: tournament } = await db
          .from("tournaments")
          .select("created_by, club_id")
          .eq("id", match.tournament_id)
          .single();

        if (tournament?.created_by === userId) return true;
        return isClubAdminOf(db, tournament?.club_id, userId);
      })(),
    );
  }

  if (checks.length > 0) {
    const results = await Promise.all(checks);
    return results.some(Boolean);
  }

  return false;
}

/**
 * Innings 1 of a match being started. When it is there already, either
 * another scorer started the match (refused) or an earlier start stopped
 * before writing the match, whose innings this one takes over.
 */
async function openFirstInnings(
  db: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
  battingTeamId: string,
): Promise<{ innings: Record<string, unknown> } | { error: string }> {
  const { data, error } = await db
    .from("innings")
    .insert({ match_id: matchId, team_id: battingTeamId, innings_number: 1 })
    .select()
    .single();
  if (!error) return { innings: data };
  const { data: match } = await db
    .from("matches")
    .select("status")
    .eq("id", matchId)
    .single();
  if (match?.status !== "scheduled") {
    return { error: "This match has already started" };
  }
  const { data: leftover } = await db
    .from("innings")
    .update({ team_id: battingTeamId })
    .eq("match_id", matchId)
    .eq("innings_number", 1)
    .select()
    .single();
  return leftover
    ? { innings: leftover }
    : { error: friendlyError(error.message) };
}

/** The side the toss sends in to bat, for a match still to start. */
function battingSideOf(
  match: { status: string | null; team1_id: string; team2_id: string },
  tossWinnerId: string,
  tossDecision: "bat" | "bowl",
): string | { error: string } {
  if (match.status !== "scheduled") {
    return { error: "This match has already started" };
  }
  if (tossWinnerId !== match.team1_id && tossWinnerId !== match.team2_id) {
    return { error: "Choose the team that won the toss" };
  }
  if (tossDecision === "bat") return tossWinnerId;
  return tossWinnerId === match.team1_id ? match.team2_id : match.team1_id;
}

export async function startMatch(
  matchId: string,
  tossWinnerId: string,
  tossDecision: "bat" | "bowl",
) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return { data: null, error: "You must be logged in to start the match" };
  }

  const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
  if (!isMatchAdmin) {
    return {
      data: null,
      error: "Only match administrators or scorers can start this match",
    };
  }

  const { data: match, error: matchError } = await db
    .from("matches")
    .select("status, team1_id, team2_id")
    .eq("id", matchId)
    .single();
  if (matchError || !match) {
    return { data: null, error: "Match not found" };
  }
  const battingTeamId = battingSideOf(match, tossWinnerId, tossDecision);
  if (typeof battingTeamId !== "string") {
    return { data: null, error: battingTeamId.error };
  }
  // The innings first: a start that fails there leaves the match as it was.
  const opened = await openFirstInnings(db, matchId, battingTeamId);
  if ("error" in opened) return { data: null, error: opened.error };
  const innings = opened.innings;
  const { error: updateError } = await db
    .from("matches")
    .update({
      status: "live",
      toss_winner_team_id: tossWinnerId,
      toss_decision: tossDecision,
      actual_start_time: new Date().toISOString(),
      current_innings: 1,
      current_over: 0,
      current_ball: 0,
    })
    .eq("id", matchId);
  if (updateError) {
    return { data: null, error: friendlyError(updateError.message) };
  }
  await refreshLiveState(db, matchId);
  notifyFollowersAfter(matchId, "started");
  invalidateMatchCache(matchId);
  revalidatePath(`/matches/${matchId}`);
  return { data: { match, innings }, error: null };
}

export async function recordBall(params: {
  matchId: string;
  bowlerId: string;
  batsmanId: string;
  nonStrikerId: string;
  event: BallEvent;
  /** Idempotency key (offline queue id): a replay is not recorded twice. */
  clientActionId?: string | null;
}): Promise<{
  data: ScoringState | null;
  error: string | null;
  /** The committed documents, for the scoring screen (see scoring-delta). */
  delta?: ScoringDelta | null;
}> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to record scores" };
    }

    // record_ball checks scoring rights inside its transaction (same rule as
    // checkMatchAdminAuth, from the match it already reads), so checking here
    // too would only cost an extra read per ball.
    const { data: reply, error } = await db.rpc<{
      result: ScoringState;
      delta: ScoringDelta | null;
    }>("record_ball", {
      p_with_delta: true,
      p_match_id: params.matchId,
      p_bowler_id: params.bowlerId,
      p_batsman_id: params.batsmanId,
      p_non_striker_id: params.nonStrikerId,
      p_runs_scored: params.event.runsScored ?? 0,
      p_extras: params.event.extras ?? 0,
      p_extra_type: params.event.extraType ?? null,
      p_is_wicket: params.event.isWicket ?? false,
      p_dismissal_type: params.event.dismissalType ?? null,
      p_fielder_id: params.event.fielderId ?? null,
      p_commentary: params.event.commentary ?? null,
      p_dismissed_player_id: params.event.dismissedPlayerId ?? null,
      p_shot_zone: params.event.shotZone ?? undefined,
      p_no_ball_runs: params.event.noBallRuns ?? null,
      p_client_action_id: params.clientActionId ?? null,
    });
    if (error) {
      console.error("record_ball failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    const data = reply?.result ?? null;
    notifyFollowersAfter(params.matchId, matchEventOf(data), data);
    invalidateMatchCache(params.matchId);
    revalidatePath(`/matches/${params.matchId}`);

    if (data?.match_completed) await afterMatchCompleted(db, params.matchId);

    return { data, error: null, delta: reply?.delta ?? null };
  } catch (err) {
    console.error("Unexpected error in recordBall:", err);
    return {
      data: null,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to record delivery",
      ),
    };
  }
}

export async function undoLastBall(
  matchId: string,
  clientActionId?: string | null,
): Promise<{
  data: ScoringState | null;
  error: string | null;
  /** The committed documents (null when one was deleted: re-read). */
  delta?: ScoringDelta | null;
}> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to undo deliveries" };
    }

    const isAuthorized = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isAuthorized) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can undo deliveries",
      };
    }

    const { data: reply, error } = await db.rpc<{
      result: ScoringState;
      delta: ScoringDelta | null;
    }>("undo_last_ball", {
      p_with_delta: true,
      p_match_id: matchId,
      p_client_action_id: clientActionId ?? null,
    });
    if (error) {
      console.error("undo_last_ball failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    return { data: reply?.result ?? null, error: null, delta: reply?.delta ?? null };
  } catch (err) {
    console.error("Unexpected error in undoLastBall:", err);
    return {
      data: null,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to undo last ball",
      ),
    };
  }
}

export async function setCurrentBatsmen(
  matchId: string,
  strikerId: string,
  nonStrikerId: string,
  clientActionId?: string | null,
): Promise<{ error: string | null; delta?: ScoringDelta | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to set batsmen" };
    }

    // Scoring rights are checked inside the engine's transaction (same
    // rule as checkMatchAdminAuth, from the match it reads anyway).
    const { data: reply, error } = await db.rpc<{
      delta: ScoringDelta | null;
    }>("set_current_batsmen", {
      p_with_delta: true,
      p_match_id: matchId,
      p_striker_id: strikerId,
      p_non_striker_id: nonStrikerId,
      p_client_action_id: clientActionId ?? null,
    });
    if (error) {
      console.error("set_current_batsmen failed:", error);
      if (error.message.includes("not_authorized")) {
        return {
          error:
            "Only match administrators or designated scorers can set batsmen",
        };
      }
      return { error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    return { error: null, delta: reply?.delta ?? null };
  } catch (err) {
    console.error("Unexpected error in setCurrentBatsmen:", err);
    return {
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to set current batsmen",
      ),
    };
  }
}

export async function setCurrentBowler(
  matchId: string,
  bowlerId: string,
  clientActionId?: string | null,
): Promise<{ error: string | null; delta?: ScoringDelta | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to set bowler" };
    }

    // Scoring rights are checked inside the engine's transaction (same
    // rule as checkMatchAdminAuth, from the match it reads anyway).
    const { data: reply, error } = await db.rpc<{
      delta: ScoringDelta | null;
    }>("set_current_bowler", {
      p_with_delta: true,
      p_match_id: matchId,
      p_bowler_id: bowlerId,
      p_client_action_id: clientActionId ?? null,
    });
    if (error) {
      console.error("set_current_bowler failed:", error);
      if (error.message.includes("not_authorized")) {
        return {
          error:
            "Only match administrators or designated scorers can set bowler",
        };
      }
      return { error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    return { error: null, delta: reply?.delta ?? null };
  } catch (err) {
    console.error("Unexpected error in setCurrentBowler:", err);
    return {
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to set current bowler",
      ),
    };
  }
}

/**
 * `inningsNumber`: the innings the scorer meant to end; once it has ended
 * (or is not the current one) this does nothing (see `end_innings`).
 */
/**
 * The reply reports a match this call finished. A queued End innings
 * replayed after the match ended changes nothing (it names an ended
 * innings) and must not pick the player of the match again over the
 * scorer's choice.
 */
function finishedNow(
  state: ScoringState | null,
  before: MatchProgress | null,
): boolean {
  return Boolean(state?.match_completed) && before?.status !== "completed";
}

export async function endInnings(
  matchId: string,
  clientActionId?: string | null,
  inningsNumber?: number | null,
): Promise<{ data: ScoringState | null; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to end innings" };
    }

    const { allowed, match: before } = await matchAdminCheck(
      db,
      matchId,
      user.id,
    );
    if (!allowed) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can end innings",
      };
    }

    const { data, error } = await db.rpc("end_innings", {
      p_match_id: matchId,
      p_client_action_id: clientActionId ?? null,
      p_innings_number: inningsNumber ?? null,
    });
    if (error) {
      console.error("end_innings failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    notifyFollowersAfter(
      matchId,
      inningsEndEventOf(data as ScoringState),
      data as ScoringState,
    );
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);

    if (finishedNow(data as ScoringState, before)) {
      await afterMatchCompleted(db, matchId);
    }

    return { data: data as ScoringState, error: null };
  } catch (err) {
    console.error("Unexpected error in endInnings:", err);
    return {
      data: null,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to end innings",
      ),
    };
  }
}

export async function setPlayerOfTheMatch(
  matchId: string,
  playerId: string,
): Promise<{ success: boolean; error: string | null }> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in" };
  }

  const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
  if (!isMatchAdmin) {
    return {
      success: false,
      error: "Only match administrators can set the Player of the Match",
    };
  }

  const { error } = await db
    .from("matches")
    .update({ player_of_the_match_id: playerId })
    .eq("id", matchId);

  if (error) {
    console.error("setPlayerOfTheMatch failed:", error);
    return { success: false, error: friendlyError(error.message) };
  }

  await refreshLiveState(db, matchId);
  invalidateMatchCache(matchId);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/score`);
  return { success: true, error: null };
}

/**
 * Automatically calculates and awards Player of the Match using cricket analytics impact scoring.
 * Not exported: every export of this file is a server action anyone can
 * call, and this one checks no caller (`afterMatchCompleted`'s callers
 * have).
 */
async function autoAssignPlayerOfTheMatch(
  matchId: string,
): Promise<{ success: boolean; potmId: string | null; error: string | null }> {
  try {
    const matchRes = await getMatch(matchId, { skipCache: true });
    if (matchRes.error || !matchRes.data) {
      return {
        success: false,
        potmId: null,
        error: matchRes.error ?? "Match not found",
      };
    }
    const match = matchRes.data as Match;
    const topPlayer = calculatePlayerOfTheMatch(match);
    if (!topPlayer) {
      return {
        success: false,
        potmId: null,
        error: "No eligible players found",
      };
    }

    const db = await createServerClient();
    const { error } = await db
      .from("matches")
      .update({ player_of_the_match_id: topPlayer.playerId })
      .eq("id", matchId);

    if (error) {
      console.error("autoAssignPlayerOfTheMatch failed:", error);
      return {
        success: false,
        potmId: null,
        error: friendlyError(error.message),
      };
    }

    await refreshLiveState(db, matchId);
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, potmId: topPlayer.playerId, error: null };
  } catch (err) {
    console.error("autoAssignPlayerOfTheMatch unexpected error:", err);
    return {
      success: false,
      potmId: null,
      error: "Failed to automatically assign Player of the Match",
    };
  }
}

/**
 * Sets a chase's DLS target and the overs it now has: the target on the
 * innings (the engine plays to it), both on `matches.dls_revision` so
 * viewers see the target was revised and the chase counts the new overs
 * (the engine ends the innings there too, `inningsLimits`).
 */
export async function updateDlsTarget(
  matchId: string,
  inningsId: string,
  targetRuns: number,
  revisedOvers: number,
): Promise<{ success: boolean; error: string | null }> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in" };
  }

  const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
  if (!isMatchAdmin) {
    return {
      success: false,
      error: "Only match administrators can update the DLS target",
    };
  }

  if (!Number.isInteger(targetRuns) || targetRuns < 1) {
    return { success: false, error: "The target must be at least 1 run" };
  }
  const [{ data: match }, { data: innings }] = await Promise.all([
    db
      .from("matches")
      .select("overs_per_innings, balls_per_over")
      .eq("id", matchId)
      .single(),
    db
      .from("innings")
      .select("match_id, innings_number, total_balls")
      .eq("id", inningsId)
      .single(),
  ]);
  if (!match || !innings || innings.match_id !== matchId) {
    return { success: false, error: "That innings is not part of this match" };
  }
  const fullOvers = match.overs_per_innings ?? 20;
  const bpo =
    match.balls_per_over && match.balls_per_over > 0 ? match.balls_per_over : 6;
  if (
    !Number.isInteger(revisedOvers) ||
    revisedOvers < 1 ||
    revisedOvers > fullOvers
  ) {
    return {
      success: false,
      error: `The revised overs must be a whole number from 1 to ${fullOvers}`,
    };
  }
  if (revisedOvers * bpo <= (innings.total_balls ?? 0)) {
    return {
      success: false,
      error: "The revised overs must be more than the overs already bowled",
    };
  }

  const { error } = await db
    .from("innings")
    .update({ target_runs: targetRuns })
    .eq("id", inningsId)
    .eq("match_id", matchId);

  if (error) {
    console.error("updateDlsTarget failed:", error);
    return { success: false, error: friendlyError(error.message) };
  }

  const { error: matchErr } = await db
    .from("matches")
    .update({
      dls_revision: {
        innings_number: innings.innings_number,
        target_runs: targetRuns,
        overs: revisedOvers,
        // Written out: an update merges into the stored map, so a mark
        // left by a revision set by hand would otherwise stay.
        by_hand: false,
      },
    })
    .eq("id", matchId);
  if (matchErr) {
    console.error("updateDlsTarget failed on the match:", matchErr);
    return { success: false, error: friendlyError(matchErr.message) };
  }

  await refreshLiveState(db, matchId);
  invalidateMatchCache(matchId);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/score`);
  return { success: true, error: null };
}

export async function updateBall(params: {
  matchId: string;
  ballId: string;
  runsScored?: number;
  extras?: number;
  extraType?: ExtraType | null;
  isWicket?: boolean;
  dismissalType?: string | null;
  fielderId?: string | null;
  dismissedPlayerId?: string | null;
  batsmanId?: string | null;
  bowlerId?: string | null;
  /** On a no-ball: byes / leg byes rather than runs off the bat. */
  noBallRuns?: NoBallRuns | null;
  /** Idempotency key (offline queue id): a replay is not applied twice. */
  clientActionId?: string | null;
}): Promise<{ data: ScoringState | null; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to edit deliveries" };
    }

    const { allowed, match: before } = await matchAdminCheck(
      db,
      params.matchId,
      user.id,
    );
    if (!allowed) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can edit deliveries",
      };
    }

    const { data, error } = await db.rpc<ScoringState>("update_ball", {
      p_match_id: params.matchId,
      p_ball_id: params.ballId,
      p_batsman_id: params.batsmanId ?? null,
      p_bowler_id: params.bowlerId ?? null,
      p_runs_scored: params.runsScored ?? 0,
      p_extras: params.extras ?? 0,
      p_extra_type: params.extraType ?? null,
      p_is_wicket: params.isWicket ?? false,
      p_dismissal_type: params.dismissalType ?? null,
      p_fielder_id: params.fielderId ?? null,
      p_dismissed_player_id: params.dismissedPlayerId ?? null,
      p_no_ball_runs: params.noBallRuns ?? null,
      p_client_action_id: params.clientActionId ?? null,
    });

    if (error) {
      console.error("update_ball failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }

    // An edit can finish the match or close the innings.
    await settleProgress(db, params.matchId, before, data);
    invalidateMatchCache(params.matchId);
    revalidatePath(`/matches/${params.matchId}`);
    revalidatePath(`/matches/${params.matchId}/score`);
    return { data, error: null };
  } catch (err) {
    console.error("Unexpected error in updateBall:", err);
    return {
      data: null,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to update delivery",
      ),
    };
  }
}

export async function startSuperOver(
  matchId: string,
  clientActionId?: string | null,
): Promise<{ data: ScoringState | null; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to start a super over" };
    }

    const isAuthorized = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isAuthorized) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can start a super over",
      };
    }

    const { data, error } = await db.rpc("start_super_over", {
      p_match_id: matchId,
      p_client_action_id: clientActionId ?? null,
    });

    if (error) {
      console.error("start_super_over failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { data: data as ScoringState, error: null };
  } catch (err) {
    console.error("Unexpected error in startSuperOver:", err);
    return {
      data: null,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to start super over",
      ),
    };
  }
}

export interface MatchSettingsUpdate {
  matchFormat?: string;
  oversPerInnings?: number;
  targetRuns?: number | null;
  wicketsPerInnings?: number;
  lastManStands?: boolean;
  goldenBall?: boolean;
  /** The ball after a no-ball is a free hit. */
  freeHit?: boolean;
  title?: string;
  ballsPerOver?: number;
  maxBallsPerOver?: number | null;
  wideCountsAsBallFaced?: boolean;
  /** A no-ball counts as a ball faced (the Laws' convention). */
  noBallCountsAsBallFaced?: boolean;
  wideRunsToBatsman?: boolean;
  noballExtrasToBatsman?: boolean;
  /**
   * A club match's side(s) whose players count for the club; changing it
   * moves the match's records in or out of the club statistics.
   */
  clubSide?: ClubSide;
}

/** The match fields a settings save writes as they are. */
function matchSettingsPatch(
  settings: MatchSettingsUpdate,
): Record<string, unknown> {
  const fields: Array<[keyof MatchSettingsUpdate, string]> = [
    ["matchFormat", "match_format"],
    ["oversPerInnings", "overs_per_innings"],
    ["wicketsPerInnings", "wickets_per_innings"],
    ["lastManStands", "last_man_stands"],
    ["goldenBall", "golden_ball"],
    ["freeHit", "free_hit"],
    ["title", "title"],
    ["ballsPerOver", "balls_per_over"],
    ["maxBallsPerOver", "max_balls_per_over"],
    ["wideCountsAsBallFaced", "wide_counts_as_ball_faced"],
    ["noBallCountsAsBallFaced", "noball_counts_as_ball_faced"],
    ["wideRunsToBatsman", "wide_runs_to_batsman"],
    ["noballExtrasToBatsman", "noball_extras_to_batsman"],
  ];
  const patch: Record<string, unknown> = {};
  for (const [key, column] of fields) {
    if (settings[key] !== undefined) patch[column] = settings[key];
  }
  // The write hooks move the records and milestone totals with it.
  if (settings.clubSide !== undefined)
    patch.club_side = settings.clubSide === "both" ? null : settings.clubSide;
  return patch;
}

/**
 * Rules deciding who is credited with what: a change re-scores every
 * innings already played. [setting, column, value when unset]
 */
const CREDITING_RULES: Array<[keyof MatchSettingsUpdate, string, boolean]> = [
  ["wideRunsToBatsman", "wide_runs_to_batsman", false],
  ["noballExtrasToBatsman", "noball_extras_to_batsman", false],
  ["wideCountsAsBallFaced", "wide_counts_as_ball_faced", false],
  ["noBallCountsAsBallFaced", "noball_counts_as_ball_faced", true],
];

interface SettingsPlan {
  /** A chase target typed by hand that differs from the stored one. */
  target: { inningsId: string; runs: number } | null;
  /** Innings to recompute after the save, in order. */
  recompute: string[];
}

interface SettingsInnings {
  id: string;
  innings_number: number;
  target_runs: number | null;
  total_balls: number | null;
  is_completed: boolean | null;
}

interface SettingsMatch {
  current_innings: number | null;
  overs_per_innings: number | null;
  balls_per_over: number | null;
  dls_revision: { innings_number: number } | null;
}

/**
 * Why the save cannot change the over: balls per over stay once an over
 * has a ball, and the overs cannot drop to what the innings in play has
 * bowled (nothing would close it; a super over or a DLS-revised chase does
 * not play to them).
 */
function overRefusal(
  settings: MatchSettingsUpdate,
  match: SettingsMatch,
  innings: SettingsInnings[],
  open: SettingsInnings | null,
): string | null {
  const bpo = match.balls_per_over || 6;
  const newBpo = settings.ballsPerOver ?? bpo;
  if (newBpo !== bpo && innings.some((i) => (i.total_balls ?? 0) > 0)) {
    return "Balls per over cannot change once a ball has been bowled";
  }
  return oversRefusal(settings, match, open);
}

function oversRefusal(
  settings: MatchSettingsUpdate,
  match: SettingsMatch,
  open: SettingsInnings | null,
): string | null {
  const bpo = match.balls_per_over || 6;
  const overs = settings.oversPerInnings ?? match.overs_per_innings ?? 20;
  if (
    open &&
    oversGovern(match, open.innings_number) &&
    overs !== (match.overs_per_innings ?? 20) &&
    overs * bpo <= (open.total_balls ?? 0)
  ) {
    return "The overs must be more than the overs already bowled";
  }
  return null;
}

/** The match's overs set the innings' length (not a super over or DLS). */
function oversGovern(match: SettingsMatch, inningsNumber: number): boolean {
  return (
    !isSuperOverInnings(inningsNumber) &&
    match.dls_revision?.innings_number !== inningsNumber
  );
}

/**
 * A target counts only for the chase in play, and only when it changed:
 * sending back the one shown must not undo a DLS revision.
 */
function targetChange(
  targetRuns: number | null | undefined,
  open: SettingsInnings | null,
): SettingsPlan["target"] | { error: string } {
  if (targetRuns == null) return null;
  if (!open || open.innings_number % 2 !== 0) {
    return { error: "A target can be set only during a chase" };
  }
  return open.target_runs === targetRuns
    ? null
    : { inningsId: open.id, runs: targetRuns };
}

/**
 * Checks a settings save against the match as it stands (the dialog sends
 * every setting, changed or not) and says what else it must do.
 */
async function planSettingsSave(
  db: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
  settings: MatchSettingsUpdate,
): Promise<SettingsPlan | { error: string }> {
  const [{ data: match }, { data: rows }] = await Promise.all([
    db
      .from("matches")
      .select(
        "current_innings, overs_per_innings, balls_per_over, dls_revision, wide_runs_to_batsman, noball_extras_to_batsman, wide_counts_as_ball_faced, noball_counts_as_ball_faced",
      )
      .eq("id", matchId)
      .single(),
    db
      .from("innings")
      .select("id, innings_number, target_runs, total_balls, is_completed")
      .eq("match_id", matchId),
  ]);
  if (!match) return { error: "Match not found" };
  const innings = ((rows ?? []) as SettingsInnings[]).sort(
    (a, b) => a.innings_number - b.innings_number,
  );
  const current = innings.find(
    (i) => i.innings_number === (match.current_innings ?? 1),
  );
  const open = current && !current.is_completed ? current : null;

  const refusal = overRefusal(settings, match as SettingsMatch, innings, open);
  if (refusal) return { error: refusal };
  const target = targetChange(settings.targetRuns, open);
  if (target && "error" in target) return target;

  const stored = match as unknown as Record<string, boolean | null>;
  const rulesChanged = CREDITING_RULES.some(
    ([key, column, unset]) =>
      settings[key] !== undefined && settings[key] !== (stored[column] ?? unset),
  );
  return { target, recompute: rulesChanged ? innings.map((i) => i.id) : [] };
}

export async function updateMatchSettings(
  matchId: string,
  settings: MatchSettingsUpdate,
): Promise<{ success: boolean; error: string | null }> {
  try {
    if (
      settings.oversPerInnings !== undefined &&
      settings.oversPerInnings < 1
    ) {
      return {
        success: false,
        error: "Overs per innings must be at least 1",
      };
    }

    if (
      settings.ballsPerOver !== undefined &&
      (settings.ballsPerOver < 2 || settings.ballsPerOver > 12)
    ) {
      return {
        success: false,
        error: "Balls per over must be between 2 and 12",
      };
    }

    if (settings.clubSide !== undefined && !isClubSide(settings.clubSide)) {
      return {
        success: false,
        error: "Choose which side plays for the club",
      };
    }

    if (settings.targetRuns != null && !isTargetRuns(settings.targetRuns)) {
      return { success: false, error: "The target must be at least 1 run" };
    }

    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "You must be logged in to update match settings",
      };
    }

    const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isMatchAdmin) {
      return {
        success: false,
        error:
          "Only match administrators or designated scorers can update match settings",
      };
    }

    const plan = await planSettingsSave(db, matchId, settings);
    if ("error" in plan) return { success: false, error: plan.error };
    const revisedTarget = plan.target;

    if (revisedTarget) {
      const { error: innErr } = await db
        .from("innings")
        .update({ target_runs: revisedTarget.runs })
        .eq("id", revisedTarget.inningsId)
        .eq("match_id", matchId);
      if (innErr) {
        console.error("updateMatchSettings failed on the target:", innErr);
        return { success: false, error: friendlyError(innErr.message) };
      }
    }

    const matchUpdates = matchSettingsPatch(settings);
    // A target set by hand replaces any DLS revision.
    if (revisedTarget) matchUpdates.dls_revision = null;

    if (Object.keys(matchUpdates).length > 0) {
      const { error: matchErr } = await db
        .from("matches")
        .update(matchUpdates)
        .eq("id", matchId);
      if (matchErr) {
        console.error("updateMatchSettings failed on matches:", matchErr);
        return { success: false, error: friendlyError(matchErr.message) };
      }
    }

    // A crediting rule changed: re-score what was played under the old one.
    for (const inningsId of plan.recompute) {
      const { error } = await db.rpc("recompute_innings", {
        p_innings_id: inningsId,
      });
      if (error) {
        console.error("updateMatchSettings failed to recompute:", error);
        return { success: false, error: friendlyError(error.message) };
      }
    }

    await refreshLiveState(db, matchId);
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error in updateMatchSettings:", err);
    return {
      success: false,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to update match settings",
      ),
    };
  }
}

interface AbandonParams {
  reason: string;
  resultType?: "abandoned" | "no_result" | "win";
  winningTeamId?: string | null;
  notes?: string | null;
}

interface AbandonedMatch {
  status: string | null;
  team1_id: string;
  team2_id: string;
  team1_snapshot: { name?: string | null } | null;
  team2_snapshot: { name?: string | null } | null;
}

/**
 * The result fields of a match ended early. Only a match still to finish
 * ends early (the menu offers it for live and scheduled matches): a
 * finished one keeps its result. Awarded, it names the side and has no
 * margin; otherwise nobody won.
 */
function abandonedResult(
  match: AbandonedMatch,
  params: AbandonParams,
): { fields: Record<string, unknown> } | { error: string } {
  if (match.status !== "live" && match.status !== "scheduled") {
    return { error: "This match has already ended" };
  }
  const resultType = params.resultType ?? "abandoned";
  const winner = resultType === "win" ? awardedSide(match, params) : null;
  if (resultType === "win" && !winner) {
    return { error: "Choose the side the match is awarded to" };
  }
  const outcome = winner
    ? `Match awarded to ${winner.name}: ${params.reason}`
    : `Match abandoned: ${params.reason}`;
  return {
    fields: {
      status: "abandoned",
      result_type: resultType,
      result_description: [outcome, params.notes].filter(Boolean).join(". "),
      winning_team_id: winner ? winner.id : null,
      win_margin: null,
      win_margin_type: null,
    },
  };
}

/** The side named as the winner, if it plays in the match. */
function awardedSide(
  match: AbandonedMatch,
  params: AbandonParams,
): { id: string; name: string } | null {
  const id = params.winningTeamId;
  if (id !== match.team1_id && id !== match.team2_id) return null;
  const snapshot =
    id === match.team1_id ? match.team1_snapshot : match.team2_snapshot;
  return { id, name: snapshot?.name ?? "the winners" };
}

export async function abandonMatch(
  matchId: string,
  params: AbandonParams,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "You must be logged in to abandon a match" };
    }

    const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isMatchAdmin) {
      return {
        success: false,
        error: "Only match administrators or designated scorers can abandon a match",
      };
    }

    const { data: match } = await db
      .from("matches")
      .select("status, team1_id, team2_id, team1_snapshot, team2_snapshot")
      .eq("id", matchId)
      .single();
    if (!match) return { success: false, error: "Match not found" };
    const result = abandonedResult(match as AbandonedMatch, params);
    if ("error" in result) return { success: false, error: result.error };

    const { error: matchErr } = await db
      .from("matches")
      .update({ ...result.fields, actual_end_time: new Date().toISOString() })
      .eq("id", matchId);

    if (matchErr) {
      console.error("abandonMatch failed:", matchErr);
      return { success: false, error: friendlyError(matchErr.message) };
    }

    // End active innings
    await db
      .from("innings")
      .update({ is_completed: true })
      .eq("match_id", matchId);

    await refreshLiveState(db, matchId);
    notifyFollowersAfter(matchId, "abandoned");
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error in abandonMatch:", err);
    return {
      success: false,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to abandon match",
      ),
    };
  }
}

/**
 * Delete a match, its scorecard and ball log, and take it out of players'
 * statistics, leaderboards and the points table (`delete_match` rpc, which
 * re-checks who may delete: the match creator, club admins, or the
 * tournament creator; not co-scorers). `confirmTitle` must equal the match
 * title (case-insensitive). Safe to retry.
 */
export async function deleteMatch(
  matchId: string,
  confirmTitle: string,
): Promise<{
  success: boolean;
  error: string | null;
  redirectTo?: string;
}> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "You must be signed in to delete a match" };
    }

    const { data, error } = await db.rpc<DeleteMatchResult>("delete_match", {
      p_match_id: matchId,
      p_confirm_title: confirmTitle,
    });
    if (error || !data) {
      const message = error?.message ?? "";
      if (message.includes("not_authorized")) {
        return {
          success: false,
          error:
            "Only the match creator, a club admin or the tournament organiser can delete this match",
        };
      }
      if (message.includes("confirm_title_mismatch")) {
        return {
          success: false,
          error: "The name you typed does not match this match",
        };
      }
      console.error("deleteMatch failed:", error);
      return {
        success: false,
        error: friendlyError(message || "Failed to delete match"),
      };
    }

    // Structured, so the deletion is traceable in Cloud Logging.
    console.info(
      JSON.stringify({
        event: "match_deleted",
        matchId,
        uid: user.id,
        alreadyDeleted: data.already_deleted,
        tournamentId: data.tournament_id,
        clubId: data.club_id,
        removed: data.removed,
      }),
    );

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath("/matches");
    revalidatePath("/players", "layout");
    if (data.tournament_id) {
      revalidatePath(`/tournaments/${data.tournament_id}`);
      revalidatePath("/tournaments");
    }
    if (data.club_id) {
      revalidatePath(`/clubs/${data.club_id}`);
      revalidatePath("/clubs");
    }
    return { success: true, error: null, redirectTo: afterDeleteHref(data) };
  } catch (err) {
    console.error("Unexpected error in deleteMatch:", err);
    return {
      success: false,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to delete match",
      ),
    };
  }
}

export async function awardTeamPenalty(
  matchId: string,
  params: {
    teamId: string;
    runs: number;
    reason: string;
    type?: "penalty" | "bonus";
    clientActionId?: string | null;
  },
): Promise<{
  success: boolean;
  error: string | null;
  /** The committed documents (null when they are not enough: re-read). */
  delta?: ScoringDelta | null;
}> {
  try {
    const awardType = params.type ?? "penalty";
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "You must be logged in to award penalty runs" };
    }

    const { allowed, match: before } = await matchAdminCheck(
      db,
      matchId,
      user.id,
    );
    if (!allowed) {
      return {
        success: false,
        error: "Only match administrators or designated scorers can award penalty runs",
      };
    }

    // Logged in the ball log and recomputed in one transaction, which also
    // refreshes live_state. To the batting side: at the current crease. To
    // the fielding side (Law 41.17): added to their latest innings (raising
    // the target), or credited to their upcoming innings when they have not
    // batted yet.
    const { data: reply, error: awardErr } = await db.rpc<{
      delta: ScoringDelta | null;
    }>("award_penalty_runs", {
      p_with_delta: true,
      p_match_id: matchId,
      p_runs: params.runs,
      p_type: awardType,
      p_reason: params.reason,
      p_team_id: params.teamId,
      p_client_action_id: params.clientActionId ?? null,
    });
    if (awardErr) {
      if (awardErr.message === "match_not_found") {
        return { success: false, error: "Match not found" };
      }
      if (awardErr.message === "no_open_innings") {
        return { success: false, error: "No active innings found to award penalty" };
      }
      return { success: false, error: friendlyError(awardErr.message) };
    }

    // Runs to the batting side can win the chase or end the innings.
    await settleProgressAfterEvent(db, matchId, before, reply);
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null, delta: reply?.delta ?? null };
  } catch (err) {
    console.error("Unexpected error in awardTeamPenalty:", err);
    return {
      success: false,
      error: friendlyError(err instanceof Error ? err.message : "Failed to award penalty"),
    };
  }
}

export async function retirePlayer(
  matchId: string,
  params: {
    playerId: string;
    type: "retired_hurt" | "retired_out";
    reason?: string | null;
    clientActionId?: string | null;
  },
): Promise<{
  success: boolean;
  error: string | null;
  /** The committed documents (null when they are not enough: re-read). */
  delta?: ScoringDelta | null;
}> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "You must be logged in to retire a player" };
    }

    const { allowed, match: before } = await matchAdminCheck(
      db,
      matchId,
      user.id,
    );
    if (!allowed) {
      return {
        success: false,
        error: "Only match administrators or designated scorers can retire a player",
      };
    }

    const { data: reply, error: retireErr } = await db.rpc<{
      delta: ScoringDelta | null;
    }>("retire_batter", {
      p_with_delta: true,
      p_match_id: matchId,
      p_player_id: params.playerId,
      p_type: params.type,
      p_reason: params.reason ?? null,
      p_client_action_id: params.clientActionId ?? null,
    });

    if (retireErr) {
      console.error("retirePlayer failed:", retireErr);
      if (retireErr.message === "match_not_found") {
        return { success: false, error: "Match not found" };
      }
      if (retireErr.message === "no_open_innings") {
        return { success: false, error: "Active innings not found" };
      }
      return { success: false, error: friendlyError(retireErr.message) };
    }

    // Retired out for the last wicket ends the innings.
    await settleProgressAfterEvent(db, matchId, before, reply);
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null, delta: reply?.delta ?? null };
  } catch (err) {
    console.error("Unexpected error in retirePlayer:", err);
    return {
      success: false,
      error: friendlyError(err instanceof Error ? err.message : "Failed to retire player"),
    };
  }
}

interface ChaseRevision {
  inningsId: string;
  /** The match's `dls_revision`, set by hand: null at the full overs. */
  revision: DlsRevision | null;
}

/**
 * What "Revise target / overs" writes. It applies to the open chase of the
 * main match (a super over keeps its one over), with a target of at least
 * 1 run and whole overs the chase can still play, up to the match's.
 * Fewer overs are the chase's own revision, so the first innings keeps its
 * quota; at the full overs a target set by hand replaces any revision.
 */
async function planChaseRevision(
  db: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
  params: { targetRuns: number | null; overs?: number | null },
): Promise<ChaseRevision | { error: string }> {
  const target = params.targetRuns;
  if (!isTargetRuns(target)) {
    return { error: "The target must be at least 1 run" };
  }
  const { data: match } = await db
    .from("matches")
    .select("current_innings, overs_per_innings, balls_per_over")
    .eq("id", matchId)
    .single();
  const { data: chase } = await db
    .from("innings")
    .select("id, innings_number, total_balls, is_completed")
    .eq("match_id", matchId)
    .eq("innings_number", match?.current_innings ?? 1)
    .maybeSingle();
  const refusal = chaseRefusal(chase as SettingsInnings | null);
  if (refusal || !match || !chase) {
    return { error: refusal ?? "A target can be set only during a chase" };
  }
  const overs = revisedOvers(
    match as SettingsMatch,
    chase as SettingsInnings,
    params.overs,
  );
  if (typeof overs === "string") return { error: overs };
  return {
    inningsId: chase.id,
    revision: overs
      ? {
          innings_number: chase.innings_number,
          target_runs: target,
          overs,
          by_hand: true,
        }
      : null,
  };
}

function isTargetRuns(runs: number | null | undefined): runs is number {
  return runs != null && Number.isInteger(runs) && runs >= 1;
}

function chaseRefusal(chase: SettingsInnings | null): string | null {
  if (!chase || chase.is_completed || chase.innings_number % 2 !== 0) {
    return "A target can be set only during a chase";
  }
  if (isSuperOverInnings(chase.innings_number)) {
    return "A super over's target cannot be revised";
  }
  return null;
}

/** The chase's revised overs (null: the full overs), or why not. */
function revisedOvers(
  match: SettingsMatch,
  chase: SettingsInnings,
  requested: number | null | undefined,
): number | null | string {
  const full = match.overs_per_innings ?? 20;
  const overs = requested ?? full;
  if (!Number.isInteger(overs) || overs < 1 || overs > full) {
    return `The revised overs must be a whole number from 1 to ${full}`;
  }
  if (overs * (match.balls_per_over || 6) <= (chase.total_balls ?? 0)) {
    return "The revised overs must be more than the overs already bowled";
  }
  return overs < full ? overs : null;
}

export async function updateTargetRuns(
  matchId: string,
  params: {
    targetRuns: number | null;
    overs?: number | null;
  },
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "You must be logged in to update target" };
    }

    const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isMatchAdmin) {
      return {
        success: false,
        error: "Only match administrators or designated scorers can update target",
      };
    }

    const plan = await planChaseRevision(db, matchId, params);
    if ("error" in plan) return { success: false, error: plan.error };

    const { error: innErr } = await db
      .from("innings")
      .update({ target_runs: params.targetRuns })
      .eq("id", plan.inningsId)
      .eq("match_id", matchId);
    if (innErr) {
      return { success: false, error: friendlyError(innErr.message) };
    }

    const { error: matchErr } = await db
      .from("matches")
      .update({ dls_revision: plan.revision })
      .eq("id", matchId);
    if (matchErr) {
      return { success: false, error: friendlyError(matchErr.message) };
    }

    await refreshLiveState(db, matchId);
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error in updateTargetRuns:", err);
    return {
      success: false,
      error: friendlyError(err instanceof Error ? err.message : "Failed to update target"),
    };
  }
}

export async function reassignCurrentOverBowler(
  matchId: string,
  newBowlerId: string,
  clientActionId?: string | null,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "You must be logged in to modify bowler",
      };
    }

    const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isMatchAdmin) {
      return {
        success: false,
        error:
          "Only match administrators or designated scorers can reassign bowler",
      };
    }

    // Refuses a bowler who cannot bowl this over, before any ball moves.
    const { error: bowlerErr } = await db.rpc("set_current_bowler", {
      p_match_id: matchId,
      p_bowler_id: newBowlerId,
    });
    if (bowlerErr) {
      return { success: false, error: friendlyError(bowlerErr.message) };
    }

    // Credits the over's latest bowler's deliveries to the new bowler and
    // recomputes the innings.
    const { error: reassignErr } = await db.rpc("reassign_over_bowler", {
      p_match_id: matchId,
      p_bowler_id: newBowlerId,
      p_client_action_id: clientActionId ?? null,
    });
    if (reassignErr) {
      console.error("Failed to reassign the over to the new bowler:", reassignErr);
      if (reassignErr.message === "match_not_found") {
        return { success: false, error: "Match not found" };
      }
      if (reassignErr.message === "no_open_innings") {
        return { success: false, error: "Innings not found" };
      }
      return { success: false, error: friendlyError(reassignErr.message) };
    }

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error in reassignCurrentOverBowler:", err);
    return {
      success: false,
      error: friendlyError(
        err instanceof Error
          ? err.message
          : "Failed to reassign current over bowler",
      ),
    };
  }
}

/**
 * The wrong player was recorded as batting: everything the current
 * innings' ball log has for `fromId` goes to `toId` (see `replace_batter`).
 */
export async function replaceBatter(
  matchId: string,
  fromId: string,
  toId: string,
  clientActionId?: string | null,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "You must be logged in to change a batter" };
    }
    const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isMatchAdmin) {
      return {
        success: false,
        error: "Only match administrators or designated scorers can change a batter",
      };
    }
    const { error } = await db.rpc("replace_batter", {
      p_match_id: matchId,
      p_from_id: fromId,
      p_to_id: toId,
      p_client_action_id: clientActionId ?? null,
    });
    if (error) return { success: false, error: friendlyError(error.message) };
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error in replaceBatter:", err);
    return {
      success: false,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to change the batter",
      ),
    };
  }
}

/**
 * A player recorded by mistake, replaced throughout the match, during it
 * or after (`replace_player`): their batting, bowling, fielding and any
 * player-of-the-match award go to `toId`, a squad player who has no part
 * in the match yet; the scorecards and statistics follow.
 */
/** The player just replaced, if they never signed in: maybe a duplicate. */
export interface ReplacedPlayer {
  /** Matches they still have: none, and they can simply be removed. */
  otherMatches: number;
}

export async function replacePlayerInMatch(
  matchId: string,
  fromId: string,
  toId: string,
): Promise<{
  success: boolean;
  error: string | null;
  leftover?: ReplacedPlayer | null;
}> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "You must be logged in to replace a player" };
    }
    const { error } = await db.rpc("replace_player", {
      p_match_id: matchId,
      p_from_id: fromId,
      p_to_id: toId,
    });
    if (error) return { success: false, error: friendlyError(error.message) };
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/players/${fromId}`);
    revalidatePath(`/players/${toId}`);
    // The replacement stands whatever this answers.
    const { data: leftover } = await db.rpc<{
      placeholder: boolean;
      otherMatches: number;
    }>("player_leftover", { p_user_id: fromId });
    return {
      success: true,
      error: null,
      leftover: leftover?.placeholder
        ? { otherMatches: leftover.otherMatches }
        : null,
    };
  } catch (err) {
    console.error("Unexpected error in replacePlayerInMatch:", err);
    return {
      success: false,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to replace the player",
      ),
    };
  }
}

/**
 * Takes a replaced duplicate off the squad, and off CricScore once nothing
 * names them, for the match's scorers (`remove_leftover_player`).
 */
export async function removeReplacedPlayer(
  matchId: string,
  teamId: string,
  userId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) {
      return { success: false, error: "You must be logged in to remove a player" };
    }
    const { error } = await db.rpc("remove_leftover_player", {
      p_match_id: matchId,
      p_team_id: teamId,
      p_user_id: userId,
    });
    if (error) return { success: false, error: friendlyError(error.message) };
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/teams/${teamId}`);
    await refreshLiveMatchesFor(db, { teamId });
    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error in removeReplacedPlayer:", err);
    return {
      success: false,
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to remove the player",
      ),
    };
  }
}

export interface MatchScorerUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
  username?: string | null;
}

const SCORER_FIELDS = "id, full_name, avatar_url, username";
/** How many times `limit` profiles a name search reads, past placeholders. */
const CANDIDATE_LOOKAHEAD = 3;
/** Candidates also bring the placeholder flag, to leave those players out. */
const CANDIDATE_FIELDS = `${SCORER_FIELDS}, is_placeholder`;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Firebase Auth uids (28 letters and digits) and similar opaque ids. */
const OPAQUE_ID_RE = /^[A-Za-z0-9]{20,40}$/;

type Candidate = MatchScorerUser & { is_placeholder?: boolean | null };

/**
 * Players with an account: a squad player who has never signed in (a
 * placeholder) cannot score, so the picker does not offer them.
 */
function withAccounts(rows: unknown[] | null | undefined): MatchScorerUser[] {
  return ((rows ?? []) as Candidate[])
    .filter((u) => u.is_placeholder !== true)
    .map((u) => ({
      id: u.id,
      full_name: u.full_name,
      avatar_url: u.avatar_url,
      username: u.username ?? null,
    }));
}

/**
 * Finds registered players for the scorer picker: by id, by exact email
 * (looked up in server-only users_private, never returned) or by name.
 * Placeholder players (no account) are left out.
 */
async function findScorerCandidates(
  db: Awaited<ReturnType<typeof createServerClient>>,
  target: string,
  limit: number,
): Promise<{ data: MatchScorerUser[]; error: string | null }> {
  if (UUID_RE.test(target) || OPAQUE_ID_RE.test(target)) {
    // A picked search result sends its id (a UUID, or a Firebase uid).
    const { data, error } = await db
      .from("users")
      .select(CANDIDATE_FIELDS)
      .eq("id", target)
      .limit(limit);
    if (error) return { data: [], error: error.message };
    if ((data ?? []).length > 0 || UUID_RE.test(target)) {
      return { data: withAccounts(data), error: null };
    }
    // Not an id after all: a long one-word name.
  }
  if (target.includes("@")) {
    const { data: matches, error } = await db
      .from("users_private")
      .select("id")
      .eq("email", target.toLowerCase())
      .limit(limit);
    if (error) return { data: [], error: error.message };
    const ids = (matches ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) return { data: [], error: null };
    const { data, error: usersError } = await db
      .from("users")
      .select(CANDIDATE_FIELDS)
      .in("id", ids);
    return {
      data: withAccounts(data),
      error: usersError?.message ?? null,
    };
  }
  // Word-prefix match on name / @username. Players added by name only
  // (placeholders) cannot score and are left out, so look further than
  // `limit` (at most CANDIDATE_LOOKAHEAD times as many profiles): a name
  // shared with several of them must still find the registered player.
  const { data, error } = await prefixSearch(
    db,
    "users",
    target,
    CANDIDATE_FIELDS,
    limit * CANDIDATE_LOOKAHEAD,
  );
  return {
    data: withAccounts(data as unknown[]).slice(0, limit),
    error,
  };
}

export async function getMatchScorers(matchId: string): Promise<{
  data: {
    createdBy: MatchScorerUser | null;
    matchAdmins: MatchScorerUser[];
  } | null;
  error: string | null;
}> {
  try {
    const db = await createServerClient();
    const { data: match, error: matchErr } = await db
      .from("matches")
      .select("created_by, match_admins")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) {
      return { data: null, error: matchErr?.message || "Match not found" };
    }

    const allUserIds = Array.from(
      new Set(
        [match.created_by, ...(match.match_admins ?? [])].filter(
          (id): id is string => Boolean(id),
        ),
      ),
    );

    if (allUserIds.length === 0) {
      return { data: { createdBy: null, matchAdmins: [] }, error: null };
    }

    const { data: users, error: userErr } = await db
      .from("users")
      .select(SCORER_FIELDS)
      .in("id", allUserIds);

    if (userErr) {
      return { data: null, error: userErr.message };
    }

    const userMap = new Map(
      (users ?? []).map((u) => [u.id, u as MatchScorerUser]),
    );
    const createdBy = userMap.get(match.created_by) ?? null;
    const matchAdmins = (match.match_admins ?? [])
      .filter((id: string) => id !== match.created_by)
      .map((id: string) => userMap.get(id))
      .filter((u: MatchScorerUser | undefined): u is MatchScorerUser =>
        Boolean(u),
      );

    return { data: { createdBy, matchAdmins }, error: null };
  } catch (err) {
    console.error("getMatchScorers error:", err);
    return { data: null, error: "Failed to fetch scorers" };
  }
}

export async function searchScorers(
  query: string,
): Promise<{ data: MatchScorerUser[]; error: string | null }> {
  try {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) {
      return { data: [], error: null };
    }

    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { data: [], error: "You must be logged in" };

    return await findScorerCandidates(db, trimmed, 6);
  } catch (err) {
    console.error("searchScorers error:", err);
    return { data: [], error: "Search failed" };
  }
}

export async function addMatchScorer(
  matchId: string,
  emailOrUserId: string,
): Promise<{
  success: boolean;
  user?: MatchScorerUser;
  error: string | null;
}> {
  try {
    const db = await createServerClient();
    const {
      data: { user: currentUser },
    } = await db.auth.getUser();

    if (!currentUser) {
      return { success: false, error: "You must be logged in" };
    }

    const authorized = await checkMatchAdminAuth(
      db,
      matchId,
      currentUser.id,
    );
    if (!authorized) {
      return {
        success: false,
        error: "Only authorized match scorers can invite additional scorers",
      };
    }

    const queryTarget = emailOrUserId.trim();
    if (!queryTarget) {
      return { success: false, error: "Please enter a user name, email, or ID" };
    }

    const isUuid = UUID_RE.test(queryTarget);
    const { data: targetUsers, error: userFindErr } =
      await findScorerCandidates(db, queryTarget, 1);
    if (userFindErr) {
      return { success: false, error: userFindErr };
    }

    const targetUser = targetUsers?.[0] as MatchScorerUser | undefined;
    if (!targetUser) {
      return {
        success: false,
        error: `No registered player found with ${isUuid ? "ID" : queryTarget.includes("@") ? "email" : "name"} "${queryTarget}"`,
      };
    }

    const { data: match, error: matchErr } = await db
      .from("matches")
      .select("created_by, match_admins")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) {
      return { success: false, error: matchErr?.message || "Match not found" };
    }

    const existingAdmins = match.match_admins ?? [];
    if (
      match.created_by === targetUser.id ||
      existingAdmins.includes(targetUser.id)
    ) {
      return {
        success: false,
        error: `${targetUser.full_name} is already an authorized scorer for this match`,
      };
    }

    const updatedAdmins = [...existingAdmins, targetUser.id];
    const { error: updateErr } = await db
      .from("matches")
      .update({ match_admins: updatedAdmins })
      .eq("id", matchId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, user: targetUser, error: null };
  } catch (err) {
    console.error("addMatchScorer error:", err);
    return { success: false, error: "Failed to add scorer" };
  }
}

export async function removeMatchScorer(
  matchId: string,
  scorerUserId: string,
): Promise<{
  success: boolean;
  error: string | null;
}> {
  try {
    const db = await createServerClient();
    const {
      data: { user: currentUser },
    } = await db.auth.getUser();

    if (!currentUser) {
      return { success: false, error: "You must be logged in" };
    }

    const authorized = await checkMatchAdminAuth(
      db,
      matchId,
      currentUser.id,
    );
    if (!authorized) {
      return {
        success: false,
        error: "Not authorized to manage match scorers",
      };
    }

    const { data: match, error: matchErr } = await db
      .from("matches")
      .select("created_by, match_admins")
      .eq("id", matchId)
      .single();

    if (matchErr || !match) {
      return { success: false, error: matchErr?.message || "Match not found" };
    }

    if (match.created_by === scorerUserId) {
      return {
        success: false,
        error: "Cannot remove match creator from scorers",
      };
    }

    const updatedAdmins = (match.match_admins ?? []).filter(
      (id: string) => id !== scorerUserId,
    );

    const { error: updateErr } = await db
      .from("matches")
      .update({ match_admins: updatedAdmins })
      .eq("id", matchId);

    if (updateErr) {
      return { success: false, error: updateErr.message };
    }

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null };
  } catch (err) {
    console.error("removeMatchScorer error:", err);
    return { success: false, error: "Failed to remove scorer" };
  }
}


