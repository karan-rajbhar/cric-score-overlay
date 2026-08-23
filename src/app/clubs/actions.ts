"use server";

import { createServerClient } from "~/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createClub(formData: FormData) {
    const supabase = await createServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { error: "You must be logged in" };

    const name = (formData.get("name") as string)?.trim();
    if (!name) return { error: "Club name is required" };

    const { data, error } = await supabase
        .from("clubs")
        .insert({
            name,
            short_name: (formData.get("short_name") as string) || null,
            location: (formData.get("location") as string) || null,
            description: (formData.get("description") as string) || null,
            club_type: (formData.get("club_type") as string) || "other",
            is_public: true,
            owner_id: user.id,
        })
        .select("id")
        .single();

    if (error) {
        console.error("createClub:", error);
        return { error: error.message };
    }

    // Auto-add creator as owner member
    await supabase.from("club_memberships").insert({
        club_id: data.id,
        user_id: user.id,
        role: "owner",
    });

    revalidatePath("/clubs");
    redirect(`/clubs/${data.id}`);
}
