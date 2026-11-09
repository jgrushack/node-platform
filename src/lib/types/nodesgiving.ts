import { z } from "zod";

export const menuCategories = ["Mains", "Sides", "Salads", "Desserts", "Drinks", "Supplies"] as const;
const dishName = z.string().trim().min(1, "Name the dish you’ll make.").max(150).regex(/[\p{L}\p{N}]/u, "Enter a dish name.");
export const contributionSchema = z.object({
  itemId: z.uuid(),
  dishName,
  servings: z.number().int().min(1).max(200),
  coCooks: z.string().trim().max(150),
});
export const nodesgivingRsvpSchema = z.object({
  status: z.enum(["going", "declined"]),
  hasGuest: z.boolean(),
  guestName: z.string().trim().max(100),
  guestDietaryNotes: z.string().trim().max(1000),
  revision: z.number().int().min(0),
  contributions: z.array(contributionSchema).max(100).refine(items => new Set(items.map(i => i.itemId)).size === items.length, "Choose each slot only once."),
}).refine(data => data.status === "going" || (!data.hasGuest && data.contributions.length === 0), {
  message: "Only confirmed attendees can bring a guest or claim dishes.",
}).refine(data => data.hasGuest || data.guestDietaryNotes === "", {
  message: "Guest dietary notes require a guest.",
});
export const nodesgivingMenuSchema = z.object({
  id: z.uuid().nullable(),
  name: z.string().trim().min(1, "Give this slot a name.").max(150),
  category: z.enum(menuCategories),
  description: z.string().trim().max(500),
  slots: z.number().int().min(1).max(100),
  servings: z.number().int().min(1).max(200),
});
export const suggestionSchema = z.object({
  dishName,
  category: z.enum(menuCategories),
  servings: z.number().int().min(1).max(200),
  coCooks: z.string().trim().max(150),
  notes: z.string().trim().max(500),
});
export const reviewSuggestionSchema = z.object({
  id: z.uuid(),
  decision: z.enum(["approved", "declined"]),
  itemId: z.uuid().nullable(),
  hostNote: z.string().trim().max(500),
}).refine(d => d.decision !== "approved" || d.itemId !== null, { message: "Choose an available menu slot to approve this dish." });
export type NodesgivingRsvpInput = z.infer<typeof nodesgivingRsvpSchema>;
export type NodesgivingContributionInput = z.infer<typeof contributionSchema>;
export type NodesgivingMenuInput = z.infer<typeof nodesgivingMenuSchema>;
export type NodesgivingSuggestionInput = z.infer<typeof suggestionSchema>;
export type NodesgivingReviewInput = z.infer<typeof reviewSuggestionSchema>;
export type NodesgivingMenuItem = NodesgivingMenuInput & { id: string; claimed: number };
export type NodesgivingCommitment = { item_id: string; dish_name: string; servings: number; co_cooks: string; member_name: string; is_mine: boolean };
export type NodesgivingSuggestion = { id: string; member_name: string; dish_name: string; category: typeof menuCategories[number]; servings: number; co_cooks: string; notes: string; status: "pending" | "approved" | "declined" | "withdrawn"; host_note: string; is_mine: boolean };
export type NodesgivingAttendee = {
  profile_id: string; name: string; status: NodesgivingRsvpInput["status"] | "needs_response";
  has_guest: boolean; guest_name: string; dietary_notes: string; guest_dietary_notes: string; profile_dietary_notes: string; item_ids: string[];
  revision: number; contributions: NodesgivingCommitment[];
};
export type NodesgivingData = {
  event: { title: string; event_date: string; location?: string | null };
  isAdmin: boolean;
  profileDietaryNotes: string;
  menu: NodesgivingMenuItem[];
  mine: NodesgivingAttendee | null;
  attendees: NodesgivingAttendee[];
  commitments: NodesgivingCommitment[];
  suggestions: NodesgivingSuggestion[];
  counts: { going: number; guests: number; needs_response: number; declined: number };
};
