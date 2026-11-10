"use server";

import { createServerClient } from "~/lib/firebase/server";
import { canManageTeam, isClubAdminOf } from "~/lib/firebase/permissions";
import { refreshLiveMatchesFor } from "~/lib/firebase/live-sync";
import { ensureUserProfile } from "~/lib/firebase/user-profile";
import { teamSnapshot } from "~/lib/firebase/team-snapshot";
import type { TeamSnapshot } from "~/lib/firebase/types";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  fixtureRulesOf,
  isTournamentOver,
  TOURNAMENT_STATUSES,
  tournamentRulesFrom,
  tournamentShapeFrom,
} from "./rules";

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
  const shape = tournamentShapeFrom(formData);
  if ("error" in shape) return { error: shape.error };

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
      ...shape,
      match_format: rules.match_format,
      overs_per_innings: rules.overs_per_innings,
      ...(rules.wickets_per_innings !== null
        ? { wickets_per_innings: rules.wickets_per_innings }
        : {}),
      venue: (formData.get("venue") as string) || null,
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

/** Refusal for new teams or fixtures once a tournament is over. */
const OVER = "This tournament is over";

/** The tournament's club, and the refusal when it is over. */
async function openTournament(
  db: Awaited<ReturnType<typeof createServerClient>>,
  tournamentId: string,
): Promise<{ clubId: string | null; error: string | null }> {
  const { data } = await db
    .from("tournaments")
    .select("club_id, status")
    .eq("id", tournamentId)
    .maybeSingle();
  return {
    clubId: data?.club_id ?? null,
    error: isTournamentOver(data?.status) ? OVER : null,
  };
}

/** Most teams the "Register team" dialog lists, so it cannot read them all. */
const REGISTRABLE_TEAMS = 200;

/**
 * The teams for an organiser's "Register team" dialog, in name order: read
 * when the dialog opens, not with every view of the tournament page. Anyone
 * else gets none (their own teams come with the page).
 */
export async function getRegistrableTeams(tournamentId: string): Promise<{
  data: Array<{ id: string; name: string; short_name: string | null }>;
  error: string | null;
}> {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { data: [], error: "You must be signed in" };
  if (!(await checkTournamentAdminAuth(db, tournamentId, user.id))) {
    return { data: [], error: null };
  }
  const { data, error } = await db
    .from("teams")
    .select("id, name, short_name")
    .order("name_lower")
    .limit(REGISTRABLE_TEAMS);
  if (error) return { data: [], error: error.message };
  return {
    data: (data ?? []) as Array<{
      id: string;
      name: string;
      short_name: string | null;
    }>,
    error: null,
  };
}

/**
 * Writes a team's registration: a new row, or the old one of a team
 * rejected or withdrawn before. Refuses a team already in or waiting.
 * Answers the error to show, if any.
 */
async function saveRegistration(
  db: Awaited<ReturnType<typeof createServerClient>>,
  tournamentId: string,
  teamId: string,
  fields: { registered_by: string; status: string; payment_status: string },
): Promise<string | null> {
  const { data: previous } = await db
    .from("tournament_registrations")
    .select("id, status")
    .eq("tournament_id", tournamentId)
    .eq("team_id", teamId)
    .maybeSingle();
  if (previous?.status === "pending" || previous?.status === "confirmed") {
    return "This team is already registered";
  }
  const { error } = previous
    ? await db
        .from("tournament_registrations")
        .update({
          ...fields,
          registered_at: new Date().toISOString(),
          approved_by: null,
          approved_at: null,
        })
        .eq("id", previous.id)
    : await db
        .from("tournament_registrations")
        .insert({ tournament_id: tournamentId, team_id: teamId, ...fields });
  if (error) {
    console.error("registerTeamForTournament error:", error);
    return error.message;
  }
  return null;
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

  const tourn = await openTournament(db, tournamentId);
  if (tourn.error) return { error: tourn.error };

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
  const regError = await saveRegistration(db, tournamentId, teamId, {
    registered_by: user.id,
    status,
    payment_status: isTournAdmin ? "paid" : "pending",
  });
  if (regError) return { error: regError };

  if (status === "confirmed") {
    // Initialise the team's row in the points table.
    await db.rpc("recalculate_tournament_standings", {
      p_tournament_id: tournamentId,
    });
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  if (tourn.clubId) revalidatePath(`/clubs/${tourn.clubId}`);
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

const REGISTRATION_DECISIONS: ReadonlySet<string> = new Set([
  "confirmed",
  "rejected",
]);

/**
 * Confirm or reject a registration. The organiser check runs against the
 * tournament the registration belongs to; `_tournamentId` (what the page
 * sent) is not trusted for it.
 */
export async function updateRegistrationStatus(
  registrationId: string,
  _tournamentId: string,
  status: "confirmed" | "rejected",
) {
  const db = await createServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  if (!REGISTRATION_DECISIONS.has(status)) {
    return { error: "Unknown registration status" };
  }

  const { data: registration } = await db
    .from("tournament_registrations")
    .select("tournament_id, status")
    .eq("id", registrationId)
    .maybeSingle();
  const tournamentId = registration?.tournament_id as string | undefined;

  const isTournAdmin =
    !!tournamentId &&
    (await checkTournamentAdminAuth(db, tournamentId, user.id));
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

  // The team joins the points table, or leaves it once rejected.
  if (status === "confirmed" || registration?.status === "confirmed") {
    await db.rpc("recalculate_tournament_standings", {
      p_tournament_id: tournamentId,
    });
  }

  revalidatePath(`/tournaments/${tournamentId}`);
  return { success: true };
}

/**
 * The pairings whose two teams have no match in the tournament yet (either
 * way round), so generating again, from a stale page or by a second
 * organiser, creates no fixture twice.
 */
async function withoutFixtures<P extends { homeTeamId: string; awayTeamId: string }>(
  db: Awaited<ReturnType<typeof createServerClient>>,
  tournamentId: string,
  pairings: P[],
): Promise<{ pairings: P[]; error: string | null }> {
  const { data, error } = await db
    .from("matches")
    .select("team1_id, team2_id")
    .eq("tournament_id", tournamentId);
  if (error) return { pairings: [], error: error.message };
  const key = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const taken = new Set(
    (data ?? []).map((m) => key(String(m.team1_id), String(m.team2_id))),
  );
  return {
    pairings: pairings.filter((p) => !taken.has(key(p.homeTeamId, p.awayTeamId))),
    error: null,
  };
}

/**
 * Round-robin fixtures for the confirmed teams, one round a day starting at
 * `firstMatchAt` (an ISO timestamp the organiser's browser builds from
 * their local day and time). Without it: the start date (or today) at
 * 10:00 UTC. Matches take the rules the match wizard would
 * (`fixtureRulesOf`); a pair that already has a fixture gets none.
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
      "id, name, status, match_format, overs_per_innings, custom_overs, venue, start_date, club_id, wickets_per_innings, last_man_stands, golden_ball, season_id",
    )
    .eq("id", tournamentId)
    .single();

  if (tourError || !tournament)
    return { error: tourError?.message ?? "Tournament not found" };
  if (isTournamentOver(tournament.status)) return { error: OVER };
  const rules = fixtureRulesOf(tournament);

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
  const { pairings, error: pairError } = await withoutFixtures(
    db,
    tournamentId,
    generateRoundRobinFixtures(teamIds),
  );
  if (pairError) return { error: pairError };
  if (pairings.length === 0) {
    return { error: "Every pair of teams already has a fixture." };
  }

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
      ...rules,
      team1_id: p.homeTeamId,
      team2_id: p.awayTeamId,
      team1_snapshot: team1,
      team2_snapshot: team2,
      tournament_id: tournament.id,
      club_id: tournament.club_id,
      season_id: tournament.season_id,
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
  const venue = (formData.get("venue") as string)?.trim() || null;
  const season_id = (formData.get("season_id") as string) || null;
  const is_public = formData.get("is_public") !== "false";

  const rules = tournamentRulesFrom(formData);
  if ("error" in rules) return { error: rules.error };
  const { match_format, overs_per_innings, wickets_per_innings } = rules;

  const rawStatus = (formData.get("status") as string | null) || null;
  if (rawStatus && !TOURNAMENT_STATUSES.has(rawStatus)) {
    return { error: "Unknown tournament status" };
  }
  const shape = tournamentShapeFrom(formData);
  if ("error" in shape) return { error: shape.error };

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
      ...shape,
      match_format,
      overs_per_innings,
      ...(wickets_per_innings !== null ? { wickets_per_innings } : {}),
      ...(rawStatus ? { status: rawStatus } : {}),
      last_man_stands,
      golden_ball,
      venue,
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

/**
 * Deletes a tournament with its registrations and points table, and its
 * fixtures that never started (`delete_unplayed_fixtures`, the cleanup of
 * `delete_match`). Matches that started or finished stay, outside any
 * tournament.
 */
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

  const { error: fixturesError } = await db.rpc("delete_unplayed_fixtures", {
    p_tournament_id: tournamentId,
  });
  if (fixturesError) {
    console.error("deleteTournament fixtures error:", fixturesError);
    return { error: fixturesError.message };
  }

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

