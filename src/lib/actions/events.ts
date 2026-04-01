"use server";

import { createClient } from "@/lib/supabase/server";
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
