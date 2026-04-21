"use server";

import { randomUUID } from "crypto";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  applicationSchema,
  type ApplicationFormData,
  type ApplicationRow,
  type ApplicationComment,
  type ApplicationWithVotes,
  type ApplicationVote,
  type VoteValue,
  type ApplicationSummaryData,
  type CommitteeRequest,
} from "@/lib/types/application";
import { appendApplicationToSheet } from "@/lib/google-sheets";
import { sendApprovedApplicantEmail } from "@/lib/email/send";

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
];
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB
const AUTO_APPROVE_THRESHOLD = 4;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000; // 10 min

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" as const, supabase, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_committee_member")
    .eq("id", user.id)
    .single();

  if (!profile || (!profile.is_committee_member && !["admin", "super_admin"].includes(profile.role))) {
    return { error: "Unauthorized" as const, supabase, user: null };
  }

  return { error: null, supabase, user };
}

async function requireSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" as const, supabase, user: null };
  }

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

async function requireAdminOrSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" as const, supabase, user: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: "Unauthorized" as const, supabase, user: null };
  }

  return { error: null, supabase, user };
}

async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" as const, supabase, user: null };
  }

  return { error: null, supabase, user };
}

export async function submitApplication(
  data: ApplicationFormData
): Promise<{ id: string } | { error: string }> {
  const parsed = applicationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const fields = {
    first_name: parsed.data.firstName,
    last_name: parsed.data.lastName,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    playa_name: parsed.data.playaName || null,
    years_attended: parsed.data.yearsAttended,
    previous_camps: parsed.data.previousCamps || null,
    favorite_principle: parsed.data.favoritePrinciple || null,
    principle_reason: parsed.data.principleReason || null,
    skills: parsed.data.skills || null,
    referred_by: parsed.data.referredBy || null,
  };

  const supabase = await createClient();
  const adminClient = createAdminClient();

  // Reuse a pending application submitted in the last 10 min for the same
  // email — guards against duplicates when a user retries after the previous
  // attempt hung on video upload.
  const cutoff = new Date(Date.now() - DUPLICATE_WINDOW_MS).toISOString();
  const { data: existing } = await adminClient
    .from("applications")
    .select("id")
    .eq("email", parsed.data.email)
    .eq("status", "pending")
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let id: string;
  if (existing?.id) {
    id = existing.id;
    const { error: updateError } = await adminClient
      .from("applications")
      .update(fields)
      .eq("id", id);
    if (updateError) {
      console.error("[submitApplication] update", updateError);
      return { error: "Failed to submit application. Please try again." };
    }
  } else {
    id = randomUUID();
    const { error } = await supabase
      .from("applications")
      .insert({ id, ...fields });
    if (error) {
      console.error("[submitApplication]", error);
      return { error: "Failed to submit application. Please try again." };
    }
  }

  // Non-blocking: sync to Google Sheet for redundancy. `after()` keeps the
  // serverless invocation alive until the Sheets write finishes, after the
  // response has already been sent to the client — so slow/failed Sheets
  // calls never block or time out the submit.
  after(async () => {
    try {
      await appendApplicationToSheet(parsed.data);
    } catch (err) {
      console.error("[Google Sheets sync]", err);
    }
  });

  return { id };
}

export async function createVideoUploadUrl(
  applicationId: string,
  fileName: string,
  fileSize: number,
  fileType: string
): Promise<{ path: string; token: string } | { error: string }> {
  if (fileSize > MAX_VIDEO_SIZE) {
    return { error: "Video must be under 50MB." };
  }
  if (!ALLOWED_VIDEO_TYPES.includes(fileType)) {
    return { error: "Only MP4, WebM, MOV, and AVI video files are allowed." };
  }

  const adminClient = createAdminClient();
  const { data: app, error: appError } = await adminClient
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .maybeSingle();

  if (appError || !app) {
    return { error: "Application not found." };
  }

  const safeFilename = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${applicationId}/${safeFilename}`;

  const { data, error } = await adminClient.storage
    .from("application-videos")
    .createSignedUploadUrl(path, { upsert: true });

  if (error || !data) {
    console.error("[createVideoUploadUrl]", error);
    return { error: "Failed to create upload URL." };
  }

  return { path: data.path, token: data.token };
}

export async function linkApplicationVideo(
  applicationId: string,
  path: string
): Promise<{ success: true } | { error: string }> {
  if (!path.startsWith(`${applicationId}/`)) {
    return { error: "Invalid video path." };
  }

  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("applications")
    .update({ video_url: path })
    .eq("id", applicationId);

  if (error) {
    console.error("[linkApplicationVideo]", error);
    return { error: "Failed to link video to application." };
  }

  return { success: true };
}


export async function getApplicationsWithVotes(): Promise<
  ApplicationWithVotes[] | { error: string }
> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  // Fetch applications
  const { data: applications, error: appError } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (appError) {
    console.error("[getApplicationsWithVotes]", appError);
    return { error: "Failed to load applications." };
  }

  // Fetch all votes with voter profiles
  const { data: votes, error: votesError } = await supabase
    .from("application_votes")
    .select(
      "*, voter:profiles!voter_id(first_name, last_name, playa_name, email, avatar_url)"
    );

  if (votesError) {
    console.error("[getApplicationsWithVotes] votes", votesError);
    return { error: "Failed to load votes." };
  }

  // Group votes by application_id
  const votesByApp = new Map<string, ApplicationVote[]>();
  for (const vote of (votes ?? [])) {
    const appId = vote.application_id;
    if (!votesByApp.has(appId)) votesByApp.set(appId, []);
    votesByApp.get(appId)!.push(vote as unknown as ApplicationVote);
  }

  // Compose ApplicationWithVotes
  const result: ApplicationWithVotes[] = (applications ?? []).map((app) => {
    const appVotes = votesByApp.get(app.id) ?? [];
    const summary = { yes: 0, no: 0, waitlist: 0 };
    let currentUserVote: VoteValue | null = null;

    for (const v of appVotes) {
      summary[v.vote]++;
      if (v.voter_id === user.id) currentUserVote = v.vote;
    }

    return {
      ...(app as ApplicationRow),
      votes: appVotes,
      vote_summary: summary,
      current_user_vote: currentUserVote,
    };
  });

  return result;
}

export async function castVote(
  applicationId: string,
  vote: VoteValue
): Promise<{ success: true; autoApproved?: boolean } | { error: string }> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  if (!["yes", "no", "waitlist"].includes(vote)) {
    return { error: "Invalid vote value." };
  }

  // Upsert vote (one vote per person per application)
  const { error: voteError } = await supabase
    .from("application_votes")
    .upsert(
      {
        application_id: applicationId,
        voter_id: user.id,
        vote,
      },
      { onConflict: "application_id,voter_id" }
    );

  if (voteError) {
    console.error("[castVote]", voteError);
    return { error: "Failed to cast vote." };
  }

  // Check if auto-approval threshold is met
  if (vote === "yes") {
    const { count } = await supabase
      .from("application_votes")
      .select("*", { count: "exact", head: true })
      .eq("application_id", applicationId)
      .eq("vote", "yes");

    if (count && count >= AUTO_APPROVE_THRESHOLD) {
      // Check if still pending before auto-approving
      const { data: app } = await supabase
        .from("applications")
        .select("status")
        .eq("id", applicationId)
        .single();

      if (app?.status === "pending") {
        const approveResult = await approveApplication(applicationId);
        if ("error" in approveResult) {
          console.error("[castVote] auto-approve failed", approveResult.error);
          return { success: true, autoApproved: false };
        }
        return { success: true, autoApproved: true };
      }
    }
  }

  return { success: true };
}

export async function approveApplication(
  applicationId: string
): Promise<{ success: true } | { error: string }> {
  const { error: authError } = await requireAdminOrSuperAdmin();
  if (authError) {
    return { error: authError };
  }

  const adminClient = createAdminClient();

  // Fetch application data
  const { data: application, error: fetchError } = await adminClient
    .from("applications")
    .select("*")
    .eq("id", applicationId)
    .single();

  if (fetchError || !application) {
    console.error("[approveApplication] fetch", fetchError);
    return { error: "Failed to fetch application." };
  }

  // Check if user already exists for this email
  const { data: existingProfile } = await adminClient
    .from("profiles")
    .select("id")
    .eq("email", application.email)
    .maybeSingle();
  const existingUser = existingProfile;

  let profileId: string;

  if (existingUser) {
    profileId = existingUser.id;
  } else {
    // Create user account via admin API
    const { data: createData, error: createError } =
      await adminClient.auth.admin.createUser({
        email: application.email,
        email_confirm: true,
      });

    if (createError || !createData?.user) {
      console.error("[approveApplication] create user", createError);
      return { error: "Failed to create user account." };
    }

    profileId = createData.user.id;
  }

  // Generate magic link and send branded "You're In!" email
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://nodev0.vercel.app";
  const { data: linkData, error: linkError } =
    await adminClient.auth.admin.generateLink({
      type: "magiclink",
      email: application.email,
      options: {
        redirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
      },
    });

  if (linkError || !linkData?.properties?.action_link) {
    console.error("[approveApplication] generate link", linkError);
    // Non-fatal: account was created, they can use login page
  } else {
    const emailResult = await sendApprovedApplicantEmail({
      email: application.email,
      firstName: application.first_name || "there",
      magicLink: linkData.properties.action_link,
    });

    if ("error" in emailResult) {
      console.error("[approveApplication] send email", emailResult.error);
      // Non-fatal: account was created, they can use login page
    }
  }

  // Update profile with applicant's info
  const { error: profileError } = await adminClient
    .from("profiles")
    .update({
      first_name: application.first_name,
      last_name: application.last_name,
      phone: application.phone,
      playa_name: application.playa_name,
    })
    .eq("id", profileId);

  if (profileError) {
    console.error("[approveApplication] profile update", profileError);
    // Non-fatal: continue with approval
  }

  // Create confirmed registration for 2026
  const { data: campYear } = await adminClient
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();

  if (campYear) {
    const { error: regError } = await adminClient
      .from("registrations")
      .upsert(
        {
          profile_id: profileId,
          camp_year_id: campYear.id,
          status: "confirmed",
        },
        { onConflict: "profile_id,camp_year_id" }
      );

    if (regError) {
      console.error("[approveApplication] registration", regError);
    }
  }

  // Update application status and link profile
  const { error: statusError } = await adminClient
    .from("applications")
    .update({
      status: "approved",
      profile_id: profileId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (statusError) {
    console.error("[approveApplication] status update", statusError);
    return { error: "Failed to update application status." };
  }

  return { success: true };
}

export async function adminOverrideStatus(
  applicationId: string,
  status: "approved" | "rejected" | "waitlist"
): Promise<{ success: true } | { error: string }> {
  const { error: authError, user } = await requireSuperAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  if (status === "approved") {
    return approveApplication(applicationId);
  }

  // For reject/waitlist, just update the status
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("applications")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", applicationId);

  if (error) {
    console.error("[adminOverrideStatus]", error);
    return { error: "Failed to update application status." };
  }

  return { success: true };
}


export async function deleteApplication(
  id: string
): Promise<{ success: true } | { error: string }> {
  const { error: authError, supabase, user } = await requireSuperAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  const adminClient = createAdminClient();

  // Delete any associated video files
  const { data: app } = await adminClient
    .from("applications")
    .select("video_url")
    .eq("id", id)
    .single();

  if (app?.video_url) {
    await adminClient.storage
      .from("application-videos")
      .remove([app.video_url]);
  }

  // Delete the application (cascades to votes and comments)
  const { error } = await adminClient
    .from("applications")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[deleteApplication]", error);
    return { error: "Failed to delete application." };
  }

  return { success: true };
}

export async function getVideoSignedUrl(
  path: string
): Promise<{ url: string } | { error: string }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError) {
    return { error: authError };
  }

  const { data, error } = await supabase.storage
    .from("application-videos")
    .createSignedUrl(path, 3600);

  if (error || !data?.signedUrl) {
    console.error("[getVideoSignedUrl]", error);
    return { error: "Failed to generate video URL." };
  }

  return { url: data.signedUrl };
}

export async function getApplicationComments(
  applicationId: string
): Promise<ApplicationComment[] | { error: string }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError) {
    return { error: authError };
  }

  const { data, error } = await supabase
    .from("application_comments")
    .select(
      "*, author:profiles!author_id(first_name, last_name, playa_name, email)"
    )
    .eq("application_id", applicationId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[getApplicationComments]", error);
    return { error: "Failed to load comments." };
  }

  return data as unknown as ApplicationComment[];
}

export async function addApplicationComment(
  applicationId: string,
  body: string
): Promise<{ success: true } | { error: string }> {
  if (!body || body.trim().length === 0) {
    return { error: "Comment cannot be empty." };
  }
  if (body.length > 5000) {
    return { error: "Comment must be under 5000 characters." };
  }

  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  const { error } = await supabase
    .from("application_comments")
    .insert({
      application_id: applicationId,
      author_id: user.id,
      body: body.trim(),
    });

  if (error) {
    console.error("[addApplicationComment]", error);
    return { error: "Failed to add comment." };
  }

  return { success: true };
}

export async function getCurrentUserId(): Promise<string | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function getCurrentUserRole(): Promise<string | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  return data?.role ?? null;
}

export async function getCurrentUserProfile(): Promise<{ role: string; isCommitteeMember: boolean } | null> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("role, is_committee_member")
    .eq("id", user.id)
    .single();

  if (!data) return null;

  return { role: data.role, isCommitteeMember: data.is_committee_member ?? false };
}

export async function getApplicationSummary(): Promise<
  ApplicationSummaryData | { error: string }
> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError) {
    return { error: authError };
  }

  const adminClient = createAdminClient();

  // Count applications by status
  const { count: pendingCount } = await adminClient
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: approvedCount } = await adminClient
    .from("applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "approved");

  // Count confirmed registrations for 2026
  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id, max_members")
    .eq("year", 2026)
    .single();

  let slotsRemaining = 60;
  if (campYear) {
    const { count: confirmedCount } = await adminClient
      .from("registrations")
      .select("*", { count: "exact", head: true })
      .eq("camp_year_id", campYear.id)
      .eq("status", "confirmed");

    slotsRemaining = (campYear.max_members ?? 60) - (confirmedCount ?? 0);
  }

  return {
    pendingCount: pendingCount ?? 0,
    approvedCount: approvedCount ?? 0,
    slotsRemaining: Math.max(0, slotsRemaining),
  };
}

export async function requestCommitteeMembership(): Promise<
  { success: true } | { error: string }
> {
  const { error: authError, supabase, user } = await requireAuth();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  const { error } = await supabase.from("committee_requests").insert({
    profile_id: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "You already have a pending request." };
    }
    console.error("[requestCommitteeMembership]", error);
    return { error: "Failed to submit request." };
  }

  return { success: true };
}

export async function getMyCommitteeRequest(): Promise<
  CommitteeRequest | null | { error: string }
> {
  const { error: authError, supabase, user } = await requireAuth();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  const { data, error } = await supabase
    .from("committee_requests")
    .select("*")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[getMyCommitteeRequest]", error);
    return { error: "Failed to check committee request." };
  }

  return data as CommitteeRequest | null;
}
