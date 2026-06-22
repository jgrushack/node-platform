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
import { CalendarCheck, Hammer, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { updateArrivalDates } from "@/lib/actions/registrations";

// NODE 2026 schedule (camp dates, not official BRC gate dates):
//   Build week ...... Wed Aug 26 – Sat Aug 29
//   Opening ceremony  Sun Aug 30, 4:00 PM
//   Strike .......... Sep 5 – 7
type DayOption = { value: string; weekday: string; label: string };

const BUILD_DAYS: DayOption[] = [
  { value: "2026-08-26", weekday: "Wed", label: "Aug 26" },
  { value: "2026-08-27", weekday: "Thu", label: "Aug 27" },
  { value: "2026-08-28", weekday: "Fri", label: "Aug 28" },
  { value: "2026-08-29", weekday: "Sat", label: "Aug 29" },
];

const EVENT_DAYS: DayOption[] = [
  { value: "2026-08-30", weekday: "Sun", label: "Aug 30" },
  { value: "2026-08-31", weekday: "Mon", label: "Aug 31" },
  { value: "2026-09-01", weekday: "Tue", label: "Sep 1" },
  { value: "2026-09-02", weekday: "Wed", label: "Sep 2" },
  { value: "2026-09-03", weekday: "Thu", label: "Sep 3" },
  { value: "2026-09-04", weekday: "Fri", label: "Sep 4" },
  { value: "2026-09-05", weekday: "Sat", label: "Sep 5" },
  { value: "2026-09-06", weekday: "Sun", label: "Sep 6" },
  { value: "2026-09-07", weekday: "Mon", label: "Sep 7" },
];

// No one arrives during strike (Sep 5–7), so arrival options stop at Sep 4.
// Departures still span the full range.
const ARRIVAL_EVENT_DAYS = EVENT_DAYS.slice(0, 6);

interface Props {
  open: boolean;
  initialArrival?: string | null;
  initialDeparture?: string | null;
  onSaved: (arrival: string | null, departure: string | null) => void;
  onDismiss: () => void;
}

function DayButton({
  option,
  selected,
  disabled,
  onClick,
}: {
  option: DayOption;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex flex-col items-center rounded-xl border px-2 py-2 text-center transition",
        "disabled:cursor-not-allowed disabled:opacity-30",
        selected
          ? "border-pink-400 bg-pink-500/20 text-sand-50 ring-1 ring-pink-400/50"
          : "border-white/10 bg-white/5 text-sand-300 hover:border-pink-400/40 hover:bg-white/10"
      )}
    >
      <span className="text-[10px] font-medium uppercase tracking-wide text-sand-500">
        {option.weekday}
      </span>
      <span className="text-sm font-semibold">{option.label}</span>
    </button>
  );
}

export function ArrivalDatesModal({
  open,
  initialArrival,
  initialDeparture,
  onSaved,
  onDismiss,
}: Props) {
  const [step, setStep] = useState<"arrival" | "departure">("arrival");
  const [arrival, setArrival] = useState(initialArrival ?? "");
  const [departure, setDeparture] = useState(initialDeparture ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Callers remount via a `key` tied to `open`, so the useState initializers
  // above re-read the initial props on each open — no reset effect needed.

  async function handleSave() {
    if (departure && arrival > departure) {
      setError("Departure can't be before arrival.");
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

  const isArrivalStep = step === "arrival";
  const selected = isArrivalStep ? arrival : departure;
  const eventDays = isArrivalStep ? ARRIVAL_EVENT_DAYS : EVENT_DAYS;

  function pick(value: string) {
    setError(null);
    if (isArrivalStep) {
      setArrival(value);
      // Keep departure consistent: a departure earlier than the new arrival
      // no longer makes sense.
      if (departure && value > departure) setDeparture("");
    } else {
      setDeparture(value);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onDismiss(); }}>
      <DialogContent className="glass border-pink-500/10 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sand-100">
            <CalendarCheck className="h-5 w-5 text-pink-400" />
            {isArrivalStep ? "When are you arriving?" : "When are you leaving?"}
          </DialogTitle>
          <DialogDescription className="text-sand-400">
            {isArrivalStep
              ? "Pick the day you’ll roll into Black Rock City."
              : "Pick the day you’re heading home."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Build week — top row */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-sand-400">
              <Hammer className="h-3.5 w-3.5 text-amber-400" />
              Build week
            </div>
            <div className="grid grid-cols-4 gap-2">
              {BUILD_DAYS.map((d) => (
                <DayButton
                  key={d.value}
                  option={d}
                  selected={selected === d.value}
                  disabled={!isArrivalStep && !!arrival && d.value < arrival}
                  onClick={() => pick(d.value)}
                />
              ))}
            </div>
          </div>

          {/* Event dates */}
          <div className="space-y-2">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-sand-400">
              During the event
            </div>
            <div className="grid grid-cols-4 gap-2">
              {eventDays.map((d) => (
                <DayButton
                  key={d.value}
                  option={d}
                  selected={selected === d.value}
                  disabled={!isArrivalStep && !!arrival && d.value < arrival}
                  onClick={() => pick(d.value)}
                />
              ))}
            </div>
          </div>

          {/* Step-specific guidance */}
          {isArrivalStep ? (
            <p className="rounded-lg border border-pink-500/15 bg-pink-500/5 px-3 py-2 text-sm text-sand-300">
              We recommend coming as early as you can. Opening ceremony is{" "}
              <span className="font-semibold text-sand-100">
                August 30 at 4:00 PM
              </span>
              .
            </p>
          ) : (
            <p className="rounded-lg border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-sm text-sand-300">
              Strike is{" "}
              <span className="font-semibold text-sand-100">
                September 5–7
              </span>{" "}
              and all campers are expected to help strike. If you need to leave
              earlier, please{" "}
              <span className="font-semibold text-sand-100">
                chat with us
              </span>{" "}
              directly first.
            </p>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          {/* Footer */}
          <div className="flex gap-3 pt-1">
            {isArrivalStep ? (
              <>
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
                  disabled={!arrival}
                  onClick={() => {
                    setError(null);
                    setStep("departure");
                  }}
                >
                  Next
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-sand-400 hover:text-sand-200"
                  disabled={saving}
                  onClick={() => {
                    setError(null);
                    setStep("arrival");
                  }}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 bg-pink-500 text-white hover:bg-pink-600"
                  disabled={saving}
                  onClick={handleSave}
                >
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {saving ? "Saving…" : "Save dates"}
                </Button>
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
