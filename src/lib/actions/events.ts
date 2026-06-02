"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEventInviteBatch } from "@/lib/email/send";
import { REPLY_TO_EMAIL } from "@/lib/email/resend";
import {
  nodeEventSchema,
  type NodeEventFormData,
  type NodeEventRow,
} from "@/lib/types/event";

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

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" as const, supabase, user: null, role: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return { error: "Unauthorized" as const, supabase, user: null, role: null };
  }

  return { error: null, supabase, user, role: profile.role };
}

export async function getNodeEvents(): Promise<
  NodeEventRow[] | { error: string }
> {
  const { error: authError, supabase } = await requireAuth();
  if (authError) {
    return { error: authError };
  }

  const { data, error } = await supabase
    .from("node_events")
    .select("*")
    .order("event_date", { ascending: true });

  if (error) {
    console.error("[getNodeEvents]", error);
    return { error: "Failed to load events." };
  }

  return data as NodeEventRow[];
}

export async function createNodeEvent(
  formData: NodeEventFormData
): Promise<{ id: string } | { error: string }> {
  const { error: authError, supabase, user } = await requireAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  const parsed = nodeEventSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Get the current camp year
  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();

  if (!campYear) {
    return { error: "No active camp year found." };
  }

  const { data, error } = await supabase
    .from("node_events")
    .insert({
      camp_year_id: campYear.id,
      title: parsed.data.title,
      description: parsed.data.description || null,
      event_type: parsed.data.event_type,
      event_date: parsed.data.event_date,
      start_time: parsed.data.start_time || null,
      end_time: parsed.data.end_time || null,
      join_link: parsed.data.join_link || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("[createNodeEvent]", error);
    return { error: "Failed to create event." };
  }

  return { id: data.id };
}

export async function updateNodeEvent(
  eventId: string,
  formData: NodeEventFormData
): Promise<{ success: true } | { error: string }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError) {
    return { error: authError };
  }

  const parsed = nodeEventSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("node_events")
    .update({
      title: parsed.data.title,
      description: parsed.data.description || null,
      event_type: parsed.data.event_type,
      event_date: parsed.data.event_date,
      start_time: parsed.data.start_time || null,
      end_time: parsed.data.end_time || null,
      join_link: parsed.data.join_link || null,
    })
    .eq("id", eventId);

  if (error) {
    console.error("[updateNodeEvent]", error);
    return { error: "Failed to update event." };
  }

  return { success: true };
}

export async function deleteNodeEvent(
  eventId: string
): Promise<{ success: true } | { error: string }> {
  const { error: authError, supabase, user, role } = await requireAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  // Admins can only delete events they created; super_admins can delete any
  if (role === "admin") {
    const { data: event } = await supabase
      .from("node_events")
      .select("created_by")
      .eq("id", eventId)
      .single();

    if (!event || event.created_by !== user.id) {
      return { error: "You can only delete events you created." };
    }
  }

  const { error } = await supabase
    .from("node_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    console.error("[deleteNodeEvent]", error);
    return { error: "Failed to delete event." };
  }

  return { success: true };
}

function formatWhenLabel(
  eventDate: string,
  startTime: string | null,
  endTime: string | null
): string {
  const [y, m, d] = eventDate.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const datePart = dt.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  if (!startTime) return datePart;
  const fmtTime = (t: string) => {
    const [hh, mm] = t.split(":").map(Number);
    const ampm = hh >= 12 ? "PM" : "AM";
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${ampm}`;
  };
  const range = endTime
    ? `${fmtTime(startTime)} – ${fmtTime(endTime)}`
    : fmtTime(startTime);
  return `${datePart} at ${range}`;
}

export async function sendEventInvites(
  eventId: string
): Promise<
  | { success: true; sent: number; failed: number; recipients: number }
  | { error: string }
> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError) {
    return { error: authError };
  }

  // Load the event (server client OK — admin RLS allows read).
  const { data: event, error: eventError } = await supabase
    .from("node_events")
    .select(
      "id, camp_year_id, title, description, event_date, start_time, end_time, join_link, created_at, updated_at, invites_sent_at"
    )
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    console.error("[sendEventInvites] event lookup", eventError);
    return { error: "Event not found." };
  }

  if (event.invites_sent_at) {
    return { error: "Invites have already been sent for this event." };
  }

  // Admin client is required to resolve cross-user recipient emails
  // (profiles/registrations RLS blocks reading other members' contact info).
  const admin = createAdminClient();

  const { data: regs, error: regError } = await admin
    .from("registrations")
    .select("profile_id, profiles(first_name, email)")
    .eq("camp_year_id", event.camp_year_id)
    .eq("status", "confirmed");

  if (regError) {
    console.error("[sendEventInvites] registrations", regError);
    return { error: "Failed to resolve recipients." };
  }

  const recipients = (regs ?? [])
    .map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (r as any).profiles;
      const email = p?.email as string | undefined;
      const firstName = (p?.first_name as string | undefined) ?? "there";
      return email ? { email, firstName } : null;
    })
    .filter((r): r is { email: string; firstName: string } => r !== null);

  if (recipients.length === 0) {
    return { error: "No confirmed members to invite." };
  }

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL || "https://nodev0.vercel.app";
  const webcalUrl = siteUrl.replace(/^https?:/, "webcal:") + "/api/calendar.ics";
  const organizerEmail = REPLY_TO_EMAIL.replace(/^.*<(.+)>.*$/, "$1");

  const { sent, failed } = await sendEventInviteBatch({
    recipients,
    event: {
      uid: `${event.id}@node.family`,
      title: event.title,
      description: event.description,
      date: event.event_date,
      startTime: event.start_time,
      endTime: event.end_time,
      url: event.join_link,
      createdAt: event.created_at,
      updatedAt: event.updated_at,
    },
    organizer: { email: organizerEmail, name: "NODE" },
    whenLabel: formatWhenLabel(
      event.event_date,
      event.start_time,
      event.end_time
    ),
    siteUrl,
    webcalUrl,
  });

  // Stamp invites_sent_at even on partial failure — re-sending would double-invite
  // members who already got it. Failures are returned to the caller to surface.
  const sentAt = new Date().toISOString();
  const { error: stampError } = await admin
    .from("node_events")
    .update({ invites_sent_at: sentAt })
    .eq("id", eventId);

  if (stampError) {
    console.error("[sendEventInvites] stamp", stampError);
  }

  return { success: true, sent, failed, recipients: recipients.length };
}
