"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Bike,
  Package,
  Snowflake,
  Tent,
  AlertTriangle,
  Minus,
  Plus,
} from "lucide-react";
import {
  submitStorageSurvey,
  updateStorageSurvey,
  type StorageItems,
} from "@/lib/actions/storage-survey";
import { STORAGE_PRICES_CENTS } from "@/lib/storage-prices";

const ITEMS = [
  { key: "bikes" as const, label: "Bike", priceCents: STORAGE_PRICES_CENTS.bike, icon: Bike, note: null as string | null },
  { key: "bins" as const, label: "Storage bin", priceCents: STORAGE_PRICES_CENTS.bin, icon: Package, note: null },
  { key: "acs" as const, label: "AC unit", priceCents: STORAGE_PRICES_CENTS.ac, icon: Snowflake, note: "⚡ power upcharge" },
  { key: "shiftpods" as const, label: "Shiftpod / Tent", priceCents: STORAGE_PRICES_CENTS.shiftpod, icon: Tent, note: null },
];

type QtyMap = Record<string, number>;

function qtyFromInitial(initial?: StorageItems | null): QtyMap {
  return {
    bikes: initial?.bike.quantity ?? 0,
    bins: initial?.bin.quantity ?? 0,
    acs: initial?.ac.quantity ?? 0,
    shiftpods: initial?.shiftpod.quantity ?? 0,
  };
}

interface Props {
  open: boolean;
  /** "initial" = first-time survey; "edit" = revisit an existing answer. */
  mode?: "initial" | "edit";
  initialItems?: StorageItems | null;
  onSubmitted: (chargeCents: number) => void;
  /** Close without submitting (Esc / outside-click / X / link). */
  onDismiss?: () => void;
}

export function StorageSurveyModal({
  open,
  mode = "initial",
  initialItems,
  onSubmitted,
  onDismiss,
}: Props) {
  const isEdit = mode === "edit";
  // Callers remount via a `key` tied to `open`, so this re-reads initialItems.
  const [qty, setQty] = useState<QtyMap>(() => qtyFromInitial(initialItems));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateQty(key: string, delta: number) {
    setQty((prev) => ({
      ...prev,
      [key]: Math.max(0, Math.min(50, (prev[key] || 0) + delta)),
    }));
  }

  const totalUnits = ITEMS.reduce((s, it) => s + (qty[it.key] || 0), 0);
  const totalCents = ITEMS.reduce((s, it) => s + (qty[it.key] || 0) * it.priceCents, 0);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const line = (key: string) => ({ quantity: qty[key] || 0, description: "" });
    const payload = {
      hasItems: totalUnits > 0,
      bikes: line("bikes"),
      bins: line("bins"),
      acs: line("acs"),
      shiftpods: line("shiftpods"),
    };
    const res = isEdit
      ? await updateStorageSurvey(payload)
      : await submitStorageSurvey(payload);
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    onSubmitted(res.chargeCents);
  }

  const primaryLabel = isEdit
    ? totalUnits > 0
      ? "Save changes"
      : "Remove my storage items"
    : totalUnits > 0
      ? `Add $${(totalCents / 100).toFixed(2)} to balance`
      : "I'm not storing anything";

  // One read-only line per unit (2x tent -> 2 lines).
  const unitLines = ITEMS.flatMap((it) =>
    Array.from({ length: qty[it.key] || 0 }, (_, i) => ({
      id: `${it.key}-${i}`,
      label: it.label,
      icon: it.icon,
      priceCents: it.priceCents,
    }))
  );

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss?.(); }}>
      <DialogContent className="border border-pink-500/15 bg-[rgba(36,3,68,0.97)] backdrop-blur-xl shadow-2xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sand-100">
            <Package className="h-5 w-5 text-pink-400" />
            {isEdit ? "Edit your storage" : "Storage check-in"}
          </DialogTitle>
          <DialogDescription className="text-sand-400">
            Let us know what you&apos;re keeping in NODE storage this year.
          </DialogDescription>
        </DialogHeader>

        {/* Context blurb */}
        <div className="rounded-lg border border-pink-500/15 bg-pink-500/5 p-3 text-xs leading-relaxed text-sand-300">
          Last year about <strong className="text-sand-100">1.7 containers</strong> of
          NODE storage was personal camper gear &mdash; roughly a{" "}
          <strong className="text-sand-100">$7,200</strong> bill for the camp. If we can
          leave a container in Gerlach, we could cut about{" "}
          <strong className="text-sand-100">$1,700</strong> off that starting next year,
          so the per-item fees below help cover it.{" "}
          <span className="text-amber-300">
            &#9889; AC units draw a lot of power on playa, so they carry a higher fee
            &mdash; consider it the power upcharge.
          </span>
        </div>

        {/* Item tiles with steppers */}
        <div className="space-y-2">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const count = qty[item.key] || 0;
            return (
              <div
                key={item.key}
                className="flex items-center justify-between rounded-lg border border-blue-900/40 bg-blue-950/30 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-pink-500/15">
                    <Icon className="h-5 w-5 text-pink-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-sand-100">{item.label}</p>
                    <p className="text-xs text-sand-400">
                      ${item.priceCents / 100}/yr
                      {item.note && (
                        <span className="text-amber-300"> &middot; {item.note}</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => updateQty(item.key, -1)}
                    disabled={count === 0}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-pink-500/20 text-sand-300 transition-colors hover:bg-pink-500/15 hover:text-sand-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label={`Remove one ${item.label}`}
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-semibold tabular-nums text-sand-100">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => updateQty(item.key, 1)}
                    className="flex h-7 w-7 items-center justify-center rounded-md border border-pink-500/20 text-sand-300 transition-colors hover:bg-pink-500/15 hover:text-sand-100"
                    aria-label={`Add one ${item.label}`}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Read-only per-unit summary + total */}
        {totalUnits > 0 && (
          <div className="rounded-lg border border-blue-900/40 bg-blue-950/20 p-3">
            <ul className="space-y-1.5">
              {unitLines.map((u) => {
                const Icon = u.icon;
                return (
                  <li key={u.id} className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 text-sand-200">
                      <Icon className="h-3.5 w-3.5 text-sand-400" />
                      {u.label}
                    </span>
                    <span className="text-sand-400">${u.priceCents / 100}</span>
                  </li>
                );
              })}
            </ul>
            <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-2 text-sand-100">
              <span className="text-sm font-medium text-sand-400">Total / year</span>
              <span className="text-lg font-semibold">
                ${(totalCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Property warning */}
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Any unclaimed / unpaid items in NODE storage become property of NODE at the
            beginning of the 2026 Burn.
          </span>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button
          className="w-full bg-pink-500 text-white hover:bg-pink-600"
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? "Saving…" : primaryLabel}
        </Button>

        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full text-center text-xs text-sand-500 underline hover:text-sand-300"
          >
            {isEdit ? "Cancel" : "Maybe later"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
