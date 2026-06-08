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
import { Label } from "@/components/ui/label";
import { CalendarCheck, Loader2 } from "lucide-react";
import { updateArrivalDates } from "@/lib/actions/registrations";

// Burning Man 2026 runs Aug 30 – Sep 7; build crews arrive from ~Aug 23.
const MIN_DATE = "2026-08-20";
const MAX_DATE = "2026-09-10";

interface Props {
  open: boolean;
  initialArrival?: string | null;
  initialDeparture?: string | null;
  onSaved: (arrival: string | null, departure: string | null) => void;
  onDismiss: () => void;
}

export function ArrivalDatesModal({
  open,
  initialArrival,
  initialDeparture,
  onSaved,
  onDismiss,
}: Props) {
  const [arrival, setArrival] = useState(initialArrival ?? "");
  const [departure, setDeparture] = useState(initialDeparture ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Callers remount via a `key` tied to `open`, so the useState initializers
  // above re-read the initial props on each open — no reset effect needed.

  async function handleSave() {
    if (!arrival) {
      setError("Pick your arrival date.");
      return;
    }
    if (departure && arrival > departure) {
      setError("Arrival can't be after departure.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await updateArrivalDates(arrival, departure || null);
    setSaving(false);
    if ("error" in res) {
      setError(res.error ?? "Couldn't save your dates. Try again.");
      return;
    }
    onSaved(arrival, departure || null);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="glass border-pink-500/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sand-100">
            <CalendarCheck className="h-5 w-5 text-pink-400" />
            Your playa dates
          </DialogTitle>
          <DialogDescription className="text-sand-400">
            When are you arriving at and leaving Black Rock City? Helps us plan
            arrivals, builds, and departures.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="arrival-date" className="text-sand-300">
              Arrival date
            </Label>
            <Input
              id="arrival-date"
              type="date"
              min={MIN_DATE}
              max={MAX_DATE}
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="departure-date" className="text-sand-300">
              Departure date <span className="text-sand-500">(optional)</span>
            </Label>
            <Input
              id="departure-date"
              type="date"
              min={arrival || MIN_DATE}
              max={MAX_DATE}
              value={departure}
              onChange={(e) => setDeparture(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <Button
              variant="ghost"
              className="text-sand-400 hover:text-sand-200"
              disabled={saving}
              onClick={onDismiss}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-pink-500 text-white hover:bg-pink-600"
              disabled={saving}
              onClick={handleSave}
            >
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {saving ? "Saving…" : "Save dates"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
