import { Carrot, CakeSlice, Salad, Drumstick, Wine, PartyPopper } from "lucide-react";
import styles from "./nodesgiving.module.css";
import { Input } from "@/components/ui/input";
import { menuCategories, type NodesgivingContributionInput, type NodesgivingData } from "@/lib/types/nodesgiving";

const categoryIcons = { Mains: Drumstick, Sides: Carrot, Salads: Salad, Desserts: CakeSlice, Drinks: Wine, Supplies: PartyPopper };

type Props = {
  data: NodesgivingData;
  selected: NodesgivingContributionInput[];
  enabled: boolean;
  onChange: (items: NodesgivingContributionInput[]) => void;
};

export function ContributionSlots({ data, selected, enabled, onChange }: Props) {
  function update(itemId: string, patch: Partial<NodesgivingContributionInput>) {
    onChange(selected.map(c => c.itemId === itemId ? { ...c, ...patch } : c));
  }
  return menuCategories.map(category => {
    const items = data.menu.filter(item => item.category === category);
    if (!items.length) return null;
    const Icon = categoryIcons[category];
    return (
      <div key={category} className="space-y-3">
        <h3 className="flex items-center gap-2 font-sans text-sm font-semibold text-[#eac5f2]"><span className="rounded-full bg-[#c792d9]/15 p-2"><Icon aria-hidden="true" className="h-4 w-4" /></span>{category}</h3>
        <div className={styles.slotGrid}>
        {items.map(item => {
          const choice = selected.find(c => c.itemId === item.id);
          const claimed = data.commitments.filter(c => c.item_id === item.id);
          const full = item.claimed >= item.slots && !data.mine?.item_ids.includes(item.id);
          return (
            <div key={item.id} className={`min-w-0 space-y-3 rounded-2xl border p-4 transition-colors ${choice && enabled ? "border-[#e6b4f4]/60 bg-[#bd79c7]/15" : "border-[#e7b3ec]/15 bg-[#f4bc94]/[.04] hover:border-[#e7b3ec]/35"}`}>
              <label className="flex items-start gap-3">
                <input type="checkbox" checked={!!choice && enabled} disabled={!enabled || (full && !choice)}
                  onChange={e => onChange(e.target.checked
                    ? [...selected, { itemId: item.id, dishName: "", servings: item.servings, coCooks: "" }]
                    : selected.filter(c => c.itemId !== item.id))}
                  className="mt-1 h-4 w-4 shrink-0 accent-pink-500" />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap justify-between gap-2"><span className="font-medium">{item.name}</span><span className="rounded-full bg-[#ead1f0]/10 px-2 py-1 text-xs text-[#e1c8dc]">{item.claimed}/{item.slots} committed{full ? " · Full" : ""}</span></span>
                  <span className="mt-1 block text-xs text-sand-400">Aim for {item.servings} servings per signup</span>
                  {item.description && <span className="mt-2 block text-sm text-sand-300">{item.description}</span>}
                </span>
              </label>
              {claimed.length > 0 && <ul aria-label={`${item.name} commitments`} className="space-y-2 rounded-lg bg-background/40 p-3 text-sm">
                {claimed.map((c, i) => <li key={i}><span className="font-medium">{c.dish_name}</span> · {c.servings} servings<span className="block text-xs text-sand-400">{c.member_name}{c.co_cooks ? ` with ${c.co_cooks}` : ""}{c.is_mine ? " · Your saved dish" : ""}</span></li>)}
              </ul>}
              {choice && enabled && <div className="grid gap-3 border-t border-pink-500/15 pt-3 sm:grid-cols-2">
                {data.mine?.item_ids.includes(item.id) && <p className="text-sm text-pink-200 sm:col-span-2">Edit your saved dish below, then save your changes.</p>}
                <label className="space-y-1 text-sm sm:col-span-2"><span>Your dish for {item.name}</span><Input required maxLength={150} value={choice.dishName} onChange={e => update(item.id, { dishName: e.target.value })} placeholder="Name your recipe so others can choose something different" /></label>
                <label className="space-y-1 text-sm"><span>Servings for {item.name}</span><Input required type="number" min={1} max={200} value={choice.servings} onChange={e => update(item.id, { servings: Number(e.target.value) })} /></label>
                <label className="space-y-1 text-sm"><span>Making {item.name} with (optional)</span><Input maxLength={150} value={choice.coCooks} onChange={e => update(item.id, { coCooks: e.target.value })} placeholder="Your guest or other members" /></label>
                <p className="text-xs text-sand-400 sm:col-span-2">Your name, dish, serving quantity, and co-cooks are visible to signed-in members.</p>
              </div>}
            </div>
          );
        })}
        </div>
      </div>
    );
  });
}
