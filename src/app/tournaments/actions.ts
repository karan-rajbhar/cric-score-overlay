"use server";

import { createServerClient } from "~/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createTournament(formData: FormData) {
    const supabase = await createServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) return { error: "You must be logged in" };

    const name = (formData.get("name") as string)?.trim();
    if (!name) return { error: "Tournament name is required" };

    const { data, error } = await supabase
        .from("tournaments")
        .insert({
            name,
            description: (formData.get("description") as string) || null,
            tournament_format: (formData.get("tournament_format") as string) || "league",
            match_format: (formData.get("match_format") as string) || "T20",
            venue: (formData.get("venue") as string) || null,
            start_date: (formData.get("start_date") as string) || null,
            end_date: (formData.get("end_date") as string) || null,
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
    redirect(`/tournaments/${data.id}`);
}
