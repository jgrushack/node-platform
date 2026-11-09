import { beforeEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { deleteNodesgivingMenu, getNodesgiving, saveNodesgivingMenu, saveNodesgivingRsvp, suggestNodesgivingDish, reviewNodesgivingSuggestion, withdrawNodesgivingSuggestion } from "../nodesgiving";
import type { NodesgivingRsvpInput } from "@/lib/types/nodesgiving";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
const id = "11111111-1111-4111-8111-111111111111";
const contribution = { itemId: id, dishName: "Apple pie", servings: 10, coCooks: "Sam" };
const rsvp: NodesgivingRsvpInput = { status: "going", hasGuest: true, guestName: "Sam", guestDietaryNotes: "Vegetarian", revision: 0, contributions: [contribution] };
const rpc = vi.fn();
const getUser = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "member" } } });
  rpc.mockResolvedValue({ error: null });
  vi.mocked(createClient).mockResolvedValue({ auth: { getUser }, rpc } as unknown as Awaited<ReturnType<typeof createClient>>);
});
describe("Nodesgiving server actions", () => {
  it("requires authentication for both reads and writes", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getNodesgiving()).toHaveProperty("error");
    expect(await saveNodesgivingRsvp(rsvp)).toHaveProperty("error");
    expect(await saveNodesgivingMenu({ id: null, name: "Pie", category: "Desserts", description: "", slots: 1, servings: 8 })).toHaveProperty("error");
    expect(await deleteNodesgivingMenu(id)).toHaveProperty("error");
    expect(await suggestNodesgivingDish({ dishName: "Slaw", category: "Salads", servings: 10, coCooks: "", notes: "" })).toHaveProperty("error");
    expect(await reviewNodesgivingSuggestion({ id, decision: "declined", itemId: null, hostNote: "" })).toHaveProperty("error");
    expect(await withdrawNodesgivingSuggestion(id)).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("saves attendance, guest and commitments in one authenticated transaction", async () => {
    expect(await saveNodesgivingRsvp(rsvp)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("save_nodesgiving_rsvp_v3", { p_status: "going", p_has_guest: true, p_guest_name: "Sam", p_guest_dietary_notes: "Vegetarian", p_revision: 0, p_contributions: [{ item_id: id, dish_name: "Apple pie", servings: 10, co_cooks: "Sam" }] });
    expect(revalidatePath).toHaveBeenCalledWith("/dashboard/nodesgiving");
  });
  it.each(["declined"] as const)("rejects commitments or a guest for %s", async status => {
    expect(await saveNodesgivingRsvp({ ...rsvp, status })).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
    expect(await saveNodesgivingRsvp({ ...rsvp, status, hasGuest: false, guestName: "", guestDietaryNotes: "", contributions: [] })).toEqual({ success: true });
  });
  it("rejects maybe responses and guest notes without a guest", async () => {
    expect(await saveNodesgivingRsvp({ ...rsvp, status: "maybe" } as unknown as NodesgivingRsvpInput)).toHaveProperty("error");
    expect(await saveNodesgivingRsvp({ ...rsvp, hasGuest: false })).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("rejects duplicate and invalid dish IDs", async () => {
    expect(await saveNodesgivingRsvp({ ...rsvp, contributions: [contribution, contribution] })).toHaveProperty("error");
    expect(await saveNodesgivingRsvp({ ...rsvp, contributions: [{ ...contribution, itemId: "bad" }] })).toHaveProperty("error");
    expect(await deleteNodesgivingMenu("bad")).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires a named dish, valid serving count and revision", async () => {
    for (const patch of [{ dishName: " " }, { dishName: "---" }, { servings: 0 }, { servings: 1.5 }, { coCooks: "x".repeat(151) }]) {
      expect(await saveNodesgivingRsvp({ ...rsvp, contributions: [{ ...contribution, ...patch }] })).toHaveProperty("error");
    }
    expect(await saveNodesgivingRsvp({ ...rsvp, revision: -1 })).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });
  it("validates suggestions and requires a slot for approval", async () => {
    const suggestion = { dishName: "Slaw", category: "Salads" as const, servings: 10, coCooks: "", notes: "" };
    expect(await suggestNodesgivingDish({ ...suggestion, servings: 0 })).toHaveProperty("error");
    expect(await reviewNodesgivingSuggestion({ id, decision: "approved", itemId: null, hostNote: "" })).toHaveProperty("error");
    expect(await withdrawNodesgivingSuggestion("bad")).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
    expect(await suggestNodesgivingDish(suggestion)).toEqual({ success: true });
    expect(rpc).toHaveBeenLastCalledWith("suggest_nodesgiving_dish", { p_dish_name: "Slaw", p_category: "Salads", p_servings: 10, p_co_cooks: "", p_notes: "" });
    expect(await reviewNodesgivingSuggestion({ id, decision: "approved", itemId: id, hostNote: "Great" })).toEqual({ success: true });
    expect(rpc).toHaveBeenLastCalledWith("review_nodesgiving_suggestion", { p_id: id, p_decision: "approved", p_item_id: id, p_host_note: "Great" });
    expect(await withdrawNodesgivingSuggestion(id)).toEqual({ success: true });
  });
  it("allows RSVP before menu selections", async () => {
    expect(await saveNodesgivingRsvp({ ...rsvp, contributions: [] })).toEqual({ success: true });
  });
  it("returns capacity conflicts without claiming success", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "A selected dish is full. Refresh the menu and choose another." } });
    expect(await saveNodesgivingRsvp(rsvp)).toEqual({ error: "A selected dish is full. Refresh the menu and choose another." });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("preserves database host authorization errors", async () => {
    rpc.mockResolvedValue({ error: { code: "P0001", message: "Unauthorized" } });
    expect(await deleteNodesgivingMenu(id)).toEqual({ error: "Unauthorized" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
  it("validates menu limits and names before mutation", async () => {
    for (const patch of [{ slots: 0 }, { slots: 1.5 }, { servings: 0 }, { name: "  " }]) {
      expect(await saveNodesgivingMenu({ id: null, name: "Pie", category: "Desserts", description: "", slots: 1, servings: 8, ...patch })).toHaveProperty("error");
    }
    expect(rpc).not.toHaveBeenCalled();
  });
  it("does not expose database internals on unexpected failure", async () => {
    rpc.mockResolvedValue({ error: { code: "42P01", message: "internal table detail" } });
    expect(await saveNodesgivingRsvp(rsvp)).toEqual({ error: "Your changes could not be saved. Please try again." });
    expect(await getNodesgiving()).toEqual({ error: "Nodesgiving could not be loaded. Please try again shortly." });
  });
});
