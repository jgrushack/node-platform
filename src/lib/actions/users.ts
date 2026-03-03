"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendExistingMemberInvite } from "@/lib/email/send";

const userProfileSchema = z.object({
  first_name: z.string().max(100).nullable().optional(),
  last_name: z.string().max(100).nullable().optional(),
  playa_name: z.string().max(100).nullable().optional(),
  phone: z.string().max(30).nullable().optional(),
  bio: z.string().max(2000).nullable().optional(),
  emergency_contact: z.string().max(500).nullable().optional(),
  dietary_restrictions: z.string().max(500).nullable().optional(),
  instagram: z.string().max(100).nullable().optional(),
  skills: z.array(z.string().max(100)).max(50).optional(),
  node_events_attended: z.array(z.string().max(100)).max(50).optional(),
}).strict();

const roleSchema = z.enum(["member", "lead", "committee", "admin", "super_admin"]);

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
  sent?: boolean;
  error?: string;
}

export interface CommitteeRequestWithProfile {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  profile: {
    first_name: string | null;
    last_name: string | null;
    playa_name: string | null;
    email: string;
  };
}

export async function getCommitteeRequests(): Promise<
  CommitteeRequestWithProfile[] | { error: string }
> {
  const { error, supabase } = await requireSuperAdmin();
  if (error || !supabase) return { error: error ?? "Not authenticated" };

  const { data, error: dbError } = await supabase
    .from("committee_requests")
    .select("*, profile:profiles!profile_id(first_name, last_name, playa_name, email)")
    .order("created_at", { ascending: false });

  if (dbError) {
    console.error("[getCommitteeRequests]", dbError);
    return { error: "Failed to load committee requests." };
  }

  return data as unknown as CommitteeRequestWithProfile[];
}

export async function handleCommitteeRequest(
  requestId: string,
  action: "approved" | "rejected"
): Promise<{ success: true } | { error: string }> {
  const { error, supabase } = await requireSuperAdmin();
  if (error || !supabase) return { error: error ?? "Not authenticated" };

  // Get the request to find the profile_id
  const { data: request, error: fetchError } = await supabase
    .from("committee_requests")
    .select("profile_id")
    .eq("id", requestId)
    .single();

  if (fetchError || !request) {
    return { error: "Request not found." };
  }

  // Update request status
  const { error: updateError } = await supabase
    .from("committee_requests")
    .update({ status: action })
    .eq("id", requestId);

  if (updateError) {
    console.error("[handleCommitteeRequest]", updateError);
    return { error: "Failed to update request." };
  }

  // On approve, set user's role to committee
  if (action === "approved") {
    const { error: roleError } = await supabase
      .from("profiles")
      .update({ role: "committee" })
      .eq("id", request.profile_id);

    if (roleError) {
      console.error("[handleCommitteeRequest] role update", roleError);
      return { error: "Request approved but failed to update role." };
    }
  }

  return { success: true };
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
      const magicLink = data.properties.action_link;

      // Send branded invite email via Resend
      const emailResult = await sendExistingMemberInvite({
        email: profile.email,
        firstName: profile.first_name || name,
        magicLink,
      });

      results.push({
        userId: profile.id,
        email: profile.email,
        name,
        link: magicLink,
        sent: "success" in emailResult,
        error: "error" in emailResult ? emailResult.error : undefined,
      });
    }
  }

  return { results };
}
