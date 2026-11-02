import "server-only";
import { cache } from "react";
import { createServerClient } from "~/lib/firebase/server";
import { MATCH_TEAM_COLUMNS } from "~/lib/firebase/team-snapshot";

/** What the tournament page's layout and its tab page share. */

const TOURNAMENT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isTournamentId = (id: string) => TOURNAMENT_ID.test(id);

export const TOURNAMENT_MATCH_COLUMNS = `
                id, title, match_format, overs_per_innings, status, venue, scheduled_at,
                umpire1_name, umpire2_name, result_type, win_margin, win_margin_type, result_description, winning_team_id,
                ${MATCH_TEAM_COLUMNS},
                innings(id, team_id, innings_number, total_runs, total_wickets, total_balls, total_overs, is_completed)
            `;

/** The tournament: read once per request, by the page and its title. */
export const loadTournament = cache(async (id: string) => {
  const db = await createServerClient();
  return db
    .from("tournaments")
    // owner_id: the club admin check below needs no second club read.
    .select("*, club:clubs(id, name, short_name, owner_id)")
    .eq("id", id)
    .single();
});
