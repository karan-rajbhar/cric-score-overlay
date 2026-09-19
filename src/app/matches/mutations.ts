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

  // Fetch Team 1 details to verify ownership and authorization
  const { data: team1, error: team1Err } = await supabase
    .from("teams")
    .select("id, name, created_by, captain_id, vice_captain_id, club_id")
    .eq("id", formData.team1Id)
    .single();

  if (team1Err || !team1) {
    return { data: null, error: "Selected Team 1 does not exist" };
  }

  // Authorization check for Team 1:
  // User is authorized if:
  // 1. User created the team or is captain/vice-captain
  // 2. OR user is on team squad
  // 3. OR user is admin/owner of team's club
  // 4. OR user is organizer/admin of the linked tournament
  // 5. OR user is admin/owner of the linked club (and team belongs to that club)
  let isAuthorized =
    team1.created_by === user.id ||
    team1.captain_id === user.id ||
    team1.vice_captain_id === user.id;

  if (!isAuthorized) {
    const { data: playerMembership } = await supabase
      .from("team_players")
      .select("id")
      .eq("team_id", formData.team1Id)
      .eq("user_id", user.id)
      .limit(1)
      .maybeSingle();

    if (playerMembership) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized && team1.club_id) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", team1.club_id)
      .single();

    if (club?.owner_id === user.id) {
      isAuthorized = true;
    } else {
      const { data: membership } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", team1.club_id)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (membership) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized && formData.tournamentId) {
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id, created_by, club_id")
      .eq("id", formData.tournamentId)
      .single();

    if (tournament) {
      if (tournament.created_by === user.id) {
        isAuthorized = true;
      } else if (tournament.club_id) {
        const { data: club } = await supabase
          .from("clubs")
          .select("owner_id")
          .eq("id", tournament.club_id)
          .single();

        if (club?.owner_id === user.id) {
          isAuthorized = true;
        } else {
          const { data: membership } = await supabase
            .from("club_memberships")
            .select("id")
            .eq("club_id", tournament.club_id)
            .eq("user_id", user.id)
            .in("role", ["owner", "admin"])
            .eq("status", "active")
            .limit(1)
            .maybeSingle();

          if (membership) {
            isAuthorized = true;
          }
        }
      }
    }
  }

  if (!isAuthorized && formData.clubId && team1.club_id === formData.clubId) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", formData.clubId)
      .single();

    if (club?.owner_id === user.id) {
      isAuthorized = true;
    } else {
      const { data: membership } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", formData.clubId)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (membership) {
        isAuthorized = true;
      }
    }
  }

  // Validate tournamentId association if provided
  if (formData.tournamentId) {
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("id, created_by, club_id")
      .eq("id", formData.tournamentId)
      .single();

    if (!tournament) {
      return { data: null, error: "Selected tournament does not exist" };
    }

    let isTournamentOrganizer = tournament.created_by === user.id;
    if (!isTournamentOrganizer && tournament.club_id) {
      const { data: club } = await supabase
        .from("clubs")
        .select("owner_id")
        .eq("id", tournament.club_id)
        .single();
      if (club?.owner_id === user.id) {
        isTournamentOrganizer = true;
      } else {
        const { data: mem } = await supabase
          .from("club_memberships")
          .select("id")
          .eq("club_id", tournament.club_id)
          .eq("user_id", user.id)
          .in("role", ["owner", "admin"])
          .eq("status", "active")
          .maybeSingle();
        if (mem) isTournamentOrganizer = true;
      }
    }

    if (!isTournamentOrganizer) {
      const { data: regs } = await supabase
        .from("tournament_registrations")
        .select("team_id")
        .eq("tournament_id", formData.tournamentId)
        .in("team_id", [formData.team1Id, formData.team2Id]);

      if (!regs || regs.length === 0) {
        return {
          data: null,
          error:
            "Neither team is registered in the selected tournament, and you are not an organizer of this tournament.",
        };
      }
    }
  }

  // Validate clubId association if provided
  if (formData.clubId) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", formData.clubId)
      .single();

    if (!club) {
      return { data: null, error: "Selected club does not exist" };
    }

    let isClubAdmin = club.owner_id === user.id;
    if (!isClubAdmin) {
      const { data: mem } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", formData.clubId)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .maybeSingle();
      if (mem) isClubAdmin = true;
    }

    if (!isClubAdmin && team1.club_id !== formData.clubId) {
      return {
        data: null,
        error:
          "You can only link matches to a club you manage or that your team belongs to.",
      };
    }
  }

  if (!isAuthorized) {
    return {
      data: null,
      error:
        "You do not have permission to create matches for Team 1. You must be an owner, captain, or squad member of Team 1, or an administrator of the linked club or tournament.",
    };
  }

  // Validate Team 2 (Opponent) eligibility under Option 1:
  if (formData.tournamentId) {
    // 1. In tournament matches, opponent must be registered in the tournament
    const { data: reg2 } = await supabase
      .from("tournament_registrations")
      .select("team_id")
      .eq("tournament_id", formData.tournamentId)
      .eq("team_id", formData.team2Id)
      .maybeSingle();

    if (!reg2) {
      return {
        data: null,
        error:
          "The selected opponent team is not registered in this tournament.",
      };
    }
  } else if (formData.clubId) {
    // 2. In club matches, opponent must belong to the club or user must have access
    const { data: team2 } = await supabase
      .from("teams")
      .select("id, club_id, created_by, captain_id, vice_captain_id")
      .eq("id", formData.team2Id)
      .single();

    if (!team2) {
      return { data: null, error: "Opponent team does not exist." };
    }

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
    // 3. In independent matches, opponent must be managed/created by user
    const { data: team2 } = await supabase
      .from("teams")
      .select("id, club_id, created_by, captain_id, vice_captain_id")
      .eq("id", formData.team2Id)
      .single();

    if (!team2) {
      return { data: null, error: "Opponent team does not exist." };
    }

    let isTeam2Authorized =
      team2.created_by === user.id ||
      team2.captain_id === user.id ||
      team2.vice_captain_id === user.id;

    if (!isTeam2Authorized && team2.club_id) {
      const { data: mem } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", team2.club_id)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .maybeSingle();
      if (mem) isTeam2Authorized = true;
    }

    if (!isTeam2Authorized) {
      const { data: playerOnTeam2 } = await supabase
        .from("team_players")
        .select("id")
        .eq("team_id", formData.team2Id)
        .eq("user_id", user.id)
        .maybeSingle();
      if (playerOnTeam2) isTeam2Authorized = true;
    }

    if (!isTeam2Authorized) {
      return {
        data: null,
        error:
          "You can only select an opponent team you manage, or create a new opponent team for this match. You cannot schedule matches against other clubs' official teams without authorization.",
      };
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
    .select("created_by, match_admins, club_id")
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
    revalidatePath(`/matches/${params.matchId}/score`);
    revalidatePath(`/overlay/${params.matchId}`);

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
    const { data, error } = await supabase.rpc("undo_last_ball", {
      p_match_id: matchId,
    });
    if (error) {
      console.error("undo_last_ball failed:", error);
      return { data: null, error: friendlyError(error.message) };
    }
    invalidateMatchCache(matchId);
    revalidatePath(`/matches/${matchId}`);
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
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
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
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
    revalidatePath(`/matches/${matchId}/score`);
    revalidatePath(`/overlay/${matchId}`);
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
}): Promise<{ data: ScoringState | null; error: string | null }> {
  try {
    const supabase = await createServerClient();
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
