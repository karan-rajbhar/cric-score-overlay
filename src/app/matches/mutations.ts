"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "~/lib/supabase/server";
import { friendlyError } from "./errors";
import type { BallEvent, MatchFormData, ScoringState } from "./types";

export async function createMatch(formData: MatchFormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { data: null, error: "You must be logged in to create a match" };
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

export async function startMatch(
  matchId: string,
  tossWinnerId: string,
  tossDecision: "bat" | "bowl",
) {
  const supabase = await createServerClient();
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
  });
  if (error) {
    console.error("record_ball failed:", error);
    return { data: null, error: friendlyError(error.message) };
  }
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
}

export async function undoLastBall(
  matchId: string,
): Promise<{ data: ScoringState | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("undo_last_ball", {
    p_match_id: matchId,
  });
  if (error) {
    console.error("undo_last_ball failed:", error);
    return { data: null, error: friendlyError(error.message) };
  }
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/score`);
  revalidatePath(`/overlay/${matchId}`);
  return { data: data as ScoringState, error: null };
}

export async function setCurrentBatsmen(
  matchId: string,
  strikerId: string,
  nonStrikerId: string,
): Promise<{ error: string | null }> {
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
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/score`);
  revalidatePath(`/overlay/${matchId}`);
  return { error: null };
}

export async function setCurrentBowler(
  matchId: string,
  bowlerId: string,
): Promise<{ error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase.rpc("set_current_bowler", {
    p_match_id: matchId,
    p_bowler_id: bowlerId,
  });
  if (error) {
    console.error("set_current_bowler failed:", error);
    return { error: friendlyError(error.message) };
  }
  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/score`);
  revalidatePath(`/overlay/${matchId}`);
  return { error: null };
}

export async function endInnings(
  matchId: string,
): Promise<{ data: ScoringState | null; error: string | null }> {
  const supabase = await createServerClient();
  const { data, error } = await supabase.rpc("end_innings", {
    p_match_id: matchId,
  });
  if (error) {
    console.error("end_innings failed:", error);
    return { data: null, error: friendlyError(error.message) };
  }
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
}

export async function setPlayerOfTheMatch(
  matchId: string,
  playerId: string,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient();
  const { error } = await supabase
    .from("matches")
    .update({ player_of_the_match_id: playerId })
    .eq("id", matchId);

  if (error) {
    console.error("setPlayerOfTheMatch failed:", error);
    return { success: false, error: friendlyError(error.message) };
  }

  revalidatePath(`/matches/${matchId}`);
  revalidatePath(`/matches/${matchId}/score`);
  return { success: true, error: null };
}
