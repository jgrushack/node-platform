"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { nodesgivingMenuSchema, nodesgivingRsvpSchema, suggestionSchema, reviewSuggestionSchema, type NodesgivingSuggestionInput, type NodesgivingReviewInput, type NodesgivingData, type NodesgivingMenuInput, type NodesgivingRsvpInput } from "@/lib/types/nodesgiving";

async function session() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

export async function getNodesgiving(): Promise<NodesgivingData | { error: string }> {
  const { supabase, user } = await session();
  if (!user) return { error: "Please sign in to view Nodesgiving." };
  const { data, error } = await supabase.rpc("get_nodesgiving");
  if (error || !data?.event) {
    console.error("[getNodesgiving]", error);
    return { error: "Nodesgiving could not be loaded. Please try again shortly." };
  }
  return data as NodesgivingData;
}

async function mutate(name: string, args: Record<string, unknown>) {
  const { supabase, user } = await session();
  if (!user) return { error: "Please sign in to update Nodesgiving." };
  // The database checks host permissions and serializes writes so simultaneous
  // signups cannot overbook the final slot. Use the caller's session, never admin.
  const { error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`[${name}]`, error);
    return { error: error.code === "P0001" ? error.message : "Your changes could not be saved. Please try again." };
  }
  revalidatePath("/dashboard/nodesgiving");
  return { success: true as const };
}

export async function saveNodesgivingRsvp(input: NodesgivingRsvpInput) {
  const parsed = nodesgivingRsvpSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  return mutate("save_nodesgiving_rsvp_v3", {
    p_status: d.status, p_has_guest: d.hasGuest, p_guest_name: d.guestName,
    p_guest_dietary_notes: d.guestDietaryNotes, p_revision: d.revision,
    p_contributions: d.contributions.map(c => ({ item_id: c.itemId, dish_name: c.dishName, servings: c.servings, co_cooks: c.coCooks })),
  });
}

export async function saveNodesgivingMenu(input: NodesgivingMenuInput) {
  const parsed = nodesgivingMenuSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  return mutate("save_nodesgiving_menu", {
    p_id: d.id, p_name: d.name, p_category: d.category,
    p_description: d.description, p_slots: d.slots, p_servings: d.servings,
  });
}

export async function deleteNodesgivingMenu(id: string) {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid dish." };
  return mutate("delete_nodesgiving_menu", { p_id: id });
}

export async function suggestNodesgivingDish(input: NodesgivingSuggestionInput) {
  const parsed = suggestionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  return mutate("suggest_nodesgiving_dish", { p_dish_name: d.dishName, p_category: d.category, p_servings: d.servings, p_co_cooks: d.coCooks, p_notes: d.notes });
}

export async function reviewNodesgivingSuggestion(input: NodesgivingReviewInput) {
  const parsed = reviewSuggestionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  return mutate("review_nodesgiving_suggestion", { p_id: d.id, p_decision: d.decision, p_item_id: d.itemId, p_host_note: d.hostNote });
}

export async function withdrawNodesgivingSuggestion(id: string) {
  if (!z.uuid().safeParse(id).success) return { error: "Invalid suggestion." };
  return mutate("withdraw_nodesgiving_suggestion", { p_id: id });
}
