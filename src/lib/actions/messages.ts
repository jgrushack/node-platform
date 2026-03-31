"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendCampMessageBatch } from "@/lib/email/send";
import {
  composeMessageSchema,
  type AudienceFilter,
  type CampMessage,
  type RecipientPreview,
  type UnreadMessage,
} from "@/lib/types/message";
import { campMessageEmail } from "@/lib/email/templates/camp-message";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" as const, user: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_committee_member")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: "Unauthorized" as const, user: null };
  }

  return { error: null, user };
}

/**
 * Resolve audience filter into a list of recipient profiles.
 * Uses admin client to bypass RLS (needs camper_standings access).
 */
export async function previewRecipients(
  filter: AudienceFilter
): Promise<{ recipients: RecipientPreview[]; count: number } | { error: string }> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const admin = createAdminClient();

  // Custom mode: just look up the specific profiles
  if (filter.type === "custom" && filter.profile_ids?.length) {
    const { data, error: dbError } = await admin
      .from("profiles")
      .select("id, first_name, last_name, playa_name, email")
      .in("id", filter.profile_ids);

    if (dbError) return { error: "Failed to fetch recipients." };
    const recipients = (data || []) as RecipientPreview[];
    return { recipients, count: recipients.length };
  }

  // Fetch all profiles (standing gate handles exclusions, not is_active)
  const { data: allProfiles, error: profError } = await admin
    .from("profiles")
    .select("id, first_name, last_name, playa_name, email, role, is_committee_member, node_events_attended, onboarding_completed_at, is_active");

  if (profError || !allProfiles) return { error: "Failed to fetch profiles." };

  // Fetch standings to exclude not_invited_back (and optionally reapply/limited_referrals)
  const { data: standingsData } = await admin
    .from("camper_standings")
    .select("profile_id, standing");

  const standings: Record<string, string> = {};
  for (const s of standingsData || []) {
    standings[s.profile_id] = s.standing;
  }

  // Fetch registrations for year-based and tenure filters
  // Include all non-cancelled registrations (pending, confirmed, waitlisted)
  const { data: regs } = await admin
    .from("registrations")
    .select("profile_id, camp_years(year)")
    .neq("status", "cancelled");

  // Build per-profile registration year sets
  const yearsByProfile: Record<string, number[]> = {};
  for (const r of regs || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const year = (r as any).camp_years?.year;
    if (year) {
      if (!yearsByProfile[r.profile_id]) yearsByProfile[r.profile_id] = [];
      yearsByProfile[r.profile_id].push(year);
    }
  }

  let candidates = allProfiles;

  // Standing gate: exclude not_invited_back and reapply (they're effectively out)
  candidates = candidates.filter((p) => {
    const s = standings[p.id];
    return s !== "not_invited_back" && s !== "reapply";
  });

  // If type is "all", return everyone who passed the standing gate
  if (filter.type === "all") {
    const recipients = candidates.map((p) => ({
      id: p.id,
      first_name: p.first_name,
      last_name: p.last_name,
      playa_name: p.playa_name,
      email: p.email,
    }));
    return { recipients, count: recipients.length };
  }

  // Apply "filtered" criteria (all AND-ed)

  // Registration years
  if (filter.registration_years?.length) {
    const targetYears = new Set(filter.registration_years);
    candidates = candidates.filter((p) => {
      const years = yearsByProfile[p.id] || [];
      return years.some((y) => targetYears.has(y));
    });
  }

  // Roles
  if (filter.roles?.length) {
    candidates = candidates.filter((p) => filter.roles!.includes(p.role as "lead" | "admin" | "super_admin"));
  }

  // Committee member
  if (filter.is_committee_member) {
    candidates = candidates.filter((p) => p.is_committee_member);
  }

  // Build crew
  if (filter.is_build_crew) {
    candidates = candidates.filter((p) => {
      const events = (p.node_events_attended as string[]) || [];
      return events.some((e) => e.startsWith("Build"));
    });
  }

  // Tenure
  if (filter.tenure) {
    candidates = candidates.filter((p) => {
      const count = (yearsByProfile[p.id] || []).length;
      switch (filter.tenure) {
        case "og": return count >= 7;
        case "veteran": return count >= 5;
        case "first_year": return count === 1;
        default: return true;
      }
    });
  }

  // Onboarding incomplete
  if (filter.onboarding_incomplete) {
    candidates = candidates.filter((p) => !p.onboarding_completed_at);
  }

  const recipients = candidates.map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    playa_name: p.playa_name,
    email: p.email,
  }));

  return { recipients, count: recipients.length };
}

/**
 * Save a new draft.
 */
export async function saveDraft(
  data: { subject?: string; body_html?: string; audience_filter?: AudienceFilter }
): Promise<{ success: true; id: string } | { error: string }> {
  const { error, user } = await requireAdmin();
  if (error || !user) return { error: error ?? "Not authenticated" };

  const admin = createAdminClient();
  const { data: msg, error: insertError } = await admin
    .from("camp_messages")
    .insert({
      subject: data.subject || "",
      body_html: data.body_html || "",
      audience_filter: data.audience_filter || { type: "all" },
      sent_by: user.id,
      updated_by: user.id,
      status: "draft",
    })
    .select("id")
    .single();

  if (insertError || !msg) {
    console.error("[saveDraft]", insertError);
    return { error: "Failed to save draft." };
  }

  return { success: true, id: msg.id };
}

/**
 * Update an existing draft.
 */
export async function updateDraft(
  id: string,
  data: { subject?: string; body_html?: string; audience_filter?: AudienceFilter }
): Promise<{ success: true } | { error: string }> {
  const { error, user } = await requireAdmin();
  if (error || !user) return { error: error ?? "Not authenticated" };

  const admin = createAdminClient();

  // Verify it's still a draft
  const { data: existing } = await admin
    .from("camp_messages")
    .select("status")
    .eq("id", id)
    .single();

  if (!existing || existing.status !== "draft") {
    return { error: "Can only edit drafts." };
  }

  const { error: updateError } = await admin
    .from("camp_messages")
    .update({
      ...(data.subject !== undefined && { subject: data.subject }),
      ...(data.body_html !== undefined && { body_html: data.body_html }),
      ...(data.audience_filter !== undefined && { audience_filter: data.audience_filter }),
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (updateError) {
    console.error("[updateDraft]", updateError);
    return { error: "Failed to update draft." };
  }

  return { success: true };
}

/**
 * Delete a draft.
 */
export async function deleteDraft(
  id: string
): Promise<{ success: true } | { error: string }> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const admin = createAdminClient();
  const { error: delError } = await admin
    .from("camp_messages")
    .delete()
    .eq("id", id)
    .eq("status", "draft");

  if (delError) {
    console.error("[deleteDraft]", delError);
    return { error: "Failed to delete draft." };
  }

  return { success: true };
}

/**
 * Delete a sent message (cascades to message_recipients via ON DELETE CASCADE).
 */
export async function deleteMessage(
  id: string
): Promise<{ success: true } | { error: string }> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const admin = createAdminClient();
  const { error: delError } = await admin
    .from("camp_messages")
    .delete()
    .eq("id", id);

  if (delError) {
    console.error("[deleteMessage]", delError);
    return { error: "Failed to delete message." };
  }

  return { success: true };
}

/**
 * Send a message from a draft or directly.
 * If draftId provided, transitions that draft to sent.
 */
export async function sendMessage(
  data: unknown,
  draftId?: string
): Promise<{ success: true; messageId: string; sent: number; failed: number } | { error: string }> {
  const parsed = composeMessageSchema.safeParse(data);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { error, user } = await requireAdmin();
  if (error || !user) return { error: error ?? "Not authenticated" };

  const { subject, body_html, audience_filter } = parsed.data;

  const preview = await previewRecipients(audience_filter);
  if ("error" in preview) return { error: preview.error };
  if (preview.count === 0) return { error: "No recipients match the selected audience." };

  const admin = createAdminClient();
  let messageId: string;

  if (draftId) {
    // Transition draft to sent
    const { error: updateError } = await admin
      .from("camp_messages")
      .update({
        subject,
        body_html,
        audience_filter,
        status: "sent",
        recipient_count: preview.count,
        sent_at: new Date().toISOString(),
        updated_by: user.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draftId)
      .eq("status", "draft");

    if (updateError) {
      console.error("[sendMessage] update draft", updateError);
      return { error: "Failed to send draft." };
    }
    messageId = draftId;
  } else {
    // Create new sent message
    const { data: msg, error: insertError } = await admin
      .from("camp_messages")
      .insert({
        subject,
        body_html,
        audience_filter,
        sent_by: user.id,
        updated_by: user.id,
        recipient_count: preview.count,
        status: "sent",
      })
      .select("id")
      .single();

    if (insertError || !msg) {
      console.error("[sendMessage] insert", insertError);
      return { error: "Failed to create message." };
    }
    messageId = msg.id;
  }

  // Insert recipient rows
  const recipientRows = preview.recipients.map((r) => ({
    message_id: messageId,
    profile_id: r.id,
  }));

  const { error: recipError } = await admin
    .from("message_recipients")
    .insert(recipientRows);

  if (recipError) {
    console.error("[sendMessage] recipients", recipError);
  }

  // Send emails
  const emailRecipients = preview.recipients.map((r) => ({
    email: r.email,
  }));

  const { sent, failed } = await sendCampMessageBatch({
    recipients: emailRecipients,
    subject,
    bodyHtml: body_html,
  });

  if (sent > 0) {
    await admin
      .from("message_recipients")
      .update({ email_sent: true })
      .eq("message_id", messageId);
  }

  return { success: true, messageId, sent, failed };
}

/**
 * Get sent messages (admin view).
 */
export async function getMessages(): Promise<CampMessage[] | { error: string }> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const supabase = await createClient();
  const { data, error: dbError } = await supabase
    .from("camp_messages")
    .select("*, sender:profiles!sent_by(first_name, last_name, playa_name, email)")
    .eq("status", "sent")
    .order("sent_at", { ascending: false });

  if (dbError) {
    console.error("[getMessages]", dbError);
    return { error: "Failed to load messages." };
  }

  return (data || []) as unknown as CampMessage[];
}

/**
 * Get drafts (admin view).
 */
export async function getDrafts(): Promise<CampMessage[] | { error: string }> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const admin = createAdminClient();
  const { data, error: dbError } = await admin
    .from("camp_messages")
    .select("*, sender:profiles!sent_by(first_name, last_name, playa_name, email)")
    .eq("status", "draft")
    .order("updated_at", { ascending: false });

  if (dbError) {
    console.error("[getDrafts]", dbError);
    return { error: "Failed to load drafts." };
  }

  return (data || []) as unknown as CampMessage[];
}

/**
 * Generate email preview HTML for a message.
 */
export async function getEmailPreview(
  subject: string,
  bodyHtml: string
): Promise<{ html: string } | { error: string }> {
  const { error } = await requireAdmin();
  if (error) return { error };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nodev0.vercel.app";
  const html = campMessageEmail({
    subject,
    bodyHtml,
    siteUrl,
  });

  return { html };
}

/**
 * Get unread messages for the current user.
 */
export async function getUnreadMessages(): Promise<UnreadMessage[] | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("message_recipients")
    .select("id, message_id, read_at, message:camp_messages!message_id(subject, body_html, sent_at, sender:profiles!sent_by(first_name, last_name))")
    .eq("profile_id", user.id)
    .is("read_at", null)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getUnreadMessages]", error);
    return { error: "Failed to load messages." };
  }

  return (data || []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (row as any).message;
    const sender = msg?.sender;
    const senderName = sender
      ? [sender.first_name, sender.last_name].filter(Boolean).join(" ") || "NODE Admin"
      : "NODE Admin";
    return {
      id: row.id,
      message_id: row.message_id,
      subject: msg?.subject || "",
      body_html: msg?.body_html || "",
      sent_at: msg?.sent_at || "",
      sender_name: senderName,
    };
  }) as UnreadMessage[];
}

/**
 * Get all messages for the current user (read and unread).
 */
export async function getMyMessages(): Promise<UnreadMessage[] | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data, error } = await supabase
    .from("message_recipients")
    .select("id, message_id, read_at, message:camp_messages!message_id(subject, body_html, sent_at, sender:profiles!sent_by(first_name, last_name))")
    .eq("profile_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[getMyMessages]", error);
    return { error: "Failed to load messages." };
  }

  return (data || []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const msg = (row as any).message;
    const sender = msg?.sender;
    const senderName = sender
      ? [sender.first_name, sender.last_name].filter(Boolean).join(" ") || "NODE Admin"
      : "NODE Admin";
    return {
      id: row.id,
      message_id: row.message_id,
      subject: msg?.subject || "",
      body_html: msg?.body_html || "",
      sent_at: msg?.sent_at || "",
      sender_name: senderName,
      read_at: row.read_at,
    };
  }) as UnreadMessage[];
}

/**
 * Mark a message as read.
 */
export async function markMessageRead(
  recipientId: string
): Promise<{ success: true } | { error: string }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("message_recipients")
    .update({ read_at: new Date().toISOString() })
    .eq("id", recipientId);

  if (error) {
    console.error("[markMessageRead]", error);
    return { error: "Failed to mark message as read." };
  }

  return { success: true };
}
