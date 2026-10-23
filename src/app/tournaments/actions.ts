"use server";

import { createServerClient } from "~/lib/firebase/server";
import { canManageTeam, isClubAdminOf } from "~/lib/firebase/permissions";
import { refreshLiveMatchesFor } from "~/lib/firebase/live-sync";
import { ensureUserProfile } from "~/lib/firebase/user-profile";
import { teamSnapshot } from "~/lib/firebase/team-snapshot";
import type { TeamSnapshot } from "~/lib/firebase/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TOURNAMENT_STATUSES, tournamentRulesFrom } from "./rules";

export async function createTournament(formData: FormData) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  await ensureUserProfile(db, user);

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Tournament name is required" };

  const clubId = (formData.get("club_id") as string) || null;

  const rules = tournamentRulesFrom(formData);
  if ("error" in rules) return { error: rules.error };

  if (clubId) {
    const { data: club } = await db
      .from("clubs")
      .select("owner_id")
      .eq("id", clubId)
      .single();

    if (!club) {
      return { error: "The selected club does not exist" };
    }

    if (club.owner_id !== user.id) {
      const { data: membership } = await db
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

  const { data, error } = await db
    .from("tournaments")
    .insert({
      name,
      description: (formData.get("description") as string) || null,
      tournament_format:
        (formData.get("tournament_format") as string) || "league",
      match_format: rules.match_format,
      overs_per_innings: rules.overs_per_innings,
      ...(rules.wickets_per_innings !== null
        ? { wickets_per_innings: rules.wickets_per_innings }
        : {}),
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
  db: Awaited<ReturnType<typeof createServerClient>>,
  tournamentId: string,
  userId: string,
): Promise<boolean> {
  const { data: tournament } = await db
    .from("tournaments")
    .select("created_by, club_id")
    .eq("id", tournamentId)
    .single();

  if (!tournament) return false;
  if (tournament.created_by === userId) return true;
  return isClubAdminOf(db, tournament.club_id, userId);
}

export async function registerTeamForTournament(
  tournamentId: string,
  teamId: string,
) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in to register a team" };

  await ensureUserProfile(db, user);

  const isTournAdmin = await checkTournamentAdminAuth(
    db,
    tournamentId,
    user.id,
  );
  const isTeamRep = await canManageTeam(db, teamId, user.id);

  if (!isTournAdmin && !isTeamRep) {
    return {
      error: "You can only register teams that you represent or manage.",
    };
  }

  // Organisers add teams directly; a team's own request waits for them.
  const status = isTournAdmin ? "confirmed" : "pending";
  const { error: regError } = await db
    .from("tournament_registrations")
    .insert({
      tournament_id: tournamentId,
      team_id: teamId,
      registered_by: user.id,
      status,
      payment_status: isTournAdmin ? "paid" : "pending",
    });

  if (regError) {
    console.error("registerTeamForTournament error:", regError);
    return { error: regError.message };
  }

  if (status === "confirmed") {
    // Initialise the team's row in the points table.
    await db.rpc("recalculate_tournament_standings", {
      p_tournament_id: tournamentId,
    });
  }

  const { data: tourn } = await db
    .from("tournaments")
    .select("club_id")
    .eq("id", tournamentId)
    .single();

  revalidatePath(`/tournaments/${tournamentId}`);
  if (tourn?.club_id) {
    revalidatePath(`/clubs/${tourn.club_id}`);
  }
  return { success: true, status };
}

export async function refreshTournamentStandings(tournamentId: string) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const canManage = await checkTournamentAdminAuth(
    db,
    tournamentId,
    user.id,
  );
  if (!canManage) {
    return { error: "Only tournament organizers can refresh standings" };
  }

  const { error } = await db.rpc("recalculate_tournament_standings", {
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
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const isTournAdmin = await checkTournamentAdminAuth(
    db,
    tournamentId,
    user.id,
  );
  if (!isTournAdmin) {
    return {
      error: "Only tournament organizers can modify points table entries.",
    };
  }

  const { error } = await db
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
  await db.rpc("recalculate_tournament_standings", {
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
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const isTournAdmin = await checkTournamentAdminAuth(
    db,
    tournamentId,
    user.id,
  );
  if (!isTournAdmin) {
    return {
      error: "Only tournament organizers can approve or reject registrations.",
    };
  }

  const { error } = await db
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
    await db.rpc("recalculate_tournament_standings", {
      p_tournament_id: tournamentId,
    });
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

/**
 * Round-robin fixtures for the confirmed teams, one round a day starting at
 * `firstMatchAt` (an ISO timestamp the organiser's browser builds from
 * their local day and time). Without it: the start date (or today) at
 * 10:00 UTC.
 */
export async function generateTournamentFixtures(
  tournamentId: string,
  firstMatchAt?: string,
) {
  const { generateRoundRobinFixtures } = await import(
    "~/lib/tournament-scheduler"
  );
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  await ensureUserProfile(db, user);

  const isTournAdmin = await checkTournamentAdminAuth(
    db,
    tournamentId,
    user.id,
  );
  if (!isTournAdmin) {
    return {
      error: "Only tournament organizers can generate round-robin fixtures.",
    };
  }

  const chosen = firstMatchAt ? new Date(firstMatchAt) : null;
  if (chosen && Number.isNaN(chosen.getTime())) {
    return { error: "Pick the first match's day and time" };
  }

  // Fetch tournament details
  const { data: tournament, error: tourError } = await db
    .from("tournaments")
    .select(
      "id, name, match_format, overs_per_innings, venue, start_date, club_id, wickets_per_innings, last_man_stands, golden_ball, season_id",
    )
    .eq("id", tournamentId)
    .single();

  if (tourError || !tournament)
    return { error: tourError?.message ?? "Tournament not found" };

  // Fetch confirmed teams
  const { data: regs, error: regError } = await db
    .from("tournament_registrations")
    .select(
      "team_id, team:teams(id, name, short_name, logo_url, primary_color, secondary_color)",
    )
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

  const teamById = new Map<string, TeamSnapshot>();
  regs.forEach((r) => {
    if (r.team && !Array.isArray(r.team)) {
      teamById.set(r.team_id, teamSnapshot(r.team as TeamSnapshot));
    }
  });

  const fallback = new Date(
    tournament.start_date
      ? `${tournament.start_date}T10:00:00.000Z`
      : new Date().toISOString().slice(0, 10) + "T10:00:00.000Z",
  );
  const startDate =
    chosen ?? (Number.isNaN(fallback.getTime()) ? new Date() : fallback);

  const matchesToInsert = pairings.map((p) => {
    const team1 = teamById.get(p.homeTeamId) ?? null;
    const team2 = teamById.get(p.awayTeamId) ?? null;
    const team1Name = team1?.name ?? "Team 1";
    const team2Name = team2?.name ?? "Team 2";
    const matchDate = new Date(startDate.getTime() + (p.round - 1) * 86400000);

    return {
      title: `${team1Name} vs ${team2Name} (Round ${p.round})`,
      match_format: tournament.match_format ?? "T20",
      overs_per_innings: tournament.overs_per_innings ?? 20,
      team1_id: p.homeTeamId,
      team2_id: p.awayTeamId,
      team1_snapshot: team1,
      team2_snapshot: team2,
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

  const { error: insertError } = await db
    .from("matches")
    .insert(matchesToInsert);
  if (insertError) {
    console.error("Error inserting generated fixtures:", insertError);
    return { error: insertError.message };
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true, count: matchesToInsert.length };
}

export async function updateTournament(
  tournamentId: string,
  formData: FormData,
) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const isTournAdmin = await checkTournamentAdminAuth(
    db,
    tournamentId,
    user.id,
  );
  if (!isTournAdmin) {
    return {
      error: "Only tournament organizers or club admins can edit this tournament",
    };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Tournament name is required" };

  const description = (formData.get("description") as string)?.trim() || null;
  const tournament_format =
    (formData.get("tournament_format") as string) || "league";
  const venue = (formData.get("venue") as string)?.trim() || null;
  const start_date = (formData.get("start_date") as string) || null;
  const end_date = (formData.get("end_date") as string) || null;
  const season_id = (formData.get("season_id") as string) || null;
  const is_public = formData.get("is_public") !== "false";

  const rules = tournamentRulesFrom(formData);
  if ("error" in rules) return { error: rules.error };
  const { match_format, overs_per_innings, wickets_per_innings } = rules;

  const rawStatus = (formData.get("status") as string | null) || null;
  if (rawStatus && !TOURNAMENT_STATUSES.has(rawStatus)) {
    return { error: "Unknown tournament status" };
  }
  if (start_date && end_date && end_date < start_date) {
    return { error: "The end date is before the start date" };
  }

  const last_man_stands = formData.get("last_man_stands") === "true";
  const golden_ball = formData.get("golden_ball") === "true";

  const { data: currentTourn } = await db
    .from("tournaments")
    .select("club_id")
    .eq("id", tournamentId)
    .single();

  const { error } = await db
    .from("tournaments")
    .update({
      name,
      description,
      tournament_format,
      match_format,
      overs_per_innings,
      ...(wickets_per_innings !== null ? { wickets_per_innings } : {}),
      ...(rawStatus ? { status: rawStatus } : {}),
      last_man_stands,
      golden_ball,
      venue,
      start_date,
      end_date,
      season_id: season_id && season_id !== "none" ? season_id : null,
      is_public,
      updated_at: new Date().toISOString(),
    })
    .eq("id", tournamentId);

  if (error) {
    console.error("updateTournament error:", error);
    return { error: error.message };
  }

  await refreshLiveMatchesFor(db, { tournamentId });

  revalidatePath(`/tournaments/${tournamentId}`);
  revalidatePath("/tournaments");
  if (currentTourn?.club_id) {
    revalidatePath(`/clubs/${currentTourn.club_id}`);
  }

  return { success: true };
}

export async function deleteTournament(tournamentId: string) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const isTournAdmin = await checkTournamentAdminAuth(
    db,
    tournamentId,
    user.id,
  );
  if (!isTournAdmin) {
    return {
      error:
        "Only tournament organizers or club admins can delete this tournament",
    };
  }

  const { data: tournament } = await db
    .from("tournaments")
    .select("club_id")
    .eq("id", tournamentId)
    .single();

  const { error } = await db
    .from("tournaments")
    .delete()
    .eq("id", tournamentId);

  if (error) {
    console.error("deleteTournament error:", error);
    return { error: error.message };
  }

  revalidatePath("/tournaments");
  if (tournament?.club_id) {
    revalidatePath(`/clubs/${tournament.club_id}`);
  }

  return { success: true };
}

