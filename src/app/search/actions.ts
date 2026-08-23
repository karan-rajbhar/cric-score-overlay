"use server";

import { createServerClient } from "~/lib/supabase/server";

export interface GlobalSearchResult {
    matches: Array<{ id: string; title: string; status: string; venue: string | null }>;
    teams: Array<{ id: string; name: string; short_name: string | null }>;
    players: Array<{ id: string; full_name: string; email: string | null }>;
    clubs: Array<{ id: string; name: string; location: string | null }>;
    tournaments: Array<{ id: string; name: string; status: string | null }>;
}

/**
 * Global search across 5 entities — single entry point for the
 * header search and /search page. Uses ilike for case-insensitive
 * prefix matching; each query is limited to 5 to keep it fast.
 */
export async function globalSearch(query: string): Promise<GlobalSearchResult & { error?: string }> {
    const q = query.trim();
    if (q.length < 2) {
        return { matches: [], teams: [], players: [], clubs: [], tournaments: [] };
    }

    const supabase = await createServerClient();
    const like = `%${q}%`;

    const [matchesRes, teamsRes, playersRes, clubsRes, tournamentsRes] = await Promise.all([
        supabase.from("matches").select("id, title, status, venue").ilike("title", like).limit(5),
        supabase.from("teams").select("id, name, short_name").ilike("name", like).limit(5),
        supabase.from("users").select("id, full_name, email").ilike("full_name", like).limit(5),
        supabase.from("clubs").select("id, name, location").ilike("name", like).limit(5),
        supabase.from("tournaments").select("id, name, status").ilike("name", like).limit(5),
    ]);

    return {
        matches: matchesRes.data ?? [],
        teams: teamsRes.data ?? [],
        players: playersRes.data ?? [],
        clubs: clubsRes.data ?? [],
        tournaments: tournamentsRes.data ?? [],
    };
}
