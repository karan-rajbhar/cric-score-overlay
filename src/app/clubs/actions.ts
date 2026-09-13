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

  const clubType = (formData.get("club_type") as string) || "community";
  const validTypes = ["community", "corporate", "school", "professional"];
  const safeType = validTypes.includes(clubType) ? clubType : "community";

  const { data, error } = await supabase
    .from("clubs")
    .insert({
      name,
      short_name: (formData.get("short_name") as string) || null,
      location: (formData.get("location") as string) || null,
      description: (formData.get("description") as string) || null,
      contact_email: (formData.get("contact_email") as string) || null,
      contact_phone: (formData.get("contact_phone") as string) || null,
      website_url: (formData.get("website_url") as string) || null,
      club_type: safeType,
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
  const { error: memError } = await supabase.from("club_memberships").insert({
    club_id: data.id,
    user_id: user.id,
    role: "owner",
    status: "active",
  });

  if (memError) {
    console.warn("createClub member insertion warning:", memError.message);
  }

  revalidatePath("/clubs");
  redirect(`/clubs/${data.id}`);
}

export async function joinClub(clubId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in to join a club" };

  const { error } = await supabase.from("club_memberships").insert({
    club_id: clubId,
    user_id: user.id,
    role: "member",
    status: "active",
  });

  if (error) {
    console.error("joinClub error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function leaveClub(clubId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const { error } = await supabase
    .from("club_memberships")
    .delete()
    .eq("club_id", clubId)
    .eq("user_id", user.id);

  if (error) {
    console.error("leaveClub error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function updateMemberRole(
  clubId: string,
  membershipId: string,
  newRole: "admin" | "member",
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const { error } = await supabase
    .from("club_memberships")
    .update({ role: newRole })
    .eq("id", membershipId)
    .eq("club_id", clubId);

  if (error) {
    console.error("updateMemberRole error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function createSeason(
  clubId: string,
  name: string,
  startDate?: string | null,
  endDate?: string | null,
  isCurrent?: boolean,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  if (isCurrent) {
    // Reset previous is_current flags for this club
    await supabase
      .from("club_seasons")
      .update({ is_current: false })
      .eq("club_id", clubId);
  }

  const { error } = await supabase.from("club_seasons").insert({
    club_id: clubId,
    name: name.trim(),
    start_date: startDate || null,
    end_date: endDate || null,
    is_current: isCurrent ?? false,
  });

  if (error) {
    console.error("createSeason error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function inductHallOfFame(
  clubId: string,
  data: {
    playerId: string;
    category: string;
    title: string;
    description?: string | null;
    seasonOrYear?: string | null;
    recordMetric?: string | null;
  },
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const { error } = await supabase.from("club_hall_of_fame").insert({
    club_id: clubId,
    player_id: data.playerId,
    category: data.category,
    title: data.title.trim(),
    description: data.description?.trim() || null,
    season_or_year: data.seasonOrYear?.trim() || null,
    record_metric: data.recordMetric?.trim() || null,
    created_by: user.id,
  });

  if (error) {
    console.error("inductHallOfFame error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function updateClubSocialLinks(
  clubId: string,
  socialLinks: Record<string, string>,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const { error } = await supabase
    .from("clubs")
    .update({ social_links: socialLinks })
    .eq("id", clubId);

  if (error) {
    console.error("updateClubSocialLinks error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}
