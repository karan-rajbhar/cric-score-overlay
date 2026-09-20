"use server";

import { createServerClient } from "~/lib/supabase/server";
import { ensureUserProfile } from "~/lib/supabase/user-profile";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function createClub(formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be logged in" };

  await ensureUserProfile(supabase, user);

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

  await ensureUserProfile(supabase, user);

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

async function checkClubAdminAuth(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  clubId: string,
  userId: string,
  requireOwnerOnly = false,
): Promise<boolean> {
  const { data: club } = await supabase
    .from("clubs")
    .select("owner_id")
    .eq("id", clubId)
    .single();

  if (club?.owner_id === userId) return true;
  if (requireOwnerOnly) return false;

  const { data: membership } = await supabase
    .from("club_memberships")
    .select("role")
    .eq("club_id", clubId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();

  return membership?.role === "admin";
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

  const isOwner = await checkClubAdminAuth(supabase, clubId, user.id, true);
  if (!isOwner) {
    return { error: "Only the club owner can change member roles" };
  }

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

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return { error: "You are not authorized to manage seasons for this club" };
  }

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

  await ensureUserProfile(supabase, user);

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return {
      error:
        "You are not authorized to induct members into this club's Hall of Fame",
    };
  }

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

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return { error: "You are not authorized to update this club's links" };
  }

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

export async function updateClub(clubId: string, formData: FormData) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return { error: "You are not authorized to update this club" };
  }

  const name = (formData.get("name") as string)?.trim();
  if (!name) return { error: "Club name is required" };

  const short_name = (formData.get("short_name") as string)?.trim() || null;
  const location = (formData.get("location") as string)?.trim() || null;
  const description = (formData.get("description") as string)?.trim() || null;
  const contact_email =
    (formData.get("contact_email") as string)?.trim() || null;
  const contact_phone =
    (formData.get("contact_phone") as string)?.trim() || null;
  const website_url = (formData.get("website_url") as string)?.trim() || null;
  const founded_year_raw = formData.get("founded_year");
  const founded_year = founded_year_raw
    ? parseInt(founded_year_raw as string, 10)
    : null;
  const clubType = (formData.get("club_type") as string) || "community";
  const validTypes = ["community", "corporate", "school", "professional"];
  const safeType = validTypes.includes(clubType) ? clubType : "community";
  const is_public = formData.get("is_public") !== "false";

  const { error } = await supabase
    .from("clubs")
    .update({
      name,
      short_name,
      location,
      description,
      contact_email,
      contact_phone,
      website_url,
      founded_year,
      club_type: safeType,
      is_public,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId);

  if (error) {
    console.error("updateClub error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
  return { success: true };
}

export async function removeMember(clubId: string, membershipId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const isOwner = await checkClubAdminAuth(supabase, clubId, user.id, true);
  const isAdmin = await checkClubAdminAuth(supabase, clubId, user.id, false);

  if (!isAdmin) {
    return { error: "You are not authorized to remove members from this club" };
  }

  const { data: targetMembership, error: fetchErr } = await supabase
    .from("club_memberships")
    .select("id, role, user_id")
    .eq("id", membershipId)
    .eq("club_id", clubId)
    .single();

  if (fetchErr || !targetMembership) {
    return { error: "Member record not found" };
  }

  if (targetMembership.role === "owner") {
    return { error: "Cannot remove the club owner" };
  }

  if (!isOwner && targetMembership.role === "admin") {
    return { error: "Only the club owner can remove club administrators" };
  }

  const { error } = await supabase
    .from("club_memberships")
    .delete()
    .eq("id", membershipId)
    .eq("club_id", clubId);

  if (error) {
    console.error("removeMember error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function inviteClubMember(clubId: string, email: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return { error: "You are not authorized to invite members to this club" };
  }

  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes("@")) {
    return { error: "A valid email address is required" };
  }

  const { data: existingUser } = await supabase
    .from("users")
    .select("id")
    .eq("email", cleanEmail)
    .maybeSingle();

  if (existingUser) {
    const { data: existingMember } = await supabase
      .from("club_memberships")
      .select("id, status")
      .eq("club_id", clubId)
      .eq("user_id", existingUser.id)
      .maybeSingle();

    if (existingMember && existingMember.status === "active") {
      return { error: "This user is already an active member of the club" };
    }
  }

  const { error } = await supabase.from("club_invitations").insert({
    club_id: clubId,
    invited_by: user.id,
    email: cleanEmail,
    user_id: existingUser?.id ?? null,
    status: "pending",
  });

  if (error) {
    console.error("inviteClubMember error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function updateSeason(
  seasonId: string,
  clubId: string,
  name: string,
  startDate?: string,
  endDate?: string,
  isCurrent?: boolean,
) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return { error: "You are not authorized to manage seasons for this club" };
  }

  const trimmedName = name.trim();
  if (!trimmedName) return { error: "Season name is required" };

  if (isCurrent) {
    await supabase
      .from("club_seasons")
      .update({ is_current: false })
      .eq("club_id", clubId);
  }

  const { error } = await supabase
    .from("club_seasons")
    .update({
      name: trimmedName,
      start_date: startDate || null,
      end_date: endDate || null,
      is_current: isCurrent ?? false,
      updated_at: new Date().toISOString(),
    })
    .eq("id", seasonId)
    .eq("club_id", clubId);

  if (error) {
    console.error("updateSeason error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function deleteSeason(seasonId: string, clubId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return { error: "You are not authorized to manage seasons for this club" };
  }

  const { error } = await supabase
    .from("club_seasons")
    .delete()
    .eq("id", seasonId)
    .eq("club_id", clubId);

  if (error) {
    console.error("deleteSeason error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

export async function removeHallOfFame(hallOfFameId: string, clubId: string) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return { error: "You are not authorized to manage the Hall of Fame" };
  }

  const { error } = await supabase
    .from("club_hall_of_fame")
    .delete()
    .eq("id", hallOfFameId)
    .eq("club_id", clubId);

  if (error) {
    console.error("removeHallOfFame error:", error);
    return { error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  return { success: true };
}

const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_LOGO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
];

const MAX_BANNER_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_BANNER_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
];

export async function updateClubLogo(
  clubId: string,
  file: File,
): Promise<{ data: string | null; error: string | null }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return {
      data: null,
      error: "You are not authorized to update this club's logo",
    };
  }

  if (file.size > MAX_LOGO_BYTES) {
    return { data: null, error: "Logo must be under 2 MB" };
  }
  if (!ALLOWED_LOGO_TYPES.includes(file.type)) {
    return { data: null, error: "Use PNG, JPG, WebP, or SVG for club logos" };
  }

  const ext =
    file.type === "image/svg+xml"
      ? "svg"
      : (file.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
  const path = `${clubId}/logo-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("club-assets")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Club logo upload failed:", uploadError);
    return {
      data: null,
      error: uploadError.message || "Failed to upload club logo",
    };
  }

  const { data: urlData } = supabase.storage
    .from("club-assets")
    .getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("clubs")
    .update({
      logo_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId);

  if (updateError) {
    console.error("Error saving club logo URL:", updateError);
    return { data: null, error: updateError.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
  return { data: urlData.publicUrl, error: null };
}

export async function removeClubLogo(
  clubId: string,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return {
      success: false,
      error: "You are not authorized to update this club's logo",
    };
  }

  const { error } = await supabase
    .from("clubs")
    .update({
      logo_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId);

  if (error) {
    console.error("removeClubLogo error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
  return { success: true, error: null };
}

export async function updateClubBanner(
  clubId: string,
  file: File,
): Promise<{ data: string | null; error: string | null }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return {
      data: null,
      error: "You are not authorized to update this club's banner",
    };
  }

  if (file.size > MAX_BANNER_BYTES) {
    return { data: null, error: "Banner image must be under 5 MB" };
  }
  if (!ALLOWED_BANNER_TYPES.includes(file.type)) {
    return { data: null, error: "Use PNG, JPG, or WebP for banner images" };
  }

  const ext = (file.type.split("/")[1] ?? "png").replace("jpeg", "jpg");
  const path = `${clubId}/banner-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("club-assets")
    .upload(path, file, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("Club banner upload failed:", uploadError);
    return {
      data: null,
      error: uploadError.message || "Failed to upload club banner",
    };
  }

  const { data: urlData } = supabase.storage
    .from("club-assets")
    .getPublicUrl(path);

  const { error: updateError } = await supabase
    .from("clubs")
    .update({
      banner_url: urlData.publicUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId);

  if (updateError) {
    console.error("Error saving club banner URL:", updateError);
    return { data: null, error: updateError.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
  return { data: urlData.publicUrl, error: null };
}

export async function removeClubBanner(
  clubId: string,
): Promise<{ success: boolean; error: string | null }> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "You must be logged in" };

  const canManage = await checkClubAdminAuth(supabase, clubId, user.id);
  if (!canManage) {
    return {
      success: false,
      error: "You are not authorized to update this club's banner",
    };
  }

  const { error } = await supabase
    .from("clubs")
    .update({
      banner_url: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", clubId);

  if (error) {
    console.error("removeClubBanner error:", error);
    return { success: false, error: error.message };
  }

  revalidatePath(`/clubs/${clubId}`);
  revalidatePath("/clubs");
  return { success: true, error: null };
}


