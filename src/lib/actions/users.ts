"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type UserRole =
  | "member"
  | "lead"
  | "committee"
  | "admin"
  | "super_admin";

export interface UserProfile {
  id: string;
  first_name: string | null;
  last_name: string | null;
  playa_name: string | null;
  email: string;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  emergency_contact: string | null;
  dietary_restrictions: string | null;
  instagram: string | null;
  skills: string[];
  node_events_attended: string[];
  role: UserRole;
  created_at: string;
  updated_at: string;
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" as const, supabase, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "super_admin") {
    return { error: "Unauthorized" as const, supabase, user: null };
  }

  return { error: null, supabase, user };
}

export async function getUsers(): Promise<
  UserProfile[] | { error: string }
> {
  const { error, supabase } = await requireSuperAdmin();
  if (error || !supabase) return { error: error ?? "Not authenticated" };

  const { data, error: dbError } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error("[getUsers]", dbError);
    return { error: "Failed to load users." };
  }

  return data as UserProfile[];
}

export async function updateUserRole(
  userId: string,
  role: UserRole
): Promise<{ success: true } | { error: string }> {
  const { error, supabase, user } = await requireSuperAdmin();
  if (error || !supabase || !user) return { error: error ?? "Not authenticated" };

  if (userId === user.id) {
    return { error: "Cannot change your own role." };
  }

  const validRoles: UserRole[] = [
    "member",
    "lead",
    "committee",
    "admin",
    "super_admin",
  ];
  if (!validRoles.includes(role)) {
    return { error: "Invalid role." };
  }

  const { error: dbError } = await supabase
    .from("profiles")
    .update({ role })
    .eq("id", userId);

  if (dbError) {
    console.error("[updateUserRole]", dbError);
    return { error: "Failed to update role." };
  }

  return { success: true };
}

export async function updateUserProfile(
  userId: string,
  data: {
    first_name?: string | null;
    last_name?: string | null;
    playa_name?: string | null;
    phone?: string | null;
    bio?: string | null;
    emergency_contact?: string | null;
    dietary_restrictions?: string | null;
    instagram?: string | null;
    skills?: string[];
    node_events_attended?: string[];
  }
): Promise<{ success: true } | { error: string }> {
  const { error, supabase } = await requireSuperAdmin();
  if (error || !supabase) return { error: error ?? "Not authenticated" };

  const { error: dbError } = await supabase
    .from("profiles")
    .update(data)
    .eq("id", userId);

  if (dbError) {
    console.error("[updateUserProfile]", dbError);
    return { error: "Failed to update profile." };
  }

  return { success: true };
}

export interface InviteResult {
  userId: string;
  email: string;
  name: string;
  link?: string;
  error?: string;
}

export async function generateInviteLinks(
  userIds: string[]
): Promise<{ results: InviteResult[] } | { error: string }> {
  const { error, supabase } = await requireSuperAdmin();
  if (error || !supabase) return { error: error ?? "Not authenticated" };

  if (userIds.length === 0) return { error: "No users selected." };
  if (userIds.length > 100) return { error: "Max 100 users at a time." };

  // Fetch profiles for the selected users
  const { data: profiles, error: dbError } = await supabase
    .from("profiles")
    .select("id, email, first_name, last_name")
    .in("id", userIds);

  if (dbError || !profiles) {
    return { error: "Failed to fetch user profiles." };
  }

  const adminClient = createAdminClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nodev0.vercel.app";

  const results: InviteResult[] = [];

  for (const profile of profiles) {
    const name = [profile.first_name, profile.last_name]
      .filter(Boolean)
      .join(" ") || profile.email.split("@")[0];

    const { data, error: linkError } = await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: profile.email,
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      },
    });

    if (linkError || !data?.properties?.action_link) {
      results.push({
        userId: profile.id,
        email: profile.email,
        name,
        error: linkError?.message || "Failed to generate link",
      });
    } else {
      results.push({
        userId: profile.id,
        email: profile.email,
        name,
        link: data.properties.action_link,
      });
    }
  }

  return { results };
}
