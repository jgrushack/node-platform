"use server";

import { createClient } from "@/lib/supabase/server";
import {
  applicationSchema,
  type ApplicationFormData,
  type ApplicationRow,
} from "@/lib/types/application";

export async function submitApplication(
  data: ApplicationFormData
): Promise<{ id: string } | { error: string }> {
  const parsed = applicationSchema.safeParse(data);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("applications")
    .insert({
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
    })
    .select("id")
    .single();

  if (error) {
    return { error: "Failed to submit application. Please try again." };
  }

  return { id: row.id };
}

export async function uploadApplicationVideo(
  applicationId: string,
  formData: FormData
): Promise<{ success: true } | { error: string }> {
  const file = formData.get("video") as File | null;
  if (!file) {
    return { error: "No video file provided" };
  }

  const supabase = await createClient();
  const filePath = `${applicationId}/${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("application-videos")
    .upload(filePath, file);

  if (uploadError) {
    return { error: "Failed to upload video. Please try again." };
  }

  const { error: updateError } = await supabase
    .from("applications")
    .update({ video_url: filePath })
    .eq("id", applicationId);

  if (updateError) {
    return { error: "Video uploaded but failed to link to application." };
  }

  return { success: true };
}

export async function getApplications(): Promise<ApplicationRow[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return [];
  }

  return data as ApplicationRow[];
}

export async function updateApplicationStatus(
  id: string,
  status: "approved" | "rejected" | "waitlist",
  notes?: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
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
    return { error: "Failed to update application status." };
  }

  return { success: true };
}

export async function getVideoSignedUrl(
  path: string
): Promise<{ url: string } | { error: string }> {
  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from("application-videos")
    .createSignedUrl(path, 3600); // 1 hour

  if (error || !data?.signedUrl) {
    return { error: "Failed to generate video URL." };
  }

  return { url: data.signedUrl };
}
