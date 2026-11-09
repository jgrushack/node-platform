import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NodesgivingClient } from "../nodesgiving-client";
import { getNodesgiving, saveNodesgivingRsvp } from "@/lib/actions/nodesgiving";
import type { NodesgivingData } from "@/lib/types/nodesgiving";
vi.mock("@/lib/actions/nodesgiving", () => ({ getNodesgiving: vi.fn(), saveNodesgivingRsvp: vi.fn(), saveNodesgivingMenu: vi.fn(), deleteNodesgivingMenu: vi.fn(), suggestNodesgivingDish: vi.fn(), reviewNodesgivingSuggestion: vi.fn(), withdrawNodesgivingSuggestion: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const itemId = "11111111-1111-4111-8111-111111111111";
const initial: NodesgivingData = {
  event: { title: "Nodesgiving", event_date: "2026-11-21" }, isAdmin: false, profileDietaryNotes: "Vegetarian", menu: [], mine: null,
  attendees: [], commitments: [], suggestions: [], counts: { going: 0, guests: 0, needs_response: 0, declined: 0 },
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getNodesgiving).mockResolvedValue(initial);
  vi.mocked(saveNodesgivingRsvp).mockResolvedValue({ success: true });
});
describe("Nodesgiving RSVP flow", () => {
  it("accepts an RSVP with a guest before the hosts publish dishes", async () => {
    render(<NodesgivingClient initial={initial} />);
    fireEvent.change(screen.getByLabelText("Will you join us?"), { target: { value: "going" } });
    fireEvent.click(screen.getByLabelText("I’m bringing one guest (+1)"));
    fireEvent.change(screen.getByLabelText("Guest’s name (optional)"), { target: { value: "Sam" } });
    fireEvent.click(screen.getByRole("button", { name: "Save RSVP & commitments" }));
    await waitFor(() => expect(saveNodesgivingRsvp).toHaveBeenCalledWith({ status: "going", hasGuest: true, guestName: "Sam", guestDietaryNotes: "", revision: 0, contributions: [] }));
    expect(screen.queryByText("Host tools · Manage menu slots")).not.toBeInTheDocument();
  });
  it("clears guest and dish commitments when changing to no", async () => {
    render(<NodesgivingClient initial={{ ...initial, mine: { profile_id: "member", name: "Member", status: "going", has_guest: true, guest_name: "Sam", dietary_notes: "", profile_dietary_notes: "Vegetarian", guest_dietary_notes: "No peanuts", item_ids: [itemId], revision: 0, contributions: [] } }} />);
    fireEvent.change(screen.getByLabelText("Will you join us?"), { target: { value: "declined" } });
    expect(screen.getByText(/release your dishes/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save RSVP & commitments" }));
    await waitFor(() => expect(saveNodesgivingRsvp).toHaveBeenCalledWith({ status: "declined", hasGuest: false, guestName: "", guestDietaryNotes: "", revision: 0, contributions: [] }));
  });
  it("uses profile dietary needs and shows guest notes only for a guest", () => {
    render(<NodesgivingClient initial={initial} />);
    expect(screen.getByText("Vegetarian")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update your NODE profile" })).toHaveAttribute("href", "/dashboard/profile");
    expect(screen.queryByRole("option", { name: "Maybe" })).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Will you join us?"), { target: { value: "going" } });
    fireEvent.click(screen.getByLabelText("I’m bringing one guest (+1)"));
    expect(screen.getByLabelText(/Guest’s dietary needs/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("I’m bringing one guest (+1)"));
    expect(screen.queryByLabelText(/Guest’s dietary needs/)).not.toBeInTheDocument();
  });
  it("saves a named shared dish with its serving count and shows existing dishes", async () => {
    render(<NodesgivingClient initial={{ ...initial, menu: [{ id: itemId, name: "Salads", category: "Salads", description: "Two different salads", slots: 2, servings: 10, claimed: 1 }], commitments: [{ item_id: itemId, dish_name: "Kale salad", servings: 10, co_cooks: "Alex", member_name: "Jordan", is_mine: false }] }} />);
    expect(screen.getByText("Kale salad")).toBeInTheDocument();
    expect(screen.getByText(/No approval needed/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Suggest dish" })).not.toBeInTheDocument();
    expect(screen.getByText("Jordan with Alex")).toBeInTheDocument();
    expect(screen.getByText(/all guests are expected to pitch in with setup and cleanup/)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Will you join us?"), { target: { value: "going" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /Salads/ }));
    fireEvent.change(screen.getByLabelText("Your dish for Salads"), { target: { value: "Citrus fennel salad" } });
    fireEvent.change(screen.getByLabelText("Servings for Salads"), { target: { value: "12" } });
    fireEvent.change(screen.getByLabelText("Making Salads with (optional)"), { target: { value: "Sam" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Save RSVP & commitments" })[0]);
    await waitFor(() => expect(saveNodesgivingRsvp).toHaveBeenCalledWith({ status: "going", hasGuest: false, guestName: "", guestDietaryNotes: "", revision: 0, contributions: [{ itemId, dishName: "Citrus fennel salad", servings: 12, coCooks: "Sam" }] }));
  });
  it("refreshes a stale RSVP without losing a newly approved dish", async () => {
    const mine = { profile_id: "member", name: "Member", status: "going" as const, has_guest: false, guest_name: "", dietary_notes: "", profile_dietary_notes: "Vegetarian", guest_dietary_notes: "", item_ids: [], revision: 1, contributions: [] };
    const menu = [{ id: itemId, name: "Salads", category: "Salads" as const, description: "", slots: 2, servings: 10, claimed: 0 }];
    const approved = { item_id: itemId, dish_name: "Slaw", servings: 10, co_cooks: "Sam", member_name: "Member", is_mine: true };
    vi.mocked(saveNodesgivingRsvp).mockResolvedValueOnce({ error: "Your RSVP changed elsewhere." });
    vi.mocked(getNodesgiving).mockResolvedValue({ ...initial, menu, commitments: [approved], mine: { ...mine, revision: 2, item_ids: [itemId], contributions: [approved] } });
    render(<NodesgivingClient initial={{ ...initial, menu, mine }} />);
    fireEvent.click(screen.getAllByRole("button", { name: "Save RSVP & commitments" })[0]);
    await waitFor(() => expect(screen.getByLabelText("Your dish for Salads")).toHaveValue("Slaw"));
    fireEvent.click(screen.getAllByRole("button", { name: "Save RSVP & commitments" })[0]);
    await waitFor(() => expect(saveNodesgivingRsvp).toHaveBeenLastCalledWith(expect.objectContaining({ revision: 2, contributions: [{ itemId, dishName: "Slaw", servings: 10, coCooks: "Sam" }] })));
  });
  it("disables full dishes for someone without a reservation", () => {
    render(<NodesgivingClient initial={{ ...initial, menu: [{ id: itemId, name: "Pie", category: "Desserts", description: "", slots: 1, servings: 8, claimed: 1 }] }} />);
    fireEvent.change(screen.getByLabelText("Will you join us?"), { target: { value: "going" } });
    expect(screen.getByRole("checkbox", { name: /Pie/ })).toBeDisabled();
  });
});
