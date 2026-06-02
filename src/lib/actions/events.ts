"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getConnectionStatus,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
  getEventAttendees,
} from "@/lib/google/calendar";
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
  const { error: authError, supabase, user, role } = await requireAdmin();
  if (authError || !user) {
    return { error: authError ?? "Not authenticated" };
  }

  const parsed = nodeEventSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  // Plain admins can only edit events they created; super_admins can edit any.
  // (Mirrors deleteNodeEvent's ownership rule.)
  if (role === "admin") {
    const { data: existing } = await supabase
      .from("node_events")
      .select("created_by")
      .eq("id", eventId)
      .single();

    if (!existing || existing.created_by !== user.id) {
      return { error: "You can only edit events you created." };
    }
  }

  const { data: updated, error } = await supabase
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
    .eq("id", eventId)
    .select("google_event_id")
    .single();

  if (error) {
    console.error("[updateNodeEvent]", error);
    return { error: "Failed to update event." };
  }

  // If invites were already sent (event mirrored to Google), patch the Google
  // event so attendees get the update. Best-effort — don't fail the edit on it.
  if (updated?.google_event_id) {
    try {
      await updateCalendarEvent(updated.google_event_id, {
        title: parsed.data.title,
        description: parsed.data.description || null,
        location: parsed.data.join_link || null,
        date: parsed.data.event_date,
        startTime: parsed.data.start_time || null,
        endTime: parsed.data.end_time || null,
      });
    } catch (e) {
      console.error("[updateNodeEvent] google sync", e);
    }
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

  // Need created_by (ownership) and google_event_id (to cancel the invite).
  const { data: event } = await supabase
    .from("node_events")
    .select("created_by, google_event_id")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { error: "Event not found." };
  }

  // Admins can only delete events they created; super_admins can delete any.
  if (role === "admin" && event.created_by !== user.id) {
    return { error: "You can only delete events you created." };
  }

  const { error } = await supabase
    .from("node_events")
    .delete()
    .eq("id", eventId);

  if (error) {
    console.error("[deleteNodeEvent]", error);
    return { error: "Failed to delete event." };
  }

  // Cancel the Google Calendar event so attendees get a cancellation. Best-effort.
  if (event.google_event_id) {
    try {
      await deleteCalendarEvent(event.google_event_id);
    } catch (e) {
      console.error("[deleteNodeEvent] google cancel", e);
    }
  }

  return { success: true };
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
      "id, camp_year_id, title, description, event_date, start_time, end_time, join_link, invites_sent_at, google_event_id"
    )
    .eq("id", eventId)
    .single();

  if (eventError || !event) {
    console.error("[sendEventInvites] event lookup", eventError);
    return { error: "Event not found." };
  }

  // Invites are sent by creating the event on the connected Google account,
  // which emails attendees and collects RSVPs natively.
  const { connected } = await getConnectionStatus();
  if (!connected) {
    return {
      error: "Connect a Google Calendar account first (Calendar → Connect Google Calendar).",
    };
  }

  // Admin client is required to resolve cross-user recipient emails
  // (profiles/registrations RLS blocks reading other members' contact info).
  const admin = createAdminClient();

  // Atomically CLAIM the invite lock before sending: flip invites_sent_at
  // null -> now() in one conditional update. If no row comes back, another call
  // already sent (or is mid-send) — this prevents double-inviting the whole
  // membership on a double-click or two concurrent admins.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("node_events")
    .update({ invites_sent_at: claimedAt })
    .eq("id", eventId)
    .is("invites_sent_at", null)
    .select("id");

  if (claimError) {
    console.error("[sendEventInvites] claim lock", claimError);
    return { error: "Failed to send invites." };
  }
  if (!claimed || claimed.length === 0) {
    return { error: "Invites have already been sent for this event." };
  }

  // Release the lock if we bail before any email is actually delivered, so the
  // admin can retry (e.g. no recipients, or a total email-provider outage).
  const releaseLock = async () => {
    const { error: releaseError } = await admin
      .from("node_events")
      .update({ invites_sent_at: null })
      .eq("id", eventId);
    if (releaseError) console.error("[sendEventInvites] release lock", releaseError);
  };

  const { data: regs, error: regError } = await admin
    .from("registrations")
    .select("profile_id, profiles(email)")
    .eq("camp_year_id", event.camp_year_id)
    .eq("status", "confirmed");

  if (regError) {
    console.error("[sendEventInvites] registrations", regError);
    await releaseLock();
    return { error: "Failed to resolve recipients." };
  }

  const emails = (regs ?? [])
    .map((r) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const email = (r as any).profiles?.email as string | undefined;
      return email && email.trim().length > 0 ? email : null;
    })
    .filter((e): e is string => e !== null);

  if (emails.length === 0) {
    await releaseLock();
    return { error: "No confirmed members to invite." };
  }

  // Create the event on the connected Google calendar with attendees. Google
  // sends the invitations and collects RSVPs. Store the Google event id so
  // edits/deletes propagate and we can read RSVPs back into the dashboard.
  try {
    const { id: googleEventId, htmlLink } = await createCalendarEvent({
      title: event.title,
      description: event.description,
      location: event.join_link,
      date: event.event_date,
      startTime: event.start_time,
      endTime: event.end_time,
      attendees: emails,
    });
    const { error: persistError } = await admin
      .from("node_events")
      .update({ google_event_id: googleEventId, google_html_link: htmlLink })
      .eq("id", eventId);
    if (persistError) {
      // Invites WERE sent (the Google event exists) but we couldn't persist its
      // id. Do NOT release the lock. Log loudly — edits/deletes/RSVP sync guard
      // on google_event_id and will no-op until it's backfilled.
      console.error(
        `[sendEventInvites] CRITICAL: Google event ${googleEventId} created but google_event_id not persisted for event ${eventId}`,
        persistError
      );
    }
  } catch (e) {
    // Nothing was sent — release the lock so the admin can retry.
    console.error("[sendEventInvites] google create", e);
    await releaseLock();
    return {
      error: "Failed to create the Google Calendar invite. Please try again.",
    };
  }

  return { success: true, sent: emails.length, failed: 0, recipients: emails.length };
}

/** Admin: is the camp Google Calendar account connected? */
export async function getCalendarConnectionStatus(): Promise<
  { connected: boolean; accountEmail: string | null } | { error: string }
> {
  const { error: authError } = await requireAdmin();
  if (authError) return { error: authError };
  return await getConnectionStatus();
}

export type EventRsvpSummary = {
  sent: boolean;
  counts: { accepted: number; tentative: number; declined: number; needsAction: number };
  attendees: { name: string; email: string; status: string }[];
};

/** Build an RSVP summary from a Google event's attendees (shared by real + test). */
async function summarizeRsvps(googleEventId: string): Promise<EventRsvpSummary> {
  const attendees = await getEventAttendees(googleEventId);

  // Map attendee emails -> member names (admin client; cross-user read).
  const admin = createAdminClient();
  const emails = attendees.map((a) => a.email).filter(Boolean);
  const nameByEmail: Record<string, string> = {};
  if (emails.length) {
    const { data: profs } = await admin
      .from("profiles")
      .select("first_name, last_name, email")
      .in("email", emails);
    for (const p of profs ?? []) {
      if (p.email) {
        nameByEmail[p.email.toLowerCase()] =
          [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email;
      }
    }
  }

  const counts = { accepted: 0, tentative: 0, declined: 0, needsAction: 0 };
  const seen = new Set<string>();
  const list: { name: string; email: string; status: string }[] = [];
  for (const a of attendees) {
    // Dedupe by email — Google can return duplicate or resource/room entries.
    const key = a.email?.toLowerCase();
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    if (a.responseStatus in counts) {
      counts[a.responseStatus as keyof typeof counts]++;
    }
    list.push({
      name: nameByEmail[key ?? ""] ?? a.displayName ?? a.email ?? "Unknown",
      email: a.email ?? "",
      status: a.responseStatus,
    });
  }

  return { sent: true, counts, attendees: list };
}

/** Admin: read RSVP responses for an event back from Google Calendar. */
export async function getEventRsvps(
  eventId: string
): Promise<EventRsvpSummary | { error: string }> {
  const { error: authError, supabase } = await requireAdmin();
  if (authError) return { error: authError };

  const { data: event } = await supabase
    .from("node_events")
    .select("google_event_id")
    .eq("id", eventId)
    .single();

  if (!event?.google_event_id) {
    return {
      sent: false,
      counts: { accepted: 0, tentative: 0, declined: 0, needsAction: 0 },
      attendees: [],
    };
  }

  try {
    return await summarizeRsvps(event.google_event_id);
  } catch (e) {
    console.error("[getEventRsvps]", e);
    return { error: "Failed to load RSVPs from Google Calendar." };
  }
}
