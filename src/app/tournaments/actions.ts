"use server";

import { createServerClient } from "~/lib/supabase/server";
import { ensureUserProfile } from "~/lib/supabase/user-profile";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTournament(formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  await ensureUserProfile(supabase, user);

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Tournament name is required" };

  const clubId = (formData.get("club_id") as string) || null;

  if (clubId) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", clubId)
      .single();

    if (!club) {
      return { error: "The selected club does not exist" };
    }

    if (club.owner_id !== user.id) {
      const { data: membership } = await supabase
        .from("club_memberships")
        .select("id")
        .eq("club_id", clubId)
        .eq("user_id", user.id)
        .in("role", ["owner", "admin"])
        .eq("status", "active")
        .maybeSingle();

      if (!membership) {
        return {
          error:
            "You are not authorized to create a tournament under this club",
        };
      }
    }
  }

  const { data, error } = await supabase
    .from("tournaments")
    .insert({
      name,
      description: (formData.get("description") as string) || null,
      tournament_format:
        (formData.get("tournament_format") as string) || "league",
      match_format: (formData.get("match_format") as string) || "T20",
      venue: (formData.get("venue") as string) || null,
      start_date: (formData.get("start_date") as string) || null,
      end_date: (formData.get("end_date") as string) || null,
      club_id: clubId,
      created_by: user.id,
      status: "upcoming",
    })
    .select("id")
    .single();

  if (error) {
    console.error("createTournament:", error);
    return { error: error.message };
  }

  revalidatePath("/tournaments");
  if (clubId) {
    revalidatePath(`/clubs/${clubId}`);
  }
  redirect(`/tournaments/${data.id}`);
}

async function checkTournamentAdminAuth(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  tournamentId: string,
  userId: string,
): Promise<boolean> {
  const { data: tournament } = await supabase
    .from("tournaments")
    .select("created_by, club_id")
    .eq("id", tournamentId)
    .single();

  if (!tournament) return false;
  if (tournament.created_by === userId) return true;

  if (tournament.club_id) {
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

  return false;
}

async function checkTeamRepAuth(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  teamId: string,
  userId: string,
): Promise<boolean> {
  const { data: team } = await supabase
    .from("teams")
    .select("created_by, captain_id, vice_captain_id, club_id")
    .eq("id", teamId)
    .single();

  if (!team) return false;
  if (
    team.created_by === userId ||
    team.captain_id === userId ||
    team.vice_captain_id === userId
  ) {
    return true;
  }

  if (team.club_id) {
    const { data: club } = await supabase
      .from("clubs")
      .select("owner_id")
      .eq("id", team.club_id)
      .single();
    if (club?.owner_id === userId) return true;

    const { data: mem } = await supabase
      .from("club_memberships")
      .select("id")
      .eq("club_id", team.club_id)
      .eq("user_id", userId)
      .in("role", ["owner", "admin"])
      .eq("status", "active")
      .maybeSingle();
    if (mem) return true;
  }

  return false;
}

export async function registerTeamForTournament(
  tournamentId: string,
  teamId: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to register a team" };

  await ensureUserProfile(supabase, user);

  const isTournAdmin = await checkTournamentAdminAuth(
    supabase,
    tournamentId,
    user.id,
  );
  const isTeamRep = await checkTeamRepAuth(supabase, teamId, user.id);

  if (!isTournAdmin && !isTeamRep) {
    return {
      error: "You can only register teams that you represent or manage.",
    };
  }

  const { error: regError } = await supabase
    .from("tournament_registrations")
    .insert({
      tournament_id: tournamentId,
      team_id: teamId,
      registered_by: user.id,
      status: "confirmed",
      payment_status: "paid",
    });

  if (regError) {
    console.error("registerTeamForTournament error:", regError);
    return { error: regError.message };
  }

  // Trigger recalculation to initialize standings row for this team
  await supabase.rpc("recalculate_tournament_standings", {
    p_tournament_id: tournamentId,
  });

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function removeTeamFromTournament(
  tournamentId: string,
  teamId: string,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const isTournAdmin = await checkTournamentAdminAuth(
    supabase,
    tournamentId,
    user.id,
  );
  const isTeamRep = await checkTeamRepAuth(supabase, teamId, user.id);

  if (!isTournAdmin && !isTeamRep) {
    return {
      error:
        "Only tournament organizers or team managers can withdraw this team.",
    };
  }

  const { error } = await supabase
    .from("tournament_registrations")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("team_id", teamId);

  if (error) {
    console.error("removeTeamFromTournament error:", error);
    return { error: error.message };
  }

  // Remove from standings as well
  await supabase
    .from("tournament_standings")
    .delete()
    .eq("tournament_id", tournamentId)
    .eq("team_id", teamId);

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function refreshTournamentStandings(tournamentId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const canManage = await checkTournamentAdminAuth(
    supabase,
    tournamentId,
    user.id,
  );
  if (!canManage) {
    return { error: "Only tournament organizers can refresh standings" };
  }

  const { error } = await supabase.rpc("recalculate_tournament_standings", {
    p_tournament_id: tournamentId,
  });

  if (error) {
    console.error("refreshTournamentStandings error:", error);
    return { error: error.message };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function overridePointsTableEntry(
  tournamentId: string,
  teamId: string,
  adjustment: number,
  reason?: string | null,
  qualificationStatus?: "in_contention" | "qualified" | "eliminated",
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const isTournAdmin = await checkTournamentAdminAuth(
    supabase,
    tournamentId,
    user.id,
  );
  if (!isTournAdmin) {
    return {
      error: "Only tournament organizers can modify points table entries.",
    };
  }

  const { error } = await supabase
    .from("tournament_standings")
    .update({
      points_adjustment: adjustment,
      adjustment_reason: reason ?? null,
      qualification_status: qualificationStatus ?? "in_contention",
    })
    .eq("tournament_id", tournamentId)
    .eq("team_id", teamId);

  if (error) {
    console.error("overridePointsTableEntry error:", error);
    return { error: error.message };
  }

  // Recalculate to apply adjustment to total points
  await supabase.rpc("recalculate_tournament_standings", {
    p_tournament_id: tournamentId,
  });

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function updateRegistrationStatus(
  registrationId: string,
  tournamentId: string,
  status: "confirmed" | "rejected",
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const isTournAdmin = await checkTournamentAdminAuth(
    supabase,
    tournamentId,
    user.id,
  );
  if (!isTournAdmin) {
    return {
      error: "Only tournament organizers can approve or reject registrations.",
    };
  }

  const { error } = await supabase
    .from("tournament_registrations")
    .update({
      status,
      approved_by: user.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", registrationId);

  if (error) {
    console.error("updateRegistrationStatus error:", error);
    return { error: error.message };
  }

  if (status === "confirmed") {
    await supabase.rpc("recalculate_tournament_standings", {
      p_tournament_id: tournamentId,
    });
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

export async function generateTournamentFixtures(tournamentId: string) {
  const { generateRoundRobinFixtures } = await import(
    "~/lib/tournament-scheduler"
  );
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  await ensureUserProfile(supabase, user);

  const isTournAdmin = await checkTournamentAdminAuth(
    supabase,
    tournamentId,
    user.id,
  );
  if (!isTournAdmin) {
    return {
      error: "Only tournament organizers can generate round-robin fixtures.",
    };
  }

  // Fetch tournament details
  const { data: tournament, error: tourError } = await supabase
    .from("tournaments")
    .select(
      "id, name, match_format, overs_per_innings, venue, start_date, club_id, wickets_per_innings, last_man_stands, golden_ball, season_id",
    )
    .eq("id", tournamentId)
    .single();

  if (tourError || !tournament)
    return { error: tourError?.message ?? "Tournament not found" };

  // Fetch confirmed teams
  const { data: regs, error: regError } = await supabase
    .from("tournament_registrations")
    .select("team_id, team:teams(id, name)")
    .eq("tournament_id", tournamentId)
    .eq("status", "confirmed");

  if (regError) return { error: regError.message };
  if (!regs || regs.length < 2)
    return {
      error: "At least 2 confirmed teams are required to generate fixtures.",
    };

  const teamIds = regs.map((r) => r.team_id).filter(Boolean) as string[];
  const pairings = generateRoundRobinFixtures(teamIds);

  if (pairings.length === 0) return { error: "No pairings could be generated" };

  const teamNameMap = new Map<string, string>();
  regs.forEach((r) => {
    if (r.team && !Array.isArray(r.team)) {
      teamNameMap.set(r.team_id, (r.team as { id: string; name: string }).name);
    }
  });

  const startDate = tournament.start_date
    ? new Date(tournament.start_date)
    : new Date();

  const matchesToInsert = pairings.map((p) => {
    const team1Name = teamNameMap.get(p.homeTeamId) ?? "Team 1";
    const team2Name = teamNameMap.get(p.awayTeamId) ?? "Team 2";
    const matchDate = new Date(startDate.getTime() + (p.round - 1) * 86400000);

    return {
      title: `${team1Name} vs ${team2Name} (Round ${p.round})`,
      match_format: tournament.match_format ?? "T20",
      overs_per_innings: tournament.overs_per_innings ?? 20,
      team1_id: p.homeTeamId,
      team2_id: p.awayTeamId,
      tournament_id: tournament.id,
      club_id: tournament.club_id,
      season_id: tournament.season_id,
      wickets_per_innings: tournament.wickets_per_innings ?? 10,
      last_man_stands: tournament.last_man_stands ?? false,
      golden_ball: tournament.golden_ball ?? false,
      venue: tournament.venue,
      scheduled_at: matchDate.toISOString(),
      status: "scheduled",
      created_by: user.id,
      match_admins: [user.id],
    };
  });

  const { error: insertError } = await supabase
    .from("matches")
    .insert(matchesToInsert);
  if (insertError) {
    console.error("Error inserting generated fixtures:", insertError);
    return { error: insertError.message };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true, count: matchesToInsert.length };
}
