"use server";

import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import {
  applicationSchema,
  type ApplicationFormData,
  type ApplicationRow,
  type ApplicationComment,
} from "@/lib/types/application";
import { appendApplicationToSheet } from "@/lib/google-sheets";

const ALLOWED_VIDEO_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
];
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50MB

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
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: "Unauthorized" as const, supabase, user: null };
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

  const supabase = await createClient();
  const id = randomUUID();

  const { error } = await supabase
    .from("applications")
    .insert({
      id,
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
    });

  if (error) {
    console.error("[submitApplication]", error);
    return { error: "Failed to submit application. Please try again." };
  }

  // Non-blocking: sync to Google Sheet for redundancy
  appendApplicationToSheet(parsed.data).catch((err) => {
    console.error("[Google Sheets sync]", err);
  });

  return { id };
}

export async function uploadApplicationVideo(
  applicationId: string,
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const file = formData.get("video") as File | null;
  if (!file) {
    return { error: "No video file provided" };
  }

  // Validate file size
  if (file.size > MAX_VIDEO_SIZE) {
    return { error: "Video must be under 50MB." };
  }

  // Validate file type
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return { error: "Only MP4, WebM, MOV, and AVI video files are allowed." };
  }

  const supabase = await createClient();

  // Sanitize filename
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${applicationId}/${safeFilename}`;

  const { error: uploadError } = await supabase.storage
    .from("application-videos")
    .upload(filePath, file);

  if (uploadError) {
    console.error("[uploadApplicationVideo]", uploadError);
    return { error: "Failed to upload video. Please try again." };
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ video_url: filePath })
    .eq("id", applicationId);

  if (updateError) {
    console.error("[uploadApplicationVideo] link error", updateError);
    return { error: "Video uploaded but failed to link to application." };
  }

  return { success: true };
}

export async function getApplications(): Promise<
  ApplicationRow[] | { error: string }
> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError) {
    return { error: authError };
  }

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getApplications]", error);
    return { error: "Failed to load applications." };
  }

  return data as ApplicationRow[];
}

export async function updateApplicationStatus(
  id: string,
  status: "approved" | "rejected" | "waitlist",
  notes?: string
): Promise<{ success: true } | { error: string }> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  const { error } = await supabase
    .from("applications")
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewer_notes: notes || null,
    })
    .eq("id", id);

  if (error) {
    console.error("[updateApplicationStatus]", error);
    return { error: "Failed to update application status." };
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
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  const { error } = await supabase
    .from("application_comments")
    .insert({
      application_id: applicationId,
      author_id: user.id,
      body,
    });

  if (error) {
    console.error("[addApplicationComment]", error);
    return { error: "Failed to add comment." };
  }

  return { success: true };
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
