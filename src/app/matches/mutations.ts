"use server";

import { revalidatePath } from "next/cache";
import { prefixSearch } from "~/lib/firebase/search";
import { createServerClient } from "~/lib/firebase/server";
import { refreshLiveState } from "~/lib/firebase/live-sync";
import { ensureUserProfile } from "~/lib/firebase/user-profile";
import { teamSnapshot } from "~/lib/firebase/team-snapshot";
import { invalidateMatchCache } from "~/lib/match-cache";
import { friendlyError } from "./errors";
import type {
  BallEvent,
  MatchFormData,
  ScoringState,
  ExtraType,
} from "./types";
import { getMatch } from "./queries";
import { calculatePlayerOfTheMatch } from "~/lib/cricket";
import type { Match } from "~/lib/match-types";

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
        "id, name, short_name, logo_url, created_by, captain_id, vice_captain_id, club_id",
      )
      .in("id", [formData.team1Id, formData.team2Id]),
    formData.tournamentId
      ? db
          .from("tournaments")
          .select("id, created_by, club_id")
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
          .select("team_id")
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

  // Collect relevant club IDs to check admin / ownership in one batch
  const relevantClubIds = Array.from(
    new Set(
      [
        team1.club_id,
        team2.club_id,
        formData.clubId,
        tournamentRes.data?.club_id,
      ].filter((id): id is string => Boolean(id)),
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
    tournamentRes.data &&
      (tournamentRes.data.created_by === user.id ||
        isClubAdmin(tournamentRes.data.club_id)),
  );

  const isAuthorized =
    isTeam1Mine ||
    myTeamIds.has(team1.id) ||
    isClubAdmin(team1.club_id) ||
    isTournamentAdmin ||
    (formData.clubId &&
      team1.club_id === formData.clubId &&
      isClubAdmin(formData.clubId));

  if (!isAuthorized) {
    return {
      data: null,
      error:
        "You do not have permission to create matches for Team 1. You must be an owner, captain, or squad member of Team 1, or an administrator of the linked club or tournament.",
    };
  }

  // Validate tournamentId association if provided
  if (formData.tournamentId) {
    const tournament = tournamentRes.data;
    if (!tournament) {
      return { data: null, error: "Selected tournament does not exist" };
    }

    const registeredTeamIds = new Set(
      (tournRegsRes.data ?? []).map((r) => r.team_id),
    );

    if (
      !isTournamentAdmin &&
      !registeredTeamIds.has(formData.team1Id) &&
      !registeredTeamIds.has(formData.team2Id)
    ) {
      return {
        data: null,
        error:
          "Neither team is registered in the selected tournament, and you are not an organizer of this tournament.",
      };
    }

    if (!registeredTeamIds.has(formData.team2Id)) {
      return {
        data: null,
        error: "The selected opponent team is not registered in this tournament.",
      };
    }
  }

  // Validate clubId association if provided
  if (formData.clubId) {
    const club = (clubsRes.data ?? []).find((c) => c.id === formData.clubId);
    if (!club) {
      return { data: null, error: "Selected club does not exist" };
    }

    if (!isClubAdmin(formData.clubId) && team1.club_id !== formData.clubId) {
      return {
        data: null,
        error:
          "You can only link matches to a club you manage or that your team belongs to.",
      };
    }
  }

  // Validate Team 2 (Opponent) eligibility under Option 1
  if (!formData.tournamentId) {
    if (formData.clubId) {
      const isTeam2InClub = team2.club_id === formData.clubId;
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
      title: formData.title,
      match_format: formData.matchFormat,
      overs_per_innings: formData.oversPerInnings,
      team1_id: formData.team1Id,
      team2_id: formData.team2Id,
      team1_snapshot: teamSnapshot(team1),
      team2_snapshot: teamSnapshot(team2),
      venue: formData.venue,
      scheduled_at: formData.scheduledAt,
      umpire1_name: formData.umpire1Name,
      umpire2_name: formData.umpire2Name,
      club_id: formData.clubId,
      tournament_id: formData.tournamentId,
      season_id: formData.seasonId,
      wickets_per_innings: formData.wicketsPerInnings ?? 10,
      last_man_stands: formData.lastManStands ?? false,
      golden_ball: formData.goldenBall ?? false,
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
  const { data: match } = await db
    .from("matches")
    .select("created_by, match_admins, club_id, tournament_id")
    .eq("id", matchId)
    .single();

  if (!match) return false;
  if (match.created_by === userId) return true;
  if ((match.match_admins ?? []).includes(userId)) return true;

  const checks: Promise<boolean>[] = [];

  if (match.club_id) {
    checks.push(
      (async () => {
        const { data: club } = await db
          .from("clubs")
          .select("owner_id")
          .eq("id", match.club_id)
          .single();

        if (club?.owner_id === userId) return true;

        const { data: mem } = await db
          .from("club_memberships")
          .select("id")
          .eq("club_id", match.club_id)
          .eq("user_id", userId)
          .in("role", ["owner", "admin"])
          .eq("status", "active")
          .maybeSingle();

        return !!mem;
      })(),
    );
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

        if (tournament?.club_id) {
          const { data: club } = await db
            .from("clubs")
            .select("owner_id")
            .eq("id", tournament.club_id)
            .single();

          if (club?.owner_id === userId) return true;

          const { data: mem } = await db
            .from("club_memberships")
            .select("id")
            .eq("club_id", tournament.club_id)
            .eq("user_id", userId)
            .in("role", ["owner", "admin"])
            .eq("status", "active")
            .maybeSingle();

          return !!mem;
        }
        return false;
      })(),
    );
  }

  if (checks.length > 0) {
    const results = await Promise.all(checks);
    return results.some(Boolean);
  }

  return false;
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
    .select("team1_id, team2_id")
    .eq("id", matchId)
    .single();
  if (matchError || !match) {
    return { data: null, error: "Match not found" };
  }
  const battingTeamId =
    tossDecision === "bat"
      ? tossWinnerId
      : tossWinnerId === match.team1_id
        ? match.team2_id
        : match.team1_id;
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
    return { data: null, error: updateError.message };
  }
  const { data: innings, error: inningsError } = await db
    .from("innings")
    .insert({
      match_id: matchId,
      team_id: battingTeamId,
      innings_number: 1,
    })
    .select()
    .single();
  if (inningsError) {
    return { data: null, error: inningsError.message };
  }
  await refreshLiveState(db, matchId);
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
}): Promise<{ data: ScoringState | null; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to record scores" };
    }

    const isAuthorized = await checkMatchAdminAuth(
      db,
      params.matchId,
      user.id,
    );
    if (!isAuthorized) {
      return {
        data: null,
        error:
          "You do not have permission to score this match. Only the match creator, designated scorers, or club administrators can record scores.",
      };
    }

    const { data, error } = await db.rpc("record_ball", {
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
    });
    if (error) {
      console.error("record_ball failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    invalidateMatchCache(params.matchId);
    revalidatePath(`/matches/${params.matchId}`);

    if ((data as ScoringState)?.match_completed) {
      const { data: matchData } = await db
        .from("matches")
        .select("tournament_id, club_id")
        .eq("id", params.matchId)
        .single();

      if (matchData?.tournament_id) {
        revalidatePath(`/tournaments/${matchData.tournament_id}`);
        revalidatePath("/tournaments");
      }
      if (matchData?.club_id) {
        revalidatePath(`/clubs/${matchData.club_id}`);
        revalidatePath("/clubs");
      }

      // Automatically determine and assign Player of the Match
      try {
        await autoAssignPlayerOfTheMatch(params.matchId);
      } catch (potmErr) {
        console.error("Auto POTM assignment failed:", potmErr);
      }
    }

    return { data: data as ScoringState, error: null };
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
): Promise<{ data: ScoringState | null; error: string | null }> {
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

    const { data, error } = await db.rpc("undo_last_ball", {
      p_match_id: matchId,
    });
    if (error) {
      console.error("undo_last_ball failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    return { data: data as ScoringState, error: null };
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
): Promise<{ error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to set batsmen" };
    }

    const isAuthorized = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isAuthorized) {
      return {
        error:
          "Only match administrators or designated scorers can set batsmen",
      };
    }

    const { error } = await db.rpc("set_current_batsmen", {
      p_match_id: matchId,
      p_striker_id: strikerId,
      p_non_striker_id: nonStrikerId,
    });
    if (error) {
      console.error("set_current_batsmen failed:", error);
      return { error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    return { error: null };
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
): Promise<{ error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to set bowler" };
    }

    const isAuthorized = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isAuthorized) {
      return {
        error:
          "Only match administrators or designated scorers can set bowler",
      };
    }

    const { error } = await db.rpc("set_current_bowler", {
      p_match_id: matchId,
      p_bowler_id: bowlerId,
    });
    if (error) {
      console.error("set_current_bowler failed:", error);
      return { error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    return { error: null };
  } catch (err) {
    console.error("Unexpected error in setCurrentBowler:", err);
    return {
      error: friendlyError(
        err instanceof Error ? err.message : "Failed to set current bowler",
      ),
    };
  }
}

export async function endInnings(
  matchId: string,
): Promise<{ data: ScoringState | null; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to end innings" };
    }

    const isAuthorized = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isAuthorized) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can end innings",
      };
    }

    const { data, error } = await db.rpc("end_innings", {
      p_match_id: matchId,
    });
    if (error) {
      console.error("end_innings failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);

    if ((data as ScoringState)?.match_completed) {
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

      // Automatically determine and assign Player of the Match
      try {
        await autoAssignPlayerOfTheMatch(matchId);
      } catch (potmErr) {
        console.error("Auto POTM assignment failed:", potmErr);
      }
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
 */
export async function autoAssignPlayerOfTheMatch(
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

export async function updateDlsTarget(
  matchId: string,
  inningsId: string,
  targetRuns: number,
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

  const { error } = await db
    .from("innings")
    .update({ target_runs: targetRuns })
    .eq("id", inningsId)
    .eq("match_id", matchId);

  if (error) {
    console.error("updateDlsTarget failed:", error);
    return { success: false, error: friendlyError(error.message) };
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
}): Promise<{ data: ScoringState | null; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to edit deliveries" };
    }

    const isAuthorized = await checkMatchAdminAuth(
      db,
      params.matchId,
      user.id,
    );
    if (!isAuthorized) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can edit deliveries",
      };
    }

    const { data, error } = await db.rpc("update_ball", {
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
    });

    if (error) {
      console.error("update_ball failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }

    invalidateMatchCache(params.matchId);
    revalidatePath(`/matches/${params.matchId}`);
    revalidatePath(`/matches/${params.matchId}/score`);
    return { data: data as ScoringState, error: null };
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
  title?: string;
  ballsPerOver?: number;
  maxBallsPerOver?: number | null;
  wideCountsAsBallFaced?: boolean;
  wideRunsToBatsman?: boolean;
  noballExtrasToBatsman?: boolean;
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

    const matchUpdates: Record<string, unknown> = {};
    if (settings.matchFormat !== undefined)
      matchUpdates.match_format = settings.matchFormat;
    if (settings.oversPerInnings !== undefined)
      matchUpdates.overs_per_innings = settings.oversPerInnings;
    if (settings.wicketsPerInnings !== undefined)
      matchUpdates.wickets_per_innings = settings.wicketsPerInnings;
    if (settings.lastManStands !== undefined)
      matchUpdates.last_man_stands = settings.lastManStands;
    if (settings.goldenBall !== undefined)
      matchUpdates.golden_ball = settings.goldenBall;
    if (settings.title !== undefined) matchUpdates.title = settings.title;
    if (settings.ballsPerOver !== undefined)
      matchUpdates.balls_per_over = settings.ballsPerOver;
    if (settings.maxBallsPerOver !== undefined)
      matchUpdates.max_balls_per_over = settings.maxBallsPerOver;
    if (settings.wideCountsAsBallFaced !== undefined)
      matchUpdates.wide_counts_as_ball_faced = settings.wideCountsAsBallFaced;
    if (settings.wideRunsToBatsman !== undefined)
      matchUpdates.wide_runs_to_batsman = settings.wideRunsToBatsman;
    if (settings.noballExtrasToBatsman !== undefined)
      matchUpdates.noball_extras_to_batsman = settings.noballExtrasToBatsman;

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

    if (settings.targetRuns !== undefined) {
      const { data: matchData } = await db
        .from("matches")
        .select("current_innings")
        .eq("id", matchId)
        .single();

      const currentInningsNum = matchData?.current_innings ?? 2;
      const { error: innErr } = await db
        .from("innings")
        .update({ target_runs: settings.targetRuns })
        .eq("match_id", matchId)
        .eq("innings_number", currentInningsNum);

      if (innErr) {
        console.error(
          "updateMatchSettings failed on innings target_runs:",
          innErr,
        );
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

export async function abandonMatch(
  matchId: string,
  params: {
    reason: string;
    resultType?: "abandoned" | "no_result" | "win";
    winningTeamId?: string | null;
    notes?: string | null;
  },
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

    const resultDescription = params.notes
      ? `Match abandoned: ${params.reason}. ${params.notes}`
      : `Match abandoned: ${params.reason}`;

    const updatePayload: Record<string, unknown> = {
      status: "abandoned",
      result_type: params.resultType ?? "abandoned",
      result_description: resultDescription,
      actual_end_time: new Date().toISOString(),
    };

    if (params.resultType === "win" && params.winningTeamId) {
      updatePayload.winning_team_id = params.winningTeamId;
    }

    const { error: matchErr } = await db
      .from("matches")
      .update(updatePayload)
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

export async function awardTeamPenalty(
  matchId: string,
  params: {
    teamId: string;
    runs: number;
    reason: string;
    type?: "penalty" | "bonus";
  },
): Promise<{ success: boolean; error: string | null }> {
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

    const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isMatchAdmin) {
      return {
        success: false,
        error: "Only match administrators or designated scorers can award penalty runs",
      };
    }

    const { data: match } = await db
      .from("matches")
      .select("*, innings(*)")
      .eq("id", matchId)
      .single();

    if (!match) return { success: false, error: "Match not found" };

    const currentInnings = match.innings?.find(
      (i: { innings_number: number }) => i.innings_number === match.current_innings,
    );

    if (!currentInnings) {
      return { success: false, error: "No active innings found to award penalty" };
    }

    const isBattingTeam = currentInnings.team_id === params.teamId;

    if (isBattingTeam) {
      // Logged in the ball log at the current crease, then the innings is
      // recomputed (one transaction).
      const { error: awardErr } = await db.rpc("award_penalty_runs", {
        p_match_id: matchId,
        p_runs: params.runs,
        p_type: awardType,
        p_reason: params.reason,
      });
      if (awardErr) {
        return { success: false, error: friendlyError(awardErr.message) };
      }
    } else {
      // First-innings awards to the fielding side have nothing to adjust
      // yet (there is no target); they were only ever logged before.
      if (match.current_innings !== 1) {
        const newTarget = Math.max(1, (currentInnings.target_runs ?? 0) - params.runs);
        await db
          .from("innings")
          .update({ target_runs: newTarget })
          .eq("id", currentInnings.id);
      }
    }

    await refreshLiveState(db, matchId);
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null };
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
  },
): Promise<{ success: boolean; error: string | null }> {
  try {
    const db = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await db.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "You must be logged in to retire a player" };
    }

    const isMatchAdmin = await checkMatchAdminAuth(db, matchId, user.id);
    if (!isMatchAdmin) {
      return {
        success: false,
        error: "Only match administrators or designated scorers can retire a player",
      };
    }

    const { error: retireErr } = await db.rpc("retire_batter", {
      p_match_id: matchId,
      p_player_id: params.playerId,
      p_type: params.type,
      p_reason: params.reason ?? null,
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

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    return { success: true, error: null };
  } catch (err) {
    console.error("Unexpected error in retirePlayer:", err);
    return {
      success: false,
      error: friendlyError(err instanceof Error ? err.message : "Failed to retire player"),
    };
  }
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

    const { data: match } = await db
      .from("matches")
      .select("current_innings")
      .eq("id", matchId)
      .single();

    const currentInningsNum = match?.current_innings ?? 2;

    const { error: innErr } = await db
      .from("innings")
      .update({ target_runs: params.targetRuns })
      .eq("match_id", matchId)
      .eq("innings_number", currentInningsNum);

    if (innErr) {
      return { success: false, error: friendlyError(innErr.message) };
    }

    if (params.overs !== undefined && params.overs !== null && params.overs > 0) {
      await db
        .from("matches")
        .update({ overs_per_innings: params.overs })
        .eq("id", matchId);
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

    await db.rpc("set_current_bowler", {
      p_match_id: matchId,
      p_bowler_id: newBowlerId,
    });

    // Credits the current over's deliveries to the new bowler and
    // recomputes the innings.
    const { error: reassignErr } = await db.rpc("reassign_over_bowler", {
      p_match_id: matchId,
      p_bowler_id: newBowlerId,
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

export interface MatchScorerUser {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

const SCORER_FIELDS = "id, full_name, avatar_url";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Finds registered players for the scorer picker: by id, by exact email
 * (looked up in server-only users_private, never returned) or by name.
 */
async function findScorerCandidates(
  db: Awaited<ReturnType<typeof createServerClient>>,
  target: string,
  limit: number,
): Promise<{ data: MatchScorerUser[]; error: string | null }> {
  if (UUID_RE.test(target)) {
    const { data, error } = await db
      .from("users")
      .select(SCORER_FIELDS)
      .eq("id", target)
      .limit(limit);
    return { data: (data ?? []) as MatchScorerUser[], error: error?.message ?? null };
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
      .select(SCORER_FIELDS)
      .in("id", ids);
    return {
      data: (data ?? []) as MatchScorerUser[],
      error: usersError?.message ?? null,
    };
  }
  // Word-prefix match on name / @username: reads at most `limit` profiles.
  const { data, error } = await prefixSearch(
    db,
    "users",
    target,
    SCORER_FIELDS,
    limit,
  );
  return { data: data as unknown as MatchScorerUser[], error };
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


