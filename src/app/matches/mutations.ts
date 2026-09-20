"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "~/lib/supabase/server";
import { ensureUserProfile } from "~/lib/supabase/user-profile";
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
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { data: null, error: "You must be logged in to create a match" };
  }

  await ensureUserProfile(supabase, user);

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
    supabase
      .from("teams")
      .select("id, name, created_by, captain_id, vice_captain_id, club_id")
      .in("id", [formData.team1Id, formData.team2Id]),
    formData.tournamentId
      ? supabase
          .from("tournaments")
          .select("id, created_by, club_id")
          .eq("id", formData.tournamentId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase
      .from("team_players")
      .select("team_id")
      .eq("user_id", user.id)
      .in("team_id", [formData.team1Id, formData.team2Id]),
    formData.tournamentId
      ? supabase
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
          supabase
            .from("clubs")
            .select("id, owner_id")
            .in("id", relevantClubIds),
          supabase
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

  const { data: match, error: matchError } = await supabase
    .from("matches")
    .insert({
      title: formData.title,
      match_format: formData.matchFormat,
      overs_per_innings: formData.oversPerInnings,
      team1_id: formData.team1Id,
      team2_id: formData.team2Id,
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
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  matchId: string,
  userId: string,
): Promise<boolean> {
  const { data: match } = await supabase
    .from("matches")
    .select("created_by, match_admins, club_id, tournament_id")
    .eq("id", matchId)
    .single();

  if (!match) return false;
  if (match.created_by === userId) return true;
  if ((match.match_admins ?? []).includes(userId)) return true;

  if (match.club_id) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", match.club_id)
      .single();

    if (club?.owner_id === userId) return true;

    const { data: mem } = await supabase
      .from("club_memberships")
      .select("id")
      .eq("club_id", match.club_id)
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .eq("status", "active")
      .maybeSingle();

    if (mem) return true;
  }

  if (match.tournament_id) {
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("created_by, club_id")
      .eq("id", match.tournament_id)
      .single();

    if (tournament?.created_by === userId) return true;

    if (tournament?.club_id) {
      const { data: club } = await supabase
        .from("clubs")
        .select("owner_id")
        .eq("id", tournament.club_id)
        .single();

      if (club?.owner_id === userId) return true;

      const { data: mem } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", tournament.club_id)
        .eq("user_id", userId)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .maybeSingle();

      if (mem) return true;
    }
  }

  return false;
}

export async function startMatch(
  matchId: string,
  tossWinnerId: string,
  tossDecision: "bat" | "bowl",
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { data: null, error: "You must be logged in to start the match" };
  }

  const isMatchAdmin = await checkMatchAdminAuth(supabase, matchId, user.id);
  if (!isMatchAdmin) {
    return {
      data: null,
      error: "Only match administrators or scorers can start this match",
    };
  }

  const { data: match, error: matchError } = await supabase
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
  const { error: updateError } = await supabase
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
  const { data: innings, error: inningsError } = await supabase
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
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to record scores" };
    }

    const isAuthorized = await checkMatchAdminAuth(
      supabase,
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

    const { data, error } = await supabase.rpc("record_ball", {
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
    });
    if (error) {
      console.error("record_ball failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    invalidateMatchCache(params.matchId);
    revalidatePath(`/matches/${params.matchId}`);

    if ((data as ScoringState)?.match_completed) {
      const { data: matchData } = await supabase
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

    if (params.event.shotZone) {
      const { data: latestBall } = await supabase
        .from("ball_by_ball")
        .select("id")
        .eq("match_id", params.matchId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();
      if (latestBall?.id) {
        await supabase
          .from("ball_by_ball")
          .update({ shot_zone: params.event.shotZone })
          .eq("id", latestBall.id);
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
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to undo deliveries" };
    }

    const isAuthorized = await checkMatchAdminAuth(supabase, matchId, user.id);
    if (!isAuthorized) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can undo deliveries",
      };
    }

    const { data, error } = await supabase.rpc("undo_last_ball", {
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
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to set batsmen" };
    }

    const isAuthorized = await checkMatchAdminAuth(supabase, matchId, user.id);
    if (!isAuthorized) {
      return {
        error:
          "Only match administrators or designated scorers can set batsmen",
      };
    }

    const { error } = await supabase.rpc("set_current_batsmen", {
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
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "You must be logged in to set bowler" };
    }

    const isAuthorized = await checkMatchAdminAuth(supabase, matchId, user.id);
    if (!isAuthorized) {
      return {
        error:
          "Only match administrators or designated scorers can set bowler",
      };
    }

    const { error } = await supabase.rpc("set_current_bowler", {
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
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to end innings" };
    }

    const isAuthorized = await checkMatchAdminAuth(supabase, matchId, user.id);
    if (!isAuthorized) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can end innings",
      };
    }

    const { data, error } = await supabase.rpc("end_innings", {
      p_match_id: matchId,
    });
    if (error) {
      console.error("end_innings failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);

    if ((data as ScoringState)?.match_completed) {
      const { data: matchData } = await supabase
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
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in" };
  }

  const isMatchAdmin = await checkMatchAdminAuth(supabase, matchId, user.id);
  if (!isMatchAdmin) {
    return {
      success: false,
      error: "Only match administrators can set the Player of the Match",
    };
  }

  const { error } = await supabase
    .from("matches")
    .update({ player_of_the_match_id: playerId })
    .eq("id", matchId);

  if (error) {
    console.error("setPlayerOfTheMatch failed:", error);
    return { success: false, error: friendlyError(error.message) };
  }

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

    const supabase = await createServerClient();
    const { error } = await supabase
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

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
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
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "You must be logged in" };
  }

  const isMatchAdmin = await checkMatchAdminAuth(supabase, matchId, user.id);
  if (!isMatchAdmin) {
    return {
      success: false,
      error: "Only match administrators can update the DLS target",
    };
  }

  const { error } = await supabase
    .from("innings")
    .update({ target_runs: targetRuns })
    .eq("id", inningsId)
    .eq("match_id", matchId);

  if (error) {
    console.error("updateDlsTarget failed:", error);
    return { success: false, error: friendlyError(error.message) };
  }

  invalidateMatchCache(matchId);
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/score`);
  revalidatePath(`/overlay/${matchId}`);
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
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to edit deliveries" };
    }

    const isAuthorized = await checkMatchAdminAuth(
      supabase,
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

    if (params.batsmanId || params.bowlerId) {
      const playerUpdates: Record<string, string> = {};
      if (params.batsmanId) playerUpdates.batsman_id = params.batsmanId;
      if (params.bowlerId) playerUpdates.bowler_id = params.bowlerId;
      await supabase
        .from("ball_by_ball")
        .update(playerUpdates)
        .eq("id", params.ballId);
    }

    const { data, error } = await supabase.rpc("update_ball", {
      p_match_id: params.matchId,
      p_ball_id: params.ballId,
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
    revalidatePath(`/overlay/${params.matchId}`);
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
    const supabase = await createServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { data: null, error: "You must be logged in to start a super over" };
    }

    const isAuthorized = await checkMatchAdminAuth(supabase, matchId, user.id);
    if (!isAuthorized) {
      return {
        data: null,
        error:
          "Only match administrators or designated scorers can start a super over",
      };
    }

    const { data, error } = await supabase.rpc("start_super_over", {
      p_match_id: matchId,
    });

    if (error) {
      console.error("start_super_over failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
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

    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "You must be logged in to update match settings",
      };
    }

    const isMatchAdmin = await checkMatchAdminAuth(supabase, matchId, user.id);
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

    if (Object.keys(matchUpdates).length > 0) {
      const { error: matchErr } = await supabase
        .from("matches")
        .update(matchUpdates)
        .eq("id", matchId);
      if (matchErr) {
        console.error("updateMatchSettings failed on matches:", matchErr);
        return { success: false, error: friendlyError(matchErr.message) };
      }
    }

    if (settings.targetRuns !== undefined) {
      const { data: matchData } = await supabase
        .from("matches")
        .select("current_innings")
        .eq("id", matchId)
        .single();

      const currentInningsNum = matchData?.current_innings ?? 2;
      const { error: innErr } = await supabase
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

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
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

export async function reassignCurrentOverBowler(
  matchId: string,
  newBowlerId: string,
): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return {
        success: false,
        error: "You must be logged in to modify bowler",
      };
    }

    const isMatchAdmin = await checkMatchAdminAuth(supabase, matchId, user.id);
    if (!isMatchAdmin) {
      return {
        success: false,
        error:
          "Only match administrators or designated scorers can reassign bowler",
      };
    }

    const { data: matchData, error: matchErr } = await supabase
      .from("matches")
      .select("current_innings, current_over, current_ball")
      .eq("id", matchId)
      .single();

    if (matchErr || !matchData) {
      return { success: false, error: "Match not found" };
    }

    const { data: innData } = await supabase
      .from("innings")
      .select("id")
      .eq("match_id", matchId)
      .eq("innings_number", matchData.current_innings)
      .single();

    if (!innData) {
      return { success: false, error: "Innings not found" };
    }

    await supabase.rpc("set_current_bowler", {
      p_match_id: matchId,
      p_bowler_id: newBowlerId,
    });

    const { error: ballUpdateErr } = await supabase
      .from("ball_by_ball")
      .update({ bowler_id: newBowlerId })
      .eq("innings_id", innData.id)
      .eq("over_number", matchData.current_over);

    if (ballUpdateErr) {
      console.error(
        "Failed to reassign ball_by_ball to new bowler:",
        ballUpdateErr,
      );
    }

    await supabase.rpc("recompute_innings", {
      p_innings_id: innData.id,
    });

    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
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
  email: string | null;
  avatar_url: string | null;
}

export async function getMatchScorers(matchId: string): Promise<{
  data: {
    createdBy: MatchScorerUser | null;
    matchAdmins: MatchScorerUser[];
  } | null;
  error: string | null;
}> {
  try {
    const supabase = await createServerClient();
    const { data: match, error: matchErr } = await supabase
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

    const { data: users, error: userErr } = await supabase
      .from("users")
      .select("id, full_name, email, avatar_url")
      .in("id", allUserIds);

    if (userErr) {
      return { data: null, error: userErr.message };
    }

    const userMap = new Map(
      (users ?? []).map((u) => [u.id, u as MatchScorerUser]),
    );
    const createdBy = userMap.get(match.created_by) ?? null;
    const matchAdmins = (match.match_admins ?? [])
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

export async function addMatchScorer(
  matchId: string,
  emailOrUserId: string,
): Promise<{
  success: boolean;
  user?: MatchScorerUser;
  error: string | null;
}> {
  try {
    const supabase = await createServerClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return { success: false, error: "You must be logged in" };
    }

    const authorized = await checkMatchAdminAuth(
      supabase,
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
      return { success: false, error: "Please provide a user email or ID" };
    }

    const isUuid =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        queryTarget,
      );

    let query = supabase
      .from("users")
      .select("id, full_name, email, avatar_url");
    if (isUuid) {
      query = query.eq("id", queryTarget);
    } else {
      query = query.ilike("email", queryTarget);
    }

    const { data: targetUsers, error: userFindErr } = await query.limit(1);
    if (userFindErr) {
      return { success: false, error: userFindErr.message };
    }

    const targetUser = targetUsers?.[0] as MatchScorerUser | undefined;
    if (!targetUser) {
      return {
        success: false,
        error: `No registered player found with ${isUuid ? "ID" : "email"} "${queryTarget}"`,
      };
    }

    const { data: match, error: matchErr } = await supabase
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
    const { error: updateErr } = await supabase
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
    const supabase = await createServerClient();
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    if (!currentUser) {
      return { success: false, error: "You must be logged in" };
    }

    const authorized = await checkMatchAdminAuth(
      supabase,
      matchId,
      currentUser.id,
    );
    if (!authorized) {
      return {
        success: false,
        error: "Not authorized to manage match scorers",
      };
    }

    const { data: match, error: matchErr } = await supabase
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

    const { error: updateErr } = await supabase
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


