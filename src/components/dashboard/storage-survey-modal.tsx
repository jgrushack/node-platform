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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Bike, Package, Snowflake, Tent, AlertTriangle } from "lucide-react";
import {
  submitStorageSurvey,
  updateStorageSurvey,
  STORAGE_PRICES_CENTS,
  type StorageItems,
} from "@/lib/actions/storage-survey";

type Step = "ask" | "items";

const ITEMS = [
  {
    key: "bikes" as const,
    label: "Bike",
    priceCents: STORAGE_PRICES_CENTS.bike,
    icon: Bike,
    placeholder: "e.g. blue cruiser with white basket",
  },
  {
    key: "bins" as const,
    label: "Black & yellow storage bin",
    priceCents: STORAGE_PRICES_CENTS.bin,
    icon: Package,
    placeholder: "e.g. 2 bins labeled JG-1, JG-2",
  },
  {
    key: "acs" as const,
    label: "AC unit",
    priceCents: STORAGE_PRICES_CENTS.ac,
    icon: Snowflake,
    placeholder: "e.g. 8000 BTU window unit, gray",
  },
  {
    key: "shiftpods" as const,
    label: "Shiftpod / Tent",
    priceCents: STORAGE_PRICES_CENTS.shiftpod,
    icon: Tent,
    placeholder: "e.g. 8-person Shiftpod, tan",
  },
];

type ItemState = { quantity: number; description: string };

function itemsFromInitial(initial?: StorageItems | null): Record<string, ItemState> {
  return {
    bikes: { quantity: initial?.bike.quantity ?? 0, description: initial?.bike.description ?? "" },
    bins: { quantity: initial?.bin.quantity ?? 0, description: initial?.bin.description ?? "" },
    acs: { quantity: initial?.ac.quantity ?? 0, description: initial?.ac.description ?? "" },
    shiftpods: {
      quantity: initial?.shiftpod.quantity ?? 0,
      description: initial?.shiftpod.description ?? "",
    },
  };
}

interface Props {
  open: boolean;
  /** "initial" = first-time survey (charge); "edit" = revisit an existing answer. */
  mode?: "initial" | "edit";
  /** Pre-fill values for edit mode. */
  initialItems?: StorageItems | null;
  onSubmitted: (chargeCents: number) => void;
  /** Close without submitting. Initial: "Maybe later". Edit: "Cancel". Also fires on
   *  Esc / outside-click / the X button so the modal never hard-traps the user. */
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
  const [step, setStep] = useState<Step>(isEdit ? "items" : "ask");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<Record<string, ItemState>>(() =>
    itemsFromInitial(initialItems)
  );

  // Note: callers remount this modal via a `key` tied to `open`, so the
  // useState initializers above re-read `initialItems`/`mode` on each open —
  // no reset effect needed.

  function updateItem(key: string, patch: Partial<ItemState>) {
    setItems((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }));
  }

  const totalCents = ITEMS.reduce(
    (sum, item) => sum + (items[item.key]?.quantity || 0) * item.priceCents,
    0
  );
  const totalUnits = ITEMS.reduce(
    (sum, item) => sum + (items[item.key]?.quantity || 0),
    0
  );

  function buildPayload(hasItems: boolean) {
    return {
      hasItems,
      bikes: items.bikes,
      bins: items.bins,
      acs: items.acs,
      shiftpods: items.shiftpods,
    };
  }

  async function runSubmit(hasItems: boolean) {
    setSubmitting(true);
    setError(null);
    const payload = buildPayload(hasItems);
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

  async function handleSubmitNo() {
    await runSubmit(false);
  }

  async function handleSubmitItems() {
    // Initial mode requires at least one item; edit mode allows zero (which
    // removes the storage charge).
    if (!isEdit && totalUnits === 0) {
      setError("Add at least one item, or go back and answer No.");
      return;
    }
    await runSubmit(totalUnits > 0);
  }

  const primaryLabel = isEdit
    ? totalUnits > 0
      ? "Save changes"
      : "Remove my storage items"
    : `Add $${(totalCents / 100).toFixed(2)} to balance`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss?.(); }}>
      <DialogContent className="glass border-pink-500/10 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sand-100">
            <Package className="h-5 w-5 text-pink-400" />
            {isEdit ? "Edit your storage" : "Storage check-in"}
          </DialogTitle>
          <DialogDescription className="text-sand-400">
            {isEdit
              ? "Update the items you're keeping in NODE storage. Your balance will be adjusted."
              : "We're sorting out who's keeping items in NODE storage from last year. Quick answer required."}
          </DialogDescription>
        </DialogHeader>

        {step === "ask" && (
          <div className="space-y-4">
            <p className="text-sm text-sand-200">
              Are you keeping anything in Storage?
            </p>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Any unclaimed items in NODE storage become property of NODE.
              </span>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                disabled={submitting}
                onClick={handleSubmitNo}
              >
                {submitting ? "Saving…" : "No, nothing"}
              </Button>
              <Button
                className="flex-1 bg-pink-500 text-white hover:bg-pink-600"
                disabled={submitting}
                onClick={() => {
                  setError(null);
                  setStep("items");
                }}
              >
                Yes, I have items
              </Button>
            </div>
          </div>
        )}

        {step === "items" && (
          <div className="space-y-4">
            <p className="text-sm text-sand-300">
              {isEdit
                ? "Update how many of each you're storing. Set all to zero to remove your storage charge."
                : "Tell us how many of each. Annual fees will be added to your balance."}
            </p>

            <div className="space-y-4">
              {ITEMS.map((item) => {
                const state = items[item.key];
                const Icon = item.icon;
                return (
                  <div
                    key={item.key}
                    className="rounded-lg border border-blue-900/40 bg-blue-950/30 p-3 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sand-100">
                        <Icon className="h-4 w-4 text-pink-400" />
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <span className="text-xs text-sand-400">
                        ${item.priceCents / 100} each
                      </span>
                    </div>
                    <div className="grid grid-cols-[auto_1fr] gap-2 items-start">
                      <div>
                        <Label
                          htmlFor={`qty-${item.key}`}
                          className="text-xs text-sand-400 mb-1 block"
                        >
                          Qty
                        </Label>
                        <Input
                          id={`qty-${item.key}`}
                          type="number"
                          min={0}
                          max={50}
                          className="w-20"
                          value={state.quantity}
                          onChange={(e) =>
                            updateItem(item.key, {
                              quantity: Math.max(
                                0,
                                Math.min(50, parseInt(e.target.value) || 0)
                              ),
                            })
                          }
                        />
                      </div>
                      <div>
                        <Label
                          htmlFor={`desc-${item.key}`}
                          className="text-xs text-sand-400 mb-1 block"
                        >
                          Description
                        </Label>
                        <Textarea
                          id={`desc-${item.key}`}
                          rows={2}
                          placeholder={item.placeholder}
                          value={state.description}
                          onChange={(e) =>
                            updateItem(item.key, {
                              description: e.target.value,
                            })
                          }
                          disabled={state.quantity === 0}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200 flex gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                Any unclaimed items in NODE storage become property of NODE.
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 text-sand-100">
              <span className="text-sm text-sand-400">Total</span>
              <span className="text-lg font-semibold">
                ${(totalCents / 100).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                })}
              </span>
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <div className="flex gap-2 pt-1">
              {!isEdit && (
                <Button
                  variant="ghost"
                  className="text-sand-400"
                  disabled={submitting}
                  onClick={() => {
                    setError(null);
                    setStep("ask");
                  }}
                >
                  Back
                </Button>
              )}
              <Button
                className="flex-1 bg-pink-500 text-white hover:bg-pink-600"
                disabled={submitting || (!isEdit && totalUnits === 0)}
                onClick={handleSubmitItems}
              >
                {submitting ? "Saving…" : primaryLabel}
              </Button>
            </div>
          </div>
        )}

        {/* Always offer a way out so the modal never hard-traps the user. */}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="mt-2 w-full text-center text-xs text-sand-500 underline hover:text-sand-300"
          >
            {isEdit ? "Cancel" : "Maybe later"}
          </button>
        )}
      </DialogContent>
    </Dialog>
  );
}
