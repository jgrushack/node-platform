"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Car,
  Bus,
  Ticket,
  AlertTriangle,
  CheckCircle2,
  Clock,
  XCircle,
  ListFilter,
  Search,
  ChevronRight,
  Ban,
  Loader2,
  Wallet,
  Phone,
  Instagram,
  Video,
  Download,
  CalendarDays,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  getCampReport,
  cancelRegistration,
  type ReportRow,
} from "@/lib/actions/reports";

interface ApplicationRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  playa_name: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

type RosterFilter = "all" | "paid" | "partial" | "unpaid" | "cancelled";
type TicketFilter = "any" | "yes" | "no";
type TravelFilter =
  | "any"
  | "car_pass_parking"
  | "ride_sorted"
  | "ride_unsorted"
  | "burner_express"
  | "no";
type JobsFilter = "any" | "none" | "some";
type DatesFilter = "any" | "set" | "unset" | "reno";

const money = (cents: number) =>
  (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  });

const fmtDate = (d: string | null) =>
  d
    ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : "—";

const fmtTime = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ap = h >= 12 ? "pm" : "am";
  const hr = ((h + 11) % 12) + 1;
  return m ? `${hr}:${String(m).padStart(2, "0")}${ap}` : `${hr}${ap}`;
};

const TRAVEL_LABEL: Record<string, string> = {
  car_pass_parking: "Car pass (+ parking)",
  ride_sorted: "Car ride — sorted",
  ride_unsorted: "Needs a ride",
  burner_express: "Burner Express",
  other: "Other arrangement",
  no: "Not answered",
};

/** Travel icon: car+ticket = car pass, car = ride, bus = Burner Express. */
function TravelCell({ value }: { value: string }) {
  const title = TRAVEL_LABEL[value] ?? "Not answered";
  switch (value) {
    case "car_pass_parking":
      return (
        <span title={title} className="inline-flex items-center text-emerald-400">
          <Car className="h-4 w-4" />
          <Ticket className="-ml-0.5 h-3 w-3" />
        </span>
      );
    case "ride_sorted":
      return (
        <span title={title} className="inline-flex text-sky-400">
          <Car className="h-4 w-4" />
        </span>
      );
    case "ride_unsorted":
      return (
        <span title={title} className="inline-flex text-amber-400">
          <Car className="h-4 w-4" />
        </span>
      );
    case "burner_express":
      return (
        <span title={title} className="inline-flex text-purple-400">
          <Bus className="h-4 w-4" />
        </span>
      );
    default:
      return (
        <span title={title} className="text-sand-600">
          —
        </span>
      );
  }
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    confirmed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    pending: "bg-amber/15 text-amber border-amber/20",
    waitlisted: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    waitlist: "bg-blue-500/15 text-blue-400 border-blue-500/20",
    cancelled: "bg-red-500/15 text-red-400 border-red-500/20",
    approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    rejected: "bg-red-500/15 text-red-400 border-red-500/20",
  };
  return (
    <Badge
      variant="outline"
      className={styles[status] || "bg-sand-500/15 text-sand-400"}
    >
      {status}
    </Badge>
  );
}

/** Dues payment badge; cancelled registrations keep their status badge. */
function duesBadge(row: ReportRow) {
  if (row.status === "cancelled") return statusBadge(row.status);
  if (!row.duesStatus) return null;
  const styles: Record<NonNullable<ReportRow["duesStatus"]>, [string, string]> = {
    paid: ["Paid", "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"],
    partial: ["Partial", "bg-amber/15 text-amber border-amber/20"],
    unpaid: ["Unpaid", "bg-red-500/15 text-red-400 border-red-500/20"],
  };
  const [label, className] = styles[row.duesStatus];
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}

function TicketIcon({ has }: { has: boolean }) {
  return has ? (
    <CheckCircle2 className="inline h-4 w-4 text-emerald-400" aria-label="Has ticket" />
  ) : (
    <XCircle className="inline h-4 w-4 text-sand-600" aria-label="No ticket" />
  );
}

// ── Detail modal ─────────────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-amber">
        {title}
      </p>
      <div className="space-y-1 text-sm text-sand-300">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-sand-500">{label}</span>
      <span className="min-w-0 wrap-anywhere text-right text-sand-200">
        {value || "—"}
      </span>
    </div>
  );
}

function DetailModal({
  row,
  isSuperAdmin,
  isAdmin,
  onClose,
  onCancelRegistration,
}: {
  row: ReportRow | null;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onCancelRegistration: (row: ReportRow) => void;
}) {
  if (!row) return null;
  const gearCount = row.equipment.items.reduce((n, it) => n + it.quantity, 0);

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass border-pink-500/10 flex max-h-[90vh] flex-col sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 text-sand-100">
            {row.name}
            {row.playaName ? (
              <span className="text-sm font-normal text-sand-500">
                “{row.playaName}”
              </span>
            ) : null}
            {statusBadge(row.status)}
          </DialogTitle>
          <DialogDescription className="wrap-anywhere text-sand-400">
            {row.email ?? "no email on file"}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain">
          {/* Registration & travel */}
          <Section title="Registration & travel">
            <Field
              label="Ticket"
              value={
                <span className="inline-flex items-center gap-1">
                  <TicketIcon has={row.hasTicket} />
                  {row.hasTicket ? "Has ticket" : "No ticket"}
                </span>
              }
            />
            <Field
              label="Travel"
              value={
                <span className="inline-flex items-center gap-1.5">
                  <TravelCell value={row.carPass} />
                  {TRAVEL_LABEL[row.carPass] ?? "Not answered"}
                </span>
              }
            />
            <Field
              label="Dates"
              value={`${fmtDate(row.arrivalDate)} → ${fmtDate(row.departureDate)}`}
            />
            {row.renoArrivalDate && (
              <Field label="Lands in Reno" value={fmtDate(row.renoArrivalDate)} />
            )}
            {row.profile.phone && (
              <Field
                label="Phone"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" />
                    {row.profile.phone}
                  </span>
                }
              />
            )}
          </Section>

          {/* Dues — super-admin only */}
          {isSuperAdmin && (
            <Section title="Dues">
              {row.dues.totalCents > 0 ? (
                <>
                  <Field label="Tier" value={money(row.dues.totalCents)} />
                  <Field label="Paid" value={money(row.dues.paidCents)} />
                  <Field
                    label="Owed"
                    value={
                      row.dues.owedCents > 0 ? (
                        <span className="text-red-400">
                          {money(row.dues.owedCents)}
                        </span>
                      ) : (
                        <span className="text-emerald-400">Paid in full</span>
                      )
                    }
                  />
                </>
              ) : (
                <p className="text-sand-500">Not started</p>
              )}
            </Section>
          )}

          {/* Storage */}
          <Section title="Storage">
            {row.storage.items.length > 0 ? (
              <ul className="space-y-1">
                {row.storage.items.map((it, idx) => (
                  <li key={idx}>
                    <span className="text-sand-200">
                      {it.quantity}× {it.type}
                    </span>
                    {it.labels.length > 0 && (
                      <span className="text-sand-500">
                        {" "}
                        — {it.labels.join(", ")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sand-500">
                {row.storage.summary ?? "Nothing in storage"}
              </p>
            )}
            {isSuperAdmin && row.storage.owedCents > 0 && (
              <p className="text-xs text-red-400">
                {money(row.storage.owedCents)} owed
              </p>
            )}
          </Section>

          {/* Equipment */}
          <Section title="Equipment rented">
            {gearCount > 0 ? (
              <ul className="space-y-0.5">
                {row.equipment.items.map((it, idx) => (
                  <li key={idx} className="text-sand-200">
                    {it.quantity}× {it.label}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sand-500">Nothing rented</p>
            )}
            {isSuperAdmin && row.equipment.owedCents > 0 && (
              <p className="text-xs text-red-400">
                {money(row.equipment.owedCents)} owed
              </p>
            )}
          </Section>

          {/* Jobs */}
          <Section title="Jobs">
            {row.jobs.shiftCount > 0 ? (
              <>
                <p className="text-sand-400">
                  {row.jobs.shiftCount} shift
                  {row.jobs.shiftCount === 1 ? "" : "s"} · {row.jobs.points} pts
                </p>
                <ul className="space-y-0.5">
                  {row.jobs.shifts.map((s, idx) => (
                    <li key={idx} className="text-sand-200">
                      {s.title}
                      <span className="text-sand-500">
                        {" "}
                        · {fmtDate(s.date)} {fmtTime(s.time)}
                      </span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sand-500">No shifts signed up</p>
            )}
          </Section>

          {/* Profile answers */}
          <Section title="Profile">
            {row.profile.skills.length > 0 && (
              <Field label="Skills" value={row.profile.skills.join(", ")} />
            )}
            <Field label="Dietary" value={row.profile.dietary} />
            {row.profile.emergencyContact && (
              <Field
                label="Emergency contact"
                value={row.profile.emergencyContact}
              />
            )}
            {row.profile.instagram && (
              <Field
                label="Instagram"
                value={
                  <span className="inline-flex items-center gap-1">
                    <Instagram className="h-3.5 w-3.5" />
                    {row.profile.instagram}
                  </span>
                }
              />
            )}
            {row.profile.nodeYears.length > 0 && (
              <Field label="NODE years" value={row.profile.nodeYears.join(", ")} />
            )}
            {row.profile.otherBurns.length > 0 && (
              <Field
                label="Other burns"
                value={row.profile.otherBurns.join(", ")}
              />
            )}
            {row.profile.bio && (
              <p className="pt-1 text-sand-300">{row.profile.bio}</p>
            )}
          </Section>

          {/* Application answers */}
          {row.application && (
            <Section title="Application answers">
              <Field
                label="Years attended"
                value={row.application.yearsAttended}
              />
              <Field
                label="Previous camps"
                value={row.application.previousCamps}
              />
              <Field
                label="Favorite principle"
                value={row.application.favoritePrinciple}
              />
              {row.application.principleReason && (
                <p className="pt-1 text-sand-300">
                  “{row.application.principleReason}”
                </p>
              )}
              <Field label="Referred by" value={row.application.referredBy} />
              {row.application.skills && (
                <Field label="Skills (app)" value={row.application.skills} />
              )}
              {row.application.videoUrl && (
                <Field
                  label="Video"
                  value={
                    <a
                      href={row.application.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-pink-400 hover:underline"
                    >
                      <Video className="h-3.5 w-3.5" />
                      Watch
                    </a>
                  }
                />
              )}
            </Section>
          )}

          {isAdmin && row.status !== "cancelled" && (
            <div className="border-t border-white/10 pt-3">
              <Button
                variant="ghost"
                className="text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
                onClick={() => onCancelRegistration(row)}
              >
                <Ban className="mr-2 h-4 w-4" />
                Cancel registration
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Arrivals tab ─────────────────────────────────────────────────────

// Camp window: Reno landings start Aug 24, strike ends Sep 7.
const SCHEDULE_DAYS: string[] = (() => {
  const out: string[] = [];
  const d = new Date("2026-08-24T12:00:00");
  for (let i = 0; i < 15; i++) {
    out.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return out;
})();

const weekday = (day: string) =>
  new Date(`${day}T12:00:00`)
    .toLocaleDateString("en-US", { weekday: "short" })
    .slice(0, 2);

// Validated against the blue-950 glass surface (dataviz six-check palette run).
const CHART = {
  playa: "#db2777",
  reno: "#0284c7",
  camp: "#d97706",
};

// Setup Access Pass allocation per build day (from BMorg placement).
// Gate opens to everyone Sun Aug 30; before that, entry requires an SAP.
const SAP_QUOTA: Record<string, number> = {
  "2026-08-24": 0,
  "2026-08-25": 6,
  "2026-08-26": 12,
  "2026-08-27": 10,
  "2026-08-28": 4,
  "2026-08-29": 0,
};
const BUILD_DAYS = Object.keys(SAP_QUOTA);
const SAP_TOTAL = Object.values(SAP_QUOTA).reduce((a, b) => a + b, 0);

// Travel-status hues, validated on the blue-950 surface (dataviz six-check
// run; purple's contrast WARN is relieved by the visible name label on chips).
const RIDE_COLOR: Record<string, string> = {
  car_pass_parking: "#059669",
  ride_unsorted: "#d97706",
  ride_sorted: "#0284c7",
  burner_express: "#9333ea",
};
const RIDE_FALLBACK = "#64748b";

/** SAP pass board. A pass is valid from its issue day ONWARD (a Tuesday SAP
 *  admits a Tuesday-or-later playa arrival), so unused passes roll forward
 *  and the real constraint is cumulative: arrivals-so-far ≤ passes-so-far.
 *  Each column shows that day's issued passes plus any arrivals covered by
 *  rolled-forward passes; red = a true cumulative shortfall. */
function SapCard({ active }: { active: ReportRow[] }) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const byDay = new Map<string, ReportRow[]>();
  active.forEach((r) => {
    if (r.arrivalDate && SAP_QUOTA[r.arrivalDate] !== undefined)
      byDay.set(r.arrivalDate, [...(byDay.get(r.arrivalDate) ?? []), r]);
  });
  const preBuild = active.filter(
    (r) => r.arrivalDate && r.arrivalDate < BUILD_DAYS[0]
  );
  const totalArriving = BUILD_DAYS.reduce(
    (a, d) => a + (byDay.get(d)?.length ?? 0),
    0
  );

  // Walk the days in order, arrivals consuming the oldest passes first.
  type DayCalc = {
    day: string;
    n: number;
    issued: number;
    usable: number; // passes in hand that day (issued + rolled forward)
    fromToday: number; // arrivals on a pass issued this day
    fromCarry: number; // arrivals on a rolled-forward earlier pass
    shortfall: number; // arrivals with no pass available at all
    spare: number; // this day's passes left over (roll forward)
  };
  let carry = 0;
  const calc: DayCalc[] = BUILD_DAYS.map((day) => {
    const n = byDay.get(day)?.length ?? 0;
    const issued = SAP_QUOTA[day];
    const usable = carry + issued;
    const fromCarry = Math.min(n, carry);
    const fromToday = Math.min(n - fromCarry, issued);
    const shortfall = n - fromCarry - fromToday;
    const spare = issued - fromToday;
    carry = carry - fromCarry + spare;
    return { day, n, issued, usable, fromToday, fromCarry, shortfall, spare };
  });
  const shortDays = calc.filter((c) => c.shortfall > 0);
  const leftover = carry;

  const maxSlots = Math.max(
    1,
    ...calc.map((c) => c.issued + c.fromCarry + c.shortfall)
  );
  const sel = selectedDay ? byDay.get(selectedDay) ?? [] : [];

  return (
    <Card className="glass-card border-0">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-sm font-medium text-sand-300">
            Setup Access Passes — build week
          </CardTitle>
          <span className="text-xs text-sand-400">
            {totalArriving} arriving early · {SAP_TOTAL} passes ·{" "}
            {leftover} to spare
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs text-sand-400">
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px]"
              style={{ background: CHART.camp }}
            />
            On this day&rsquo;s pass
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="h-2.5 w-2.5 rounded-[3px] border-2"
              style={{ borderColor: CHART.camp }}
            />
            On an earlier pass
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] border border-dashed border-sand-500" />
            Unused (rolls forward)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-[3px] bg-red-600" />
            No pass available
          </span>
        </div>
        <p className="text-[11px] text-sand-500">
          A pass works its own day and any day after, so spares roll forward.
        </p>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-0.5 overflow-x-auto pb-1">
          {calc.map((c) => {
            const selected = selectedDay === c.day;
            return (
              <button
                key={c.day}
                onClick={() => setSelectedDay(selected ? null : c.day)}
                title={`${fmtDate(c.day)} — ${c.n} arriving · ${c.issued} issued · ${c.usable} usable`}
                className={`group flex min-w-11 flex-1 flex-col items-center rounded-lg pt-1 transition-colors ${
                  selected ? "bg-amber/10" : "hover:bg-amber/5"
                }`}
              >
                <span
                  className={`mb-1 text-[10px] leading-none ${
                    c.shortfall > 0 ? "text-red-400" : "text-sand-400"
                  }`}
                >
                  {c.n}/{c.usable}
                </span>
                <div
                  className="flex w-full flex-col items-center justify-end gap-0.5"
                  style={{ height: maxSlots * 12 }}
                >
                  {Array.from({ length: c.shortfall }, (_, i) => (
                    <span
                      key={`o${i}`}
                      className="h-2.5 w-6 rounded-[3px] bg-red-600"
                    />
                  ))}
                  {Array.from({ length: c.fromCarry }, (_, i) => (
                    <span
                      key={`c${i}`}
                      className="h-2.5 w-6 rounded-[3px] border-2"
                      style={{ borderColor: CHART.camp }}
                    />
                  ))}
                  {Array.from({ length: c.spare }, (_, i) => (
                    <span
                      key={`s${i}`}
                      className="h-2.5 w-6 rounded-[3px] border border-dashed border-sand-500"
                    />
                  ))}
                  {Array.from({ length: c.fromToday }, (_, i) => (
                    <span
                      key={`f${i}`}
                      className="h-2.5 w-6 rounded-[3px]"
                      style={{ background: CHART.camp }}
                    />
                  ))}
                </div>
                <span className="mt-1 text-[10px] leading-none text-sand-500">
                  {weekday(c.day)}
                </span>
                <span className="text-[10px] text-sand-500">
                  {c.day.slice(8).replace(/^0/, "")}
                </span>
              </button>
            );
          })}
        </div>

        {(shortDays.length > 0 || preBuild.length > 0) && (
          <div className="mt-3 space-y-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-xs text-red-300">
            {shortDays.map((c) => {
              const people = byDay.get(c.day) ?? [];
              const names = people.slice(0, 3).map((r) => r.name).join(", ");
              const more =
                people.length > 3 ? `, +${people.length - 3} more` : "";
              return (
                <p key={c.day} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>
                    {fmtDate(c.day)}: {c.n} arriving ({names}
                    {more}) but only {c.usable} pass
                    {c.usable === 1 ? "" : "es"} issued by then — {c.shortfall}{" "}
                    can&rsquo;t get in. Move arrivals later or check the dates
                    are really playa (not Reno) arrivals. Tap the day for the
                    full list.
                  </span>
                </p>
              );
            })}
            {preBuild.length > 0 && (
              <p className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Arriving before build week (no SAP exists):{" "}
                  {preBuild
                    .map((r) => `${r.name} (${fmtDate(r.arrivalDate)})`)
                    .join(", ")}
                </span>
              </p>
            )}
          </div>
        )}

        {selectedDay && (
          <div className="mt-3 rounded-lg border border-amber/10 bg-blue-950/30 px-3 py-2.5 text-sm">
            <p className="font-medium text-sand-200">{fmtDate(selectedDay)}</p>
            <p className="text-sand-300">
              {sel.length > 0
                ? `Needs an SAP: ${sel.map((r) => r.name).join(", ")}`
                : "No early arrivals this day"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** One camper as a travel-status chip: colored icon + name. */
function RideChip({ r }: { r: ReportRow }) {
  const c = RIDE_COLOR[r.carPass] ?? RIDE_FALLBACK;
  const Icon = r.carPass === "burner_express" ? Bus : Car;
  return (
    <span
      title={TRAVEL_LABEL[r.carPass] ?? "Other / not answered"}
      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs text-sand-200"
      style={{ borderColor: `${c}59`, background: `${c}1f` }}
    >
      <Icon className="h-3 w-3 shrink-0" style={{ color: c }} />
      {r.name}
    </span>
  );
}

/** Ride coordination — facts only, no assumed carpools. Who has a car (with
 *  their dates), who still needs a ride and when they land, who's set. Whether
 *  a car has spare seats isn't tracked; the camp coordinates directly. */
function RidesCard({ active }: { active: ReportRow[] }) {
  const cars = active.filter(
    (r) => r.carPass === "car_pass_parking" || r.carPass === "other"
  );
  const seekers = active.filter((r) => r.carPass === "ride_unsorted");
  const seekersByDay = new Map<string, ReportRow[]>();
  const seekersNoDate: ReportRow[] = [];
  seekers.forEach((r) => {
    if (r.renoArrivalDate)
      seekersByDay.set(r.renoArrivalDate, [
        ...(seekersByDay.get(r.renoArrivalDate) ?? []),
        r,
      ]);
    else seekersNoDate.push(r);
  });
  const seekerDays = Array.from(seekersByDay.keys()).sort();
  const sorted = active.filter((r) => r.carPass === "ride_sorted");
  const bus = active.filter((r) => r.carPass === "burner_express");

  return (
    <Card className="glass-card border-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-sand-300">
          Cars & rides
        </CardTitle>
        <p className="text-xs text-sand-500">
          Having a car doesn&rsquo;t mean offering seats — coordinate directly.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Who has a car, with their travel dates */}
        <div className="rounded-lg border border-amber/10 bg-blue-950/30 px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-sand-300">
            Have cars ({cars.length})
          </p>
          <div className="space-y-1.5">
            {cars.map((r) => (
              <div
                key={r.registrationId}
                className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
              >
                <RideChip r={r} />
                <span className="text-[11px] text-sand-500">
                  {r.renoArrivalDate
                    ? `Reno ${fmtDate(r.renoArrivalDate)}`
                    : "Reno —"}
                  {" · "}
                  {r.arrivalDate
                    ? `playa ${fmtDate(r.arrivalDate)}`
                    : "playa —"}
                  {r.carPass === "other" ? " · listed travel as “other”" : ""}
                </span>
              </div>
            ))}
            {cars.length === 0 && (
              <p className="text-sm text-sand-400">No cars on file.</p>
            )}
          </div>
        </div>

        {/* Who needs a ride, by landing day */}
        {seekerDays.map((day) => (
          <div
            key={day}
            className="rounded-lg border border-amber/10 bg-blue-950/30 px-3 py-2.5"
          >
            <p className="mb-1.5 text-xs font-medium text-sand-300">
              Need a ride — land {weekday(day)} {fmtDate(day)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {seekersByDay.get(day)!.map((r) => (
                <RideChip key={r.registrationId} r={r} />
              ))}
            </div>
          </div>
        ))}
        {seekersNoDate.length > 0 && (
          <div className="rounded-lg border border-amber/15 bg-amber/5 px-3 py-2.5">
            <p className="mb-1.5 text-xs font-medium text-amber">
              Need a ride — no landing day yet
            </p>
            <div className="flex flex-wrap gap-1.5">
              {seekersNoDate.map((r) => (
                <RideChip key={r.registrationId} r={r} />
              ))}
            </div>
          </div>
        )}
        {seekers.length === 0 && (
          <p className="text-sm text-sand-400">
            No one currently needs a ride.
          </p>
        )}

        {/* Already set */}
        {(sorted.length > 0 || bus.length > 0) && (
          <div className="space-y-1 text-xs text-sand-500">
            {sorted.length > 0 && (
              <p>
                <span style={{ color: RIDE_COLOR.ride_sorted }}>●</span> Ride
                sorted: {sorted.map((r) => r.name).join(", ")}
              </p>
            )}
            {bus.length > 0 && (
              <p>
                <span style={{ color: RIDE_COLOR.burner_express }}>●</span>{" "}
                Burner Express: {bus.map((r) => r.name).join(", ")}
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ArrivalsTab({ rows }: { rows: ReportRow[] }) {
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [showNoDates, setShowNoDates] = useState(false);

  const active = rows.filter((r) => r.status !== "cancelled");
  const arrivalsByDay = new Map<string, ReportRow[]>();
  const renoByDay = new Map<string, ReportRow[]>();
  active.forEach((r) => {
    if (r.arrivalDate)
      arrivalsByDay.set(r.arrivalDate, [
        ...(arrivalsByDay.get(r.arrivalDate) ?? []),
        r,
      ]);
    if (r.renoArrivalDate)
      renoByDay.set(r.renoArrivalDate, [
        ...(renoByDay.get(r.renoArrivalDate) ?? []),
        r,
      ]);
  });
  // Null departure = assume they stay through strike.
  const inCamp = SCHEDULE_DAYS.map(
    (day) =>
      active.filter(
        (r) =>
          r.arrivalDate &&
          r.arrivalDate <= day &&
          day <= (r.departureDate ?? "2026-09-07")
      ).length
  );
  const noDates = active.filter((r) => !r.arrivalDate);

  const maxArrivals = Math.max(
    1,
    ...SCHEDULE_DAYS.map((d) =>
      Math.max(arrivalsByDay.get(d)?.length ?? 0, renoByDay.get(d)?.length ?? 0)
    )
  );
  const maxCamp = Math.max(1, ...inCamp);
  const peakCampDay = SCHEDULE_DAYS[inCamp.indexOf(maxCamp)];

  const selArrivals = selectedDay ? arrivalsByDay.get(selectedDay) ?? [] : [];
  const selReno = selectedDay ? renoByDay.get(selectedDay) ?? [] : [];

  const phase = (day: string) =>
    day < "2026-08-26"
      ? "pre"
      : day < "2026-08-30"
        ? "build"
        : day < "2026-09-05"
          ? "event"
          : "strike";

  return (
    <div className="space-y-4">
      {/* Arrivals per day */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-sand-300">
            Arrivals by day
          </CardTitle>
          <div className="flex flex-wrap items-center gap-4 text-xs text-sand-400">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: CHART.playa }}
              />
              Rolling into BRC
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: CHART.reno }}
              />
              Landing in Reno
            </span>
            {noDates.length > 0 && (
              <button
                onClick={() => setShowNoDates((v) => !v)}
                className="-mx-2 -my-1.5 rounded px-2 py-1.5 text-amber hover:underline"
              >
                {noDates.length} with no dates yet
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showNoDates && (
            <p className="mb-3 rounded-lg border border-amber/15 bg-amber/5 px-3 py-2 text-xs text-sand-300">
              {noDates.map((r) => r.name).join(", ")}
            </p>
          )}
          <div className="flex items-end gap-1 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] md:[mask-image:none]">
            {SCHEDULE_DAYS.map((day) => {
              const a = arrivalsByDay.get(day)?.length ?? 0;
              const rn = renoByDay.get(day)?.length ?? 0;
              const selected = selectedDay === day;
              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(selected ? null : day)}
                  title={`${fmtDate(day)} — ${a} arriving, ${rn} landing in Reno`}
                  className={`group flex min-w-9 flex-1 flex-col items-center rounded-lg pt-1 transition-colors ${
                    selected ? "bg-amber/10" : "hover:bg-amber/5"
                  }`}
                >
                  <div className="flex h-28 w-full items-end justify-center gap-0.5">
                    {[
                      { n: a, color: CHART.playa },
                      { n: rn, color: CHART.reno },
                    ].map(({ n, color }, i) => (
                      <div key={i} className="flex w-2.5 flex-col items-center justify-end self-stretch">
                        {n > 0 && (
                          <>
                            <span className="mb-0.5 text-[10px] leading-none text-sand-400">
                              {n}
                            </span>
                            <div
                              className="w-full rounded-t"
                              style={{
                                background: color,
                                height: `${(n / maxArrivals) * 88}%`,
                                minHeight: 4,
                              }}
                            />
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <span
                    className={`mt-1 text-[10px] leading-none ${
                      phase(day) === "build"
                        ? "text-amber"
                        : phase(day) === "strike"
                          ? "text-red-400"
                          : "text-sand-500"
                    }`}
                  >
                    {weekday(day)}
                  </span>
                  <span className="text-[10px] text-sand-500">
                    {day.slice(8).replace(/^0/, "")}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-sand-500">
            <span className="text-amber">Build Aug 26–29</span> · Opening Aug 30
            · <span className="text-red-400">Strike Sep 5–7</span>
          </p>

          {selectedDay && (
            <div className="mt-3 space-y-2 rounded-lg border border-amber/10 bg-blue-950/30 px-3 py-2.5 text-sm">
              <p className="font-medium text-sand-200">{fmtDate(selectedDay)}</p>
              <p className="text-sand-300">
                <span style={{ color: CHART.playa }}>●</span>{" "}
                {selArrivals.length > 0
                  ? `Arriving: ${selArrivals.map((r) => r.name).join(", ")}`
                  : "No one rolling in"}
              </p>
              <p className="text-sand-300">
                <span style={{ color: CHART.reno }}>●</span>{" "}
                {selReno.length > 0
                  ? `Landing in Reno: ${selReno.map((r) => r.name).join(", ")}`
                  : "No Reno landings"}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SAP pass board */}
      <SapCard active={active} />

      {/* Reno ride coordination */}
      <RidesCard active={active} />

      {/* Camp population */}
      <Card className="glass-card border-0">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-sand-300">
            In camp each day
          </CardTitle>
          <p className="text-xs text-sand-500">
            Campers with dates, arrival through departure (no departure = stays
            for strike)
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 overflow-x-auto pb-1 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] md:[mask-image:none]">
            {SCHEDULE_DAYS.map((day, i) => (
              <div
                key={day}
                title={`${fmtDate(day)} — ${inCamp[i]} in camp`}
                className="group flex min-w-9 flex-1 flex-col items-center rounded-lg pt-1 hover:bg-amber/5"
              >
                <div className="flex h-24 w-full flex-col items-center justify-end">
                  <span className="mb-0.5 text-[10px] leading-none text-sand-400">
                    {inCamp[i]}
                  </span>
                  {inCamp[i] > 0 && (
                    <div
                      className="w-2.5 rounded-t"
                      style={{
                        background: CHART.camp,
                        height: `${(inCamp[i] / maxCamp) * 88}%`,
                        minHeight: 4,
                      }}
                    />
                  )}
                </div>
                <span className="mt-1 text-[10px] leading-none text-sand-500">
                  {weekday(day)}
                </span>
                <span className="text-[10px] text-sand-500">
                  {day.slice(8).replace(/^0/, "")}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-sand-500">
            Peak: {maxCamp} campers on {fmtDate(peakCampDay)}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────

export default function ReportsClient() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RosterFilter>("all");
  const [ticketFilter, setTicketFilter] = useState<TicketFilter>("any");
  const [travelFilter, setTravelFilter] = useState<TravelFilter>("any");
  const [jobsFilter, setJobsFilter] = useState<JobsFilter>("any");
  const [datesFilter, setDatesFilter] = useState<DatesFilter>("any");
  const [appSearch, setAppSearch] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState<string>("all");
  const [detailRow, setDetailRow] = useState<ReportRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<ReportRow | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const loadRoster = useCallback(async () => {
    const res = await getCampReport();
    if ("error" in res) {
      setRosterError(res.error);
      setRows([]);
    } else {
      setRosterError(null);
      setRows(res.rows);
      setIsSuperAdmin(res.isSuperAdmin);
      setIsAdmin(res.isAdmin);
    }
    return res;
  }, []);

  useEffect(() => {
    (async () => {
      const res = await loadRoster();
      if (!("error" in res) && res.isAdmin) {
        const supabase = createClient();
        const { data: apps } = await supabase
          .from("applications")
          .select(
            "id, first_name, last_name, email, playa_name, status, created_at, reviewed_at"
          )
          .order("created_at", { ascending: false });
        if (apps) setApplications(apps as ApplicationRow[]);
      }
      setLoading(false);
    })();
  }, [loadRoster]);

  async function handleCancel() {
    if (!cancelTarget) return;
    setCancelling(true);
    const res = await cancelRegistration(cancelTarget.registrationId);
    setCancelling(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(
      `Cancelled ${cancelTarget.name} — freed ${res.releasedReservations} reservation${
        res.releasedReservations === 1 ? "" : "s"
      }, voided ${res.voidedInvoices} unpaid invoice${
        res.voidedInvoices === 1 ? "" : "s"
      }.`
    );
    setCancelTarget(null);
    setDetailRow(null);
    await loadRoster();
  }

  const filteredRows = rows.filter((r) => {
    const matchesSearch =
      !search ||
      [r.name, r.playaName, r.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(search.toLowerCase()));
    // "All" means the active roster — cancelled folks only show under their own chip.
    const matchesStatus =
      statusFilter === "cancelled"
        ? r.status === "cancelled"
        : r.status !== "cancelled" &&
          (statusFilter === "all" || r.duesStatus === statusFilter);
    const matchesTicket =
      ticketFilter === "any" || r.hasTicket === (ticketFilter === "yes");
    const matchesTravel = travelFilter === "any" || r.carPass === travelFilter;
    const matchesJobs =
      jobsFilter === "any" ||
      (jobsFilter === "none" ? r.jobs.shiftCount === 0 : r.jobs.shiftCount > 0);
    const matchesDates =
      datesFilter === "any" ||
      (datesFilter === "set"
        ? !!r.arrivalDate
        : datesFilter === "unset"
          ? !r.arrivalDate
          : !!r.renoArrivalDate);
    return (
      matchesSearch && matchesStatus && matchesTicket && matchesTravel && matchesJobs && matchesDates
    );
  });

  // Chip counts: dues states over the active roster, cancelled separately.
  const activeRows = rows.filter((r) => r.status !== "cancelled");
  const chipCount = (s: RosterFilter) =>
    s === "all"
      ? activeRows.length
      : s === "cancelled"
        ? rows.length - activeRows.length
        : activeRows.filter((r) => r.duesStatus === s).length;

  function exportCsv() {
    const esc = (v: string | number | null) => {
      const s = v == null ? "" : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = [
      "Name", "Playa name", "Email", "Status", ...(isAdmin ? ["Dues"] : []), "Ticket", "Travel",
      "Arrival", "Departure", "Reno arrival", "Storage items", "Gear items",
      "Job shifts", "Job points",
      ...(isSuperAdmin ? ["Balance owed ($)"] : []),
    ];
    const lines = filteredRows.map((r) =>
      [
        r.name,
        r.playaName,
        r.email,
        r.status,
        ...(isAdmin ? [r.duesStatus ?? ""] : []),
        r.hasTicket ? "yes" : "no",
        TRAVEL_LABEL[r.carPass] ?? r.carPass,
        r.arrivalDate,
        r.departureDate,
        r.renoArrivalDate,
        r.storage.items.reduce((n, it) => n + it.quantity, 0),
        r.equipment.items.reduce((n, it) => n + it.quantity, 0),
        r.jobs.shiftCount,
        r.jobs.points,
        ...(isSuperAdmin ? [(r.balanceCents / 100).toFixed(2)] : []),
      ]
        .map(esc)
        .join(",")
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "node-2026-roster.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredApplications = applications.filter((a) => {
    const matchesSearch =
      !appSearch ||
      [a.first_name, a.last_name, a.playa_name, a.email]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(appSearch.toLowerCase()));
    const matchesStatus =
      appStatusFilter === "all" || a.status === appStatusFilter;
    return matchesSearch && matchesStatus;
  });

  // Stats
  const active = rows.filter((r) => r.status !== "cancelled");
  const confirmed = rows.filter((r) => r.status === "confirmed").length;
  const withTicket = rows.filter((r) => r.hasTicket).length;
  const outstanding = active.reduce((sum, r) => sum + r.balanceCents, 0);
  const appsPending = applications.filter((a) => a.status === "pending").length;
  const appsApproved = applications.filter((a) => a.status === "approved").length;
  const appsRejected = applications.filter((a) => a.status === "rejected").length;
  const appsWaitlisted = applications.filter(
    (a) => a.status === "waitlist"
  ).length;

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-sand-100">Reports</h1>
          <p className="mt-1 text-sand-400">Loading data…</p>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="glass-card border-0">
              <CardContent className="pt-6">
                <div className="h-8 w-20 animate-pulse rounded bg-pink-500/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-sand-100">Reports</h1>
        <p className="mt-1 text-sand-400">
          NODE 2026 roster — tap anyone to see everything they&apos;ve told us.
        </p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Nodes Registered",
            value: active.length,
            detail: `${confirmed} confirmed`,
            icon: Users,
            color: "text-pink-400",
          },
          {
            label: "2026 Campers",
            value: `${confirmed}/55`,
            detail: `${withTicket} with ticket`,
            icon: CheckCircle2,
            color: "text-emerald-400",
          },
          isSuperAdmin
            ? {
                label: "Outstanding",
                value: money(outstanding),
                detail: "across dues, storage, gear",
                icon: Wallet,
                color: "text-coral",
              }
            : {
                label: "With Ticket",
                value: withTicket,
                detail: `of ${confirmed} campers`,
                icon: Ticket,
                color: "text-coral",
              },
          isAdmin
            ? {
                label: "Applications",
                value: applications.length,
                detail: `${appsPending} pending`,
                icon: ListFilter,
                color: "text-golden",
              }
            : {
                label: "Dates Set",
                value: active.filter((r) => r.arrivalDate).length,
                detail: `of ${active.length} registered`,
                icon: CalendarDays,
                color: "text-golden",
              },
        ].map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Card className="glass-card border-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-sand-400">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-sand-100">
                  {stat.value}
                </div>
                <p className="mt-1 text-xs text-sand-500">{stat.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="roster">
        <TabsList className="bg-blue-950/50 border border-amber/10">
          <TabsTrigger
            value="roster"
            className="data-[state=active]:bg-amber/15 data-[state=active]:text-amber text-sand-400"
          >
            Roster
          </TabsTrigger>
          <TabsTrigger
            value="arrivals"
            className="data-[state=active]:bg-amber/15 data-[state=active]:text-amber text-sand-400"
          >
            Arrivals
          </TabsTrigger>
          {isAdmin && (
            <TabsTrigger
              value="applications"
              className="data-[state=active]:bg-amber/15 data-[state=active]:text-amber text-sand-400"
            >
              Applications
            </TabsTrigger>
          )}
        </TabsList>

        {/* Roster tab */}
        <TabsContent value="roster" className="mt-6 space-y-4">
          {rosterError ? (
            <Card className="glass-card border-0">
              <CardContent className="py-10 text-center text-sand-400">
                {rosterError === "Not authorized"
                  ? "Admin access required to view the camper roster."
                  : rosterError}
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-500" />
                  <Input
                    placeholder="Search by name, playa name, or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 bg-blue-950/30 border-amber/10 text-sand-200 placeholder:text-sand-600"
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {(
                    (isAdmin
                      ? ["all", "paid", "partial", "unpaid", "cancelled"]
                      : ["all"]) as RosterFilter[]
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`min-h-10 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
                        statusFilter === s
                          ? "bg-amber/15 text-amber"
                          : "text-sand-400 hover:bg-amber/5 hover:text-sand-200"
                      }`}
                    >
                      {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}{" "}
                      ({chipCount(s)})
                    </button>
                  ))}
                </div>
              </div>

              {/* Facet filters + export */}
              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={ticketFilter}
                  onValueChange={(v) => setTicketFilter(v as TicketFilter)}
                >
                  <SelectTrigger className="h-8 min-h-10 w-auto gap-1 border-amber/10 bg-blue-950/30 text-xs text-sand-300 sm:min-h-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Ticket: any</SelectItem>
                    <SelectItem value="yes">Has ticket</SelectItem>
                    <SelectItem value="no">No ticket</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={travelFilter}
                  onValueChange={(v) => setTravelFilter(v as TravelFilter)}
                >
                  <SelectTrigger className="h-8 min-h-10 w-auto gap-1 border-amber/10 bg-blue-950/30 text-xs text-sand-300 sm:min-h-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Travel: any</SelectItem>
                    <SelectItem value="ride_unsorted">Needs a ride</SelectItem>
                    <SelectItem value="ride_sorted">Ride sorted</SelectItem>
                    <SelectItem value="car_pass_parking">Car pass</SelectItem>
                    <SelectItem value="burner_express">Burner Express</SelectItem>
                    <SelectItem value="no">Not answered</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={jobsFilter}
                  onValueChange={(v) => setJobsFilter(v as JobsFilter)}
                >
                  <SelectTrigger className="h-8 min-h-10 w-auto gap-1 border-amber/10 bg-blue-950/30 text-xs text-sand-300 sm:min-h-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Jobs: any</SelectItem>
                    <SelectItem value="none">No shifts</SelectItem>
                    <SelectItem value="some">Has shifts</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={datesFilter}
                  onValueChange={(v) => setDatesFilter(v as DatesFilter)}
                >
                  <SelectTrigger className="h-8 min-h-10 w-auto gap-1 border-amber/10 bg-blue-950/30 text-xs text-sand-300 sm:min-h-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="any">Dates: any</SelectItem>
                    <SelectItem value="unset">Dates not set</SelectItem>
                    <SelectItem value="set">Dates set</SelectItem>
                    <SelectItem value="reno">Lands in Reno</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-auto h-8 text-xs text-sand-400 hover:text-sand-200"
                  onClick={exportCsv}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  Export CSV ({filteredRows.length})
                </Button>
              </div>

              {filteredRows.length === 0 ? (
                <Card className="glass-card border-0">
                  <CardContent className="py-10 text-center text-sand-500">
                    {rows.length === 0
                      ? "No registrations for 2026 yet."
                      : "No results match your filters."}
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Mobile: stacked cards */}
                  <div className="space-y-2 md:hidden">
                    {filteredRows.map((r) => (
                      <button
                        key={r.registrationId}
                        onClick={() => setDetailRow(r)}
                        className="flex w-full items-center gap-3 rounded-xl border border-amber/10 bg-blue-950/30 px-4 py-3 text-left transition-colors hover:bg-amber/5"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-sand-100">
                            {r.name}
                            {r.playaName ? (
                              <span className="ml-1 text-xs text-sand-500">
                                “{r.playaName}”
                              </span>
                            ) : null}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-sand-400">
                            {duesBadge(r)}
                            <span className="inline-flex items-center gap-1">
                              <TicketIcon has={r.hasTicket} />
                              <TravelCell value={r.carPass} />
                            </span>
                            <span className="whitespace-nowrap">
                              {fmtDate(r.arrivalDate)} → {fmtDate(r.departureDate)}
                            </span>
                            {isSuperAdmin && r.balanceCents > 0 && (
                              <span className="text-red-400">
                                {money(r.balanceCents)}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="h-4 w-4 shrink-0 text-sand-500" />
                      </button>
                    ))}
                  </div>

                  {/* Desktop: table */}
                  <Card className="glass-card border-0 overflow-hidden hidden md:block">
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-amber/10 hover:bg-transparent">
                            <TableHead className="text-sand-400">Name</TableHead>
                            {isAdmin && (
                              <TableHead className="text-sand-400">Dues</TableHead>
                            )}
                            <TableHead className="text-sand-400 text-center">
                              Ticket
                            </TableHead>
                            <TableHead className="text-sand-400 text-center">
                              Travel
                            </TableHead>
                            <TableHead className="text-sand-400">Dates</TableHead>
                            <TableHead className="text-sand-400 hidden lg:table-cell">
                              Storage
                            </TableHead>
                            <TableHead className="text-sand-400 hidden lg:table-cell">
                              Gear
                            </TableHead>
                            <TableHead className="text-sand-400 hidden lg:table-cell">
                              Jobs
                            </TableHead>
                            {isSuperAdmin && (
                              <TableHead className="text-sand-400">Balance</TableHead>
                            )}
                            <TableHead className="text-sand-400 text-right">
                              Details
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRows.map((r) => {
                            const gear = r.equipment.items.reduce(
                              (n, it) => n + it.quantity,
                              0
                            );
                            return (
                              <TableRow
                                key={r.registrationId}
                                className="cursor-pointer border-amber/10 hover:bg-amber/5"
                                onClick={() => setDetailRow(r)}
                              >
                                <TableCell className="font-medium text-sand-200">
                                  {r.name}
                                  {r.playaName ? (
                                    <span className="ml-1 text-xs text-sand-500">
                                      “{r.playaName}”
                                    </span>
                                  ) : null}
                                </TableCell>
                                {isAdmin && <TableCell>{duesBadge(r)}</TableCell>}
                                <TableCell className="text-center">
                                  <TicketIcon has={r.hasTicket} />
                                </TableCell>
                                <TableCell className="text-center">
                                  <TravelCell value={r.carPass} />
                                </TableCell>
                                <TableCell className="whitespace-nowrap text-sm text-sand-300">
                                  {fmtDate(r.arrivalDate)} → {fmtDate(r.departureDate)}
                                </TableCell>
                                <TableCell className="hidden text-sm text-sand-300 lg:table-cell">
                                  {r.storage.items.length > 0
                                    ? `${r.storage.items.reduce(
                                        (n, it) => n + it.quantity,
                                        0
                                      )} item(s)`
                                    : "—"}
                                </TableCell>
                                <TableCell className="hidden text-sm text-sand-300 lg:table-cell">
                                  {gear > 0 ? `${gear} item(s)` : "—"}
                                </TableCell>
                                <TableCell className="hidden text-sm text-sand-300 lg:table-cell">
                                  {r.jobs.shiftCount > 0
                                    ? `${r.jobs.points} pts`
                                    : "—"}
                                </TableCell>
                                {isSuperAdmin && (
                                  <TableCell className="text-sm font-semibold">
                                    {r.balanceCents > 0 ? (
                                      <span className="text-red-400">
                                        {money(r.balanceCents)}
                                      </span>
                                    ) : r.formsStarted ? (
                                      <span className="text-emerald-400">$0</span>
                                    ) : (
                                      <span className="text-sand-600">—</span>
                                    )}
                                  </TableCell>
                                )}
                                <TableCell className="text-right">
                                  <ChevronRight className="inline h-4 w-4 text-sand-500" />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </Card>
                </>
              )}

              <p className="text-xs text-sand-500">
                Showing {filteredRows.length} of {rows.length} registrations
              </p>
            </>
          )}
        </TabsContent>

        {/* Arrivals tab */}
        <TabsContent value="arrivals" className="mt-6">
          {rosterError ? (
            <Card className="glass-card border-0">
              <CardContent className="py-10 text-center text-sand-400">
                Sign in to view arrivals.
              </CardContent>
            </Card>
          ) : (
            <ArrivalsTab rows={rows} />
          )}
        </TabsContent>

        {/* Applications tab */}
        <TabsContent value="applications" className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Pending", count: appsPending, icon: Clock, color: "text-amber" },
              {
                label: "Approved",
                count: appsApproved,
                icon: CheckCircle2,
                color: "text-emerald-400",
              },
              {
                label: "Waitlisted",
                count: appsWaitlisted,
                icon: ListFilter,
                color: "text-blue-400",
              },
              {
                label: "Rejected",
                count: appsRejected,
                icon: XCircle,
                color: "text-red-400",
              },
            ].map((s) => (
              <div
                key={s.label}
                className="flex items-center gap-3 rounded-xl bg-blue-950/30 border border-amber/10 px-4 py-3"
              >
                <s.icon className={`h-4 w-4 ${s.color}`} />
                <div>
                  <p className="text-lg font-bold text-sand-100">{s.count}</p>
                  <p className="text-xs text-sand-400">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-500" />
              <Input
                placeholder="Search by name or email…"
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="pl-9 bg-blue-950/30 border-amber/10 text-sand-200 placeholder:text-sand-600"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {["all", "pending", "approved", "waitlist", "rejected"].map((s) => (
                <button
                  key={s}
                  onClick={() => setAppStatusFilter(s)}
                  className={`min-h-10 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors sm:min-h-0 ${
                    appStatusFilter === s
                      ? "bg-amber/15 text-amber"
                      : "text-sand-400 hover:bg-amber/5 hover:text-sand-200"
                  }`}
                >
                  {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <Card className="glass-card border-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber/10 hover:bg-transparent">
                    <TableHead className="text-sand-400">Name</TableHead>
                    <TableHead className="text-sand-400 hidden sm:table-cell">
                      Playa Name
                    </TableHead>
                    <TableHead className="text-sand-400 hidden md:table-cell">
                      Email
                    </TableHead>
                    <TableHead className="text-sand-400">Status</TableHead>
                    <TableHead className="text-sand-400 hidden lg:table-cell">
                      Applied
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.length === 0 ? (
                    <TableRow className="border-amber/10">
                      <TableCell
                        colSpan={5}
                        className="py-8 text-center text-sand-500"
                      >
                        {applications.length === 0
                          ? "No applications yet."
                          : "No results match your filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredApplications.map((a) => (
                      <TableRow
                        key={a.id}
                        className="border-amber/10 hover:bg-amber/5"
                      >
                        <TableCell className="text-sand-200 font-medium">
                          {a.first_name} {a.last_name}
                        </TableCell>
                        <TableCell className="text-sand-300 hidden sm:table-cell">
                          {a.playa_name || "—"}
                        </TableCell>
                        <TableCell className="text-sand-400 hidden md:table-cell">
                          {a.email}
                        </TableCell>
                        <TableCell>{statusBadge(a.status)}</TableCell>
                        <TableCell className="text-sand-400 text-xs hidden lg:table-cell">
                          {new Date(a.created_at).toLocaleDateString()}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <p className="text-xs text-sand-500">
            Showing {filteredApplications.length} of {applications.length}{" "}
            applications
          </p>
        </TabsContent>
      </Tabs>

      {/* Per-camper detail */}
      <DetailModal
        row={detailRow}
        isSuperAdmin={isSuperAdmin}
        onClose={() => setDetailRow(null)}
        isAdmin={isAdmin}
        onCancelRegistration={(r) => setCancelTarget(r)}
      />

      {/* Cancel confirmation */}
      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o && !cancelling) setCancelTarget(null);
        }}
      >
        <DialogContent className="glass border-red-500/15 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sand-100">
              <Ban className="h-5 w-5 text-red-400" />
              Cancel {cancelTarget?.name}?
            </DialogTitle>
            <DialogDescription className="text-sand-400">
              This marks their 2026 registration <strong>cancelled</strong>,
              releases any reserved gear back into inventory, and voids their
              unpaid invoices. Money already paid is left alone — refund it
              manually in Stripe if needed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:gap-3">
            <Button
              variant="ghost"
              className="text-sand-400 hover:text-sand-200"
              disabled={cancelling}
              onClick={() => setCancelTarget(null)}
            >
              Keep registration
            </Button>
            <Button
              className="flex-1 bg-red-500 text-white hover:bg-red-600"
              disabled={cancelling}
              onClick={handleCancel}
            >
              {cancelling && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {cancelling ? "Cancelling…" : "Cancel registration"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
