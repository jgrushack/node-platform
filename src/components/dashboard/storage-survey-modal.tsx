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
import { Input } from "@/components/ui/input";
import {
  Bike,
  Package,
  Snowflake,
  Tent,
  AlertTriangle,
  Minus,
  Plus,
  CheckCircle2,
} from "lucide-react";
import {
  submitStorageSurvey,
  updateStorageSurvey,
  type StorageItems,
} from "@/lib/actions/storage-survey";
import { STORAGE_PRICES_CENTS } from "@/lib/storage-prices";

const ITEMS = [
  { key: "bikes" as const, label: "Bike", priceCents: STORAGE_PRICES_CENTS.bike, icon: Bike, note: false, placeholder: "Describe your bike" },
  { key: "bins" as const, label: "Bin", priceCents: STORAGE_PRICES_CENTS.bin, icon: Package, note: false, placeholder: "Is it labeled with your name?" },
  { key: "acs" as const, label: "AC", priceCents: STORAGE_PRICES_CENTS.ac, icon: Snowflake, note: true, placeholder: "Labeled?" },
  { key: "shiftpods" as const, label: "Tent", priceCents: STORAGE_PRICES_CENTS.shiftpod, icon: Tent, note: false, placeholder: "e.g. Shiftpod 2, 3, X… labeled?" },
];

type Labels = Record<string, string[]>;

/** Per-unit labels are stored newline-joined in each item's `description`. */
function labelsFromInitial(initial?: StorageItems | null): Labels {
  const build = (item?: { quantity: number; description: string }) => {
    const q = item?.quantity ?? 0;
    const parts = (item?.description ?? "").split("\n");
    return Array.from({ length: q }, (_, i) => parts[i] ?? "");
  };
  return {
    bikes: build(initial?.bike),
    bins: build(initial?.bin),
    acs: build(initial?.ac),
    shiftpods: build(initial?.shiftpod),
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
  const [labels, setLabels] = useState<Labels>(() => labelsFromInitial(initialItems));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function changeQty(key: string, delta: number) {
    setLabels((prev) => {
      const arr = prev[key] || [];
      const next =
        delta > 0
          ? arr.length < 50
            ? [...arr, ""]
            : arr
          : arr.slice(0, -1);
      return { ...prev, [key]: next };
    });
  }

  function setLabel(key: string, index: number, value: string) {
    setLabels((prev) => {
      const arr = [...(prev[key] || [])];
      arr[index] = value;
      return { ...prev, [key]: arr };
    });
  }

  const totalUnits = ITEMS.reduce((s, it) => s + (labels[it.key]?.length || 0), 0);
  const totalCents = ITEMS.reduce(
    (s, it) => s + (labels[it.key]?.length || 0) * it.priceCents,
    0
  );

  // One row per unit (2x tent -> 2 rows).
  const unitRows = ITEMS.flatMap((it) =>
    (labels[it.key] || []).map((value, i) => ({
      id: `${it.key}-${i}`,
      key: it.key,
      index: i,
      label: it.label,
      showNum: (labels[it.key]?.length || 0) > 1,
      num: i + 1,
      icon: it.icon,
      priceCents: it.priceCents,
      placeholder: it.placeholder,
      value,
    }))
  );

  async function handleSubmit() {
    // Require a label on every item so storage is identifiable.
    if (totalUnits > 0 && unitRows.some((r) => r.value.trim() === "")) {
      setError("Give every item a quick label so we can find it in storage.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const line = (key: string) => ({
      quantity: labels[key]?.length || 0,
      description: (labels[key] || []).map((s) => s.trim()).join("\n"),
    });
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

  // First-timer with zero items → a clear green "nothing in storage" confirm.
  const isNothing = !isEdit && totalUnits === 0;
  const primaryLabel = isEdit
    ? totalUnits > 0
      ? "Save changes"
      : "Remove my storage items"
    : totalUnits > 0
      ? `Add $${(totalCents / 100).toFixed(2)} to balance`
      : "I have nothing in storage";

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss?.(); }}>
      <DialogContent className="border border-pink-500/15 bg-[rgba(36,3,68,0.97)] backdrop-blur-xl shadow-2xl max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sand-100">
            <Package className="h-5 w-5 text-pink-400" />
            {isEdit ? "Edit your storage" : "Storage check-in"}
          </DialogTitle>
          <DialogDescription className="text-sand-400">
            Let us know what you&apos;ve been keeping in NODE storage this past year
            (2025&ndash;2026).
          </DialogDescription>
        </DialogHeader>

        {/* Context blurb */}
        <div className="rounded-lg border border-pink-500/15 bg-pink-500/5 p-3 text-xs leading-relaxed text-sand-300">
          Last year about <strong className="text-sand-100">1.7 containers</strong> of
          NODE storage was personal camper gear, roughly a{" "}
          <strong className="text-sand-100">$7,000</strong> bill for the camp.{" "}
          <span className="text-amber-300">
            &#9889; AC units draw a lot of power on playa, so they carry a higher fee
            &mdash; consider it the power upcharge.
          </span>
        </div>

        {/* Eligibility note */}
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
          <strong className="font-semibold">Please note:</strong> this is only for
          previous campers who already have gear in NODE storage &mdash; it&apos;s{" "}
          <strong className="font-semibold">not</strong> for rentals.
        </div>

        {/* 4 even icon buttons with steppers */}
        <div className="grid grid-cols-4 gap-2">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const count = labels[item.key]?.length || 0;
            return (
              <div
                key={item.key}
                className={`flex h-full flex-col items-center justify-between gap-2 rounded-xl border p-2 text-center transition-colors ${
                  count > 0
                    ? "border-pink-500/40 bg-pink-500/10"
                    : "border-blue-900/40 bg-blue-950/30"
                }`}
              >
                <div className="flex flex-col items-center gap-1">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-500/15">
                    <Icon className="h-5 w-5 text-pink-400" />
                  </div>
                  <p className="text-xs font-medium text-sand-100">{item.label}</p>
                  <p className="whitespace-nowrap text-[10px] leading-none text-sand-400">
                    ${item.priceCents / 100}/yr
                    {item.note && <span className="text-amber-300"> &#9889;</span>}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => changeQty(item.key, -1)}
                    disabled={count === 0}
                    className="flex h-5 w-5 items-center justify-center rounded-md border border-pink-500/20 text-sand-300 transition-colors hover:bg-pink-500/15 hover:text-sand-100 disabled:opacity-30 disabled:hover:bg-transparent"
                    aria-label={`Remove one ${item.label}`}
                  >
                    <Minus className="h-2.5 w-2.5" />
                  </button>
                  <span className="w-4 text-center text-sm font-semibold tabular-nums text-sand-100">
                    {count}
                  </span>
                  <button
                    type="button"
                    onClick={() => changeQty(item.key, 1)}
                    className="flex h-5 w-5 items-center justify-center rounded-md border border-pink-500/20 text-sand-300 transition-colors hover:bg-pink-500/15 hover:text-sand-100"
                    aria-label={`Add one ${item.label}`}
                  >
                    <Plus className="h-2.5 w-2.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Per-unit labels (editable + required) + total */}
        {totalUnits > 0 && (
          <div className="space-y-2">
            <p className="text-xs text-sand-400">
              Please describe / label each item so we can give it a permanent
              label &mdash; <span className="text-amber-300">required</span>.
            </p>
            {unitRows.map((r) => {
              const Icon = r.icon;
              return (
                <div key={r.id} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 shrink-0 text-sand-400" />
                  <span className="w-12 shrink-0 text-xs text-sand-300">
                    {r.label}
                    {r.showNum ? ` ${r.num}` : ""}
                  </span>
                  <Input
                    value={r.value}
                    onChange={(e) => setLabel(r.key, r.index, e.target.value)}
                    placeholder={r.placeholder}
                    className={`h-8 flex-1 text-sm ${
                      r.value.trim() === "" ? "border-red-500/40" : ""
                    }`}
                  />
                  <span className="w-10 shrink-0 text-right text-xs text-sand-400">
                    ${r.priceCents / 100}
                  </span>
                </div>
              );
            })}
            <div className="flex items-center justify-between border-t border-white/5 pt-2 text-sand-100">
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
          className={`w-full text-white ${
            isNothing
              ? "bg-emerald-500 hover:bg-emerald-600"
              : "bg-pink-500 hover:bg-pink-600"
          }`}
          disabled={submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            "Saving…"
          ) : (
            <>
              {isNothing && <CheckCircle2 className="mr-2 h-4 w-4" />}
              {primaryLabel}
            </>
          )}
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
