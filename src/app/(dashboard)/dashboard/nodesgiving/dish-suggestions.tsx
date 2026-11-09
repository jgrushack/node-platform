import styles from "./nodesgiving.module.css";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { suggestNodesgivingDish, reviewNodesgivingSuggestion, withdrawNodesgivingSuggestion } from "@/lib/actions/nodesgiving";
import { menuCategories, type NodesgivingData, type NodesgivingSuggestion, type NodesgivingSuggestionInput } from "@/lib/types/nodesgiving";

type Run = (action: () => Promise<{ error: string } | { success: true }>, message: string, after?: () => void) => Promise<void>;
const selectStyle = "w-full rounded-md border border-pink-500/20 bg-background p-2 text-sm";
const blank: NodesgivingSuggestionInput = { dishName: "", category: "Sides", servings: 10, coCooks: "", notes: "" };

export function DishSuggestions({ data, busy, run }: { data: NodesgivingData; busy: boolean; run: Run }) {
  const [suggestion, setSuggestion] = useState(blank);
  const own = data.suggestions.filter(s => s.is_mine);
  const pending = own.some(s => s.status === "pending");
  return (
    <section className={`${styles.panel} space-y-4 p-5 sm:p-6`}>
      <h2 className="text-xl font-semibold">Got a signature dish?</h2>
      <p className="text-sm text-sand-400">Suggest it here. Hosts will fit approved ideas into the menu’s existing limits. A suggestion is not a commitment until approved.</p>
      {data.mine?.status !== "going" ? <p className="text-sm text-pink-300">Save a yes RSVP before sending a suggestion.</p> : !pending && <form onSubmit={e => { e.preventDefault(); void run(() => suggestNodesgivingDish(suggestion), "Suggestion sent to the hosts.", () => setSuggestion(blank)); }}>
        <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>Suggested dish</span><Input required maxLength={150} value={suggestion.dishName} onChange={e => setSuggestion({ ...suggestion, dishName: e.target.value })} /></label>
          <label className="space-y-1 text-sm"><span>Suggested category</span><select className={selectStyle} value={suggestion.category} onChange={e => setSuggestion({ ...suggestion, category: e.target.value as typeof suggestion.category })}>{menuCategories.map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="space-y-1 text-sm"><span>Suggested servings</span><Input required type="number" min={1} max={200} value={suggestion.servings} onChange={e => setSuggestion({ ...suggestion, servings: Number(e.target.value) })} /></label>
          <label className="space-y-1 text-sm"><span>Co-cooks (optional)</span><Input maxLength={150} value={suggestion.coCooks} onChange={e => setSuggestion({ ...suggestion, coCooks: e.target.value })} /></label>
          <label className="space-y-1 text-sm sm:col-span-2"><span>Note to the hosts (optional)</span><Textarea maxLength={500} value={suggestion.notes} onChange={e => setSuggestion({ ...suggestion, notes: e.target.value })} /></label>
          <Button type="submit" className="w-fit">Suggest dish</Button>
        </fieldset>
      </form>}
      {own.length > 0 && <ul className="space-y-2">{own.map(s => <li key={s.id} className="rounded-lg border border-pink-500/15 p-3 text-sm">
        <p><strong>{s.dish_name}</strong> · {s.servings} servings · <span className="capitalize">{s.status}</span></p>
        {s.host_note && <p className="mt-1 text-sand-300">Host note: {s.host_note}</p>}
        {s.status === "approved" && <p className="mt-1 text-sand-400">See your saved commitments above for its current status. You can edit or release it there.</p>}
        {s.status === "pending" && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { void run(() => withdrawNodesgivingSuggestion(s.id), "Suggestion withdrawn."); }}>Withdraw suggestion</Button>}
      </li>)}</ul>}
      {data.isAdmin && <div className="space-y-3 border-t border-pink-500/15 pt-4">
        <h3 className="font-semibold">Host tools · Review suggestions</h3>
        {data.suggestions.filter(s => s.status === "pending").length === 0 && <p className="text-sm text-sand-400">No pending suggestions.</p>}
        {data.suggestions.filter(s => s.status === "pending").map(s => <SuggestionReview key={s.id} suggestion={s} data={data} busy={busy} run={run} />)}
      </div>}
    </section>
  );
}

function SuggestionReview({ suggestion: s, data, busy, run }: { suggestion: NodesgivingSuggestion; data: NodesgivingData; busy: boolean; run: Run }) {
  const [itemId, setItemId] = useState("");
  const [hostNote, setHostNote] = useState("");
  const matches = data.menu.filter(m => m.category === s.category);
  return <div className="space-y-3 rounded-xl border border-pink-500/15 p-4">
    <p className="text-sm"><strong>{s.dish_name}</strong> · {s.category} · {s.servings} servings</p>
    <p className="text-sm text-sand-400">{s.member_name}{s.co_cooks ? ` with ${s.co_cooks}` : ""}</p>
    {s.notes && <p className="whitespace-pre-wrap text-sm">{s.notes}</p>}
    <label className="block space-y-1 text-sm"><span>Menu slot for {s.dish_name}</span><select disabled={busy} className={selectStyle} value={itemId} onChange={e => setItemId(e.target.value)}>
      <option value="">Choose a slot</option>{matches.map(m => <option key={m.id} value={m.id} disabled={m.claimed >= m.slots}>{m.name} · {m.slots - m.claimed} available</option>)}
    </select></label>
    <p className="text-xs text-sand-400">Approval uses one available slot. Adjust the menu first if you want to make room.</p>
    <label className="block space-y-1 text-sm"><span>Host note for {s.dish_name} (optional)</span><Input disabled={busy} maxLength={500} value={hostNote} onChange={e => setHostNote(e.target.value)} /></label>
    <div className="flex gap-2"><Button type="button" disabled={busy || !itemId} onClick={() => { void run(() => reviewNodesgivingSuggestion({ id: s.id, decision: "approved", itemId, hostNote }), "Dish approved and added to their commitments."); }}>Approve dish</Button>
      <Button type="button" variant="outline" disabled={busy} onClick={() => { void run(() => reviewNodesgivingSuggestion({ id: s.id, decision: "declined", itemId: null, hostNote }), "Suggestion declined."); }}>Decline suggestion</Button></div>
  </div>;
}
