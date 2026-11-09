"use client";

import Link from "next/link";
import { useState } from "react";
import { UsersRound, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getNodesgiving, saveNodesgivingRsvp, saveNodesgivingMenu, deleteNodesgivingMenu } from "@/lib/actions/nodesgiving";
import { menuCategories, type NodesgivingContributionInput, type NodesgivingData, type NodesgivingMenuInput, type NodesgivingRsvpInput } from "@/lib/types/nodesgiving";

import { ContributionSlots } from "./contribution-slots";
import { NodesgivingHero } from "./nodesgiving-hero";
import styles from "./nodesgiving.module.css";

const panel = `${styles.panel} p-5 sm:p-6`;
const blankDish: NodesgivingMenuInput = { id: null, name: "", category: "Sides", description: "", slots: 1, servings: 8 };
const labels = { going: "Yes, I’m coming", declined: "No, I can’t make it" };
const selectStyle = "w-full rounded-md border border-pink-500/20 bg-background p-2 text-sm";

export function NodesgivingClient({ initial }: { initial: NodesgivingData }) {
  const [data, setData] = useState(initial);
  const [status, setStatus] = useState<NodesgivingRsvpInput["status"] | "">(initial.mine?.status === "needs_response" ? "" : initial.mine?.status ?? "");
  const [hasGuest, setHasGuest] = useState(initial.mine?.has_guest ?? false);
  const [guestName, setGuestName] = useState(initial.mine?.guest_name ?? "");
  const [guestDietaryNotes, setGuestDietaryNotes] = useState(initial.mine?.guest_dietary_notes ?? "");
  const [selected, setSelected] = useState<NodesgivingContributionInput[]>((initial.mine?.contributions ?? []).map(c => ({ itemId: c.item_id, dishName: c.dish_name, servings: c.servings, coCooks: c.co_cooks })));
  const [dish, setDish] = useState<NodesgivingMenuInput>(blankDish);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState("");
  const counts = data.counts;
  const claimed = data.menu.reduce((sum, item) => sum + item.claimed, 0);
  const slots = data.menu.reduce((sum, item) => sum + item.slots, 0);

  async function run(action: () => Promise<{ error: string } | { success: true }>, message: string, after?: () => void) {
    setBusy(true);
    setFeedback("");
    try {
      const result = await action();
      if ("error" in result) {
        setFeedback(result.error);
        toast.error(result.error);
      } else {
        setFeedback(message);
        toast.success(message);
        after?.();
      }
      // Refresh capacities after a conflict too, preserving unsaved form choices.
      const fresh = await getNodesgiving();
      if (!("error" in fresh)) {
        setData(fresh);
        if (fresh.mine?.revision !== data.mine?.revision) {
          setSelected((fresh.mine?.contributions ?? []).map(c => ({ itemId: c.item_id, dishName: c.dish_name, servings: c.servings, coCooks: c.co_cooks })));
          setStatus(fresh.mine?.status === "needs_response" ? "" : fresh.mine?.status ?? "");
          setHasGuest(fresh.mine?.has_guest ?? false);
          setGuestName(fresh.mine?.guest_name ?? "");
          setGuestDietaryNotes(fresh.mine?.guest_dietary_notes ?? "");
        } else setSelected(prev => prev.filter(c => fresh.menu.some(item => item.id === c.itemId)));
      }
      else setFeedback(`${"error" in result ? result.error : message} Could not refresh the menu. Reload before making more changes.`);
    } catch {
      setFeedback("Could not confirm your changes. Please reload to check your saved response before trying again.");
    } finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 text-sand-100">
      <NodesgivingHero title={data.event.title} date={data.event.event_date} location={data.event.location} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[ ["Confirmed people", counts.going + counts.guests], ["Guests included", counts.guests], ["Can’t make it", counts.declined], ["Menu slots filled", `${claimed} / ${slots}`] ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-[#e7b3ec]/15 bg-[#b77c9c]/[.05] p-4"><p className="text-2xl font-semibold text-[#f6c5a5]">{value}</p><p className="mt-1 text-sm text-sand-400">{label}</p></div>
        ))}
      </div>

      <form onSubmit={e => { e.preventDefault(); if (status) void run(() => saveNodesgivingRsvp({ status, hasGuest: status === "going" && hasGuest, guestName: status === "going" && hasGuest ? guestName : "", guestDietaryNotes: status === "going" && hasGuest ? guestDietaryNotes : "", revision: data.mine?.revision ?? 0, contributions: status === "going" ? selected : [] }), "Your RSVP and food commitments are saved.", () => { if (status !== "going") { setSelected([]); setHasGuest(false); setGuestName(""); setGuestDietaryNotes(""); } }); }}>
        <fieldset disabled={busy} className="grid gap-6 lg:grid-cols-[320px_1fr]">
          <section className={`${panel} h-fit space-y-5`} aria-labelledby="rsvp-heading">
            <h2 id="rsvp-heading" tabIndex={-1} className="scroll-mt-6 flex items-center gap-2 text-xl font-semibold"><UsersRound className="h-5 w-5 text-pink-400" /> Your seat at the table</h2>
            <label className="block space-y-2 text-sm"><span>Will you join us?</span>
              <select required value={status} onChange={e => setStatus(e.target.value as typeof status)} className={selectStyle}>
                <option value="" disabled>Choose your response</option>
                {Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            {status === "going" && <>
              <label className="flex items-center gap-3 text-sm"><input type="checkbox" checked={hasGuest} onChange={e => setHasGuest(e.target.checked)} className="h-4 w-4 accent-pink-500" /> I’m bringing one guest (+1)</label>
              <p className="text-xs text-sand-300">Your +1 should be a partner or potential NODE member. This isn’t an open invitation.</p>
              {hasGuest && <label className="block space-y-2 text-sm"><span>Guest’s name (optional)</span><Input maxLength={100} value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="You can add their name later" /></label>}
            </>}
            <div className="space-y-2 rounded-lg bg-pink-500/5 p-3 text-sm">
              <p className="font-medium">Your dietary needs</p>
              <p className="whitespace-pre-wrap text-sand-300">{data.profileDietaryNotes || "No dietary needs listed in your NODE profile."}</p>
              <p className="text-xs text-sand-400">The hosts use your NODE profile for dietary needs and allergies.</p>
              <Link href="/dashboard/profile" className="inline-block text-pink-300 underline underline-offset-4">Update your NODE profile</Link>
            </div>
            {status === "going" && hasGuest && <label className="block space-y-2 text-sm">
              <span>Guest’s dietary needs / allergies (optional)</span>
              <Textarea value={guestDietaryNotes} maxLength={1000} onChange={e => setGuestDietaryNotes(e.target.value)} placeholder="Anything we should know about your guest?" />
              <span className="text-xs text-sand-400">Only you and the hosts can see these notes.</span>
            </label>}
            {status && status !== "going" && (data.mine?.item_ids.length ?? 0) > 0 && <p className="text-sm text-amber-300">Saving this response will release your dishes for someone else to bring.</p>}
            <Button type="submit" disabled={busy || !status} className="w-full rounded-full bg-[#f8c7a5] text-[#321b35] hover:bg-[#ffe3cb]">{busy ? "Saving…" : "Save RSVP & commitments"}</Button>
            <p className="text-xs text-sand-400">{data.mine?.status === "needs_response" ? "Please choose yes or no to confirm your response." : data.mine ? `Saved response: ${labels[data.mine.status]}.` : "You haven’t RSVP’d yet."} Changes take effect when you save.</p>
          </section>

          <section className={`${panel} space-y-5`} aria-labelledby="menu-heading">
            <div><h2 id="menu-heading" className="flex items-center gap-2 text-xl font-semibold"><UtensilsCrossed className="h-5 w-5 text-pink-400" /> Build the feast</h2><p className="mt-2 text-sm text-sand-400">Choose an open spot and tell us what you’re bringing. The recipes are up to you—pick the closest fit for your dish. You can change your dish, servings, or co-cooks here anytime and save. No approval needed. Check what others are bringing to avoid repeats.</p></div>
            {status !== "going" && <p className="rounded-lg bg-pink-500/10 p-3 text-sm text-pink-300">Choose “Yes, I’m coming” to sign up for dishes.</p>}
            {data.menu.length === 0 && <div className="rounded-xl border border-dashed border-pink-500/20 p-6"><p className="font-medium">The menu is coming together.</p><p className="mt-2 text-sm text-sand-400">You can RSVP now and come back to choose a dish once the hosts add the menu.</p></div>}
            <ContributionSlots data={data} selected={selected} enabled={status === "going"} onChange={setSelected} />
            {data.menu.length > 0 && <Button type="submit" disabled={busy || !status} className="rounded-full bg-[#f8c7a5] text-[#321b35] hover:bg-[#ffe3cb]">{busy ? "Saving…" : "Save RSVP & commitments"}</Button>}
          </section>
        </fieldset>
      </form>
      <p role="status" aria-live="polite" className="text-sm text-pink-300">{feedback}</p>


      {data.isAdmin && <>
        <section className={`${panel} space-y-5`} aria-labelledby="host-menu-heading">
          <div><h2 id="host-menu-heading" className="text-xl font-semibold">Host tools · Manage menu slots</h2><p className="mt-2 text-sm text-sand-400">Set the categories, signup limits, and suggested servings. Members choose their recipes. Claimed slots can only have their signup limit changed.</p></div>
          <form onSubmit={e => { e.preventDefault(); void run(() => saveNodesgivingMenu(dish), "Menu saved.", () => setDish(blankDish)); }}>
            <fieldset disabled={busy} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <label className="space-y-2 text-sm sm:col-span-2"><span>Slot name</span><Input required maxLength={150} value={dish.name} onChange={e => setDish({ ...dish, name: e.target.value })} placeholder="e.g. Vegetables" /></label>
              <label className="space-y-2 text-sm"><span>Category</span><select className={selectStyle} value={dish.category} onChange={e => setDish({ ...dish, category: e.target.value as NodesgivingMenuInput["category"] })}>{menuCategories.map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="space-y-2 text-sm"><span>Signup limit</span><Input type="number" required min={1} max={100} value={dish.slots} onChange={e => setDish({ ...dish, slots: Number(e.target.value) })} /></label>
              <label className="space-y-2 text-sm"><span>Suggested servings per signup</span><Input type="number" required min={1} max={200} value={dish.servings} onChange={e => setDish({ ...dish, servings: Number(e.target.value) })} /></label>
              <label className="space-y-2 text-sm sm:col-span-2"><span>Instructions / dietary details</span><Input maxLength={500} value={dish.description} onChange={e => setDish({ ...dish, description: e.target.value })} placeholder="Portion size, vegetarian option, serving utensils…" /></label>
              <div className="flex items-end gap-2"><Button type="submit">{dish.id ? "Save slot" : "Add slot"}</Button>{dish.id && <Button type="button" variant="ghost" onClick={() => setDish(blankDish)}>Cancel</Button>}</div>
            </fieldset>
          </form>
          <div className="divide-y divide-pink-500/10">{data.menu.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><span className="text-sm">{item.name} <span className="text-sand-400">· {item.claimed}/{item.slots} filled</span></span><div className="flex gap-2"><Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setDish({ id: item.id, name: item.name, category: item.category, description: item.description, slots: item.slots, servings: item.servings })}>Edit</Button><Button type="button" size="sm" variant="ghost" disabled={busy || item.claimed > 0} onClick={() => { void run(() => deleteNodesgivingMenu(item.id), "Dish removed.", () => { if (dish.id === item.id) setDish(blankDish); }); }}>Remove</Button></div></div>)}</div>
        </section>
        <section className={`${panel} space-y-4`} aria-labelledby="guest-list-heading">
          <h2 id="guest-list-heading" className="text-xl font-semibold">Host tools · Who’s coming & what they’re bringing</h2>
          <p className="text-sm text-sand-400">{counts.going} members + {counts.guests} guests confirmed · {counts.declined} declined{counts.needs_response > 0 ? ` · ${counts.needs_response} awaiting a yes/no response` : ""}</p>
          {data.attendees.length === 0 ? <p className="text-sand-400">No responses yet.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-pink-500/20">{["Member", "RSVP", "Guest", "Bringing", "Member dietary needs (profile)", "Guest dietary needs"].map(h => <th key={h} scope="col" className="p-3 font-medium text-sand-400">{h}</th>)}</tr></thead><tbody>{data.attendees.map(person => <tr key={person.profile_id} className="border-b border-pink-500/10 align-top"><td className="p-3">{person.name}</td><td className="p-3">{person.status === "needs_response" ? "Needs response" : labels[person.status]}</td><td className="p-3">{person.has_guest ? person.guest_name || "+1 · name to come" : "—"}</td><td className="p-3">{person.contributions.length ? person.contributions.map(c => `${c.dish_name} (${c.servings} servings${c.co_cooks ? `, with ${c.co_cooks}` : ""})`).join("; ") : person.status === "going" ? "No dish selected yet" : "—"}</td><td className="whitespace-pre-wrap p-3">{person.profile_dietary_notes || "None listed"}{person.dietary_notes && <p className="mt-2 text-xs text-amber-300">Earlier RSVP notes (confirm with member): {person.dietary_notes}</p>}</td><td className="whitespace-pre-wrap p-3">{person.has_guest ? person.guest_dietary_notes || "None listed" : "—"}</td></tr>)}</tbody></table></div>}
        </section>
      </>}
    </div>
  );
}
