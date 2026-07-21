"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Car,
  Bus,
  Ticket,
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
} from "lucide-react";
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

type RosterFilter = "all" | "confirmed" | "pending" | "waitlisted" | "cancelled";

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
      <span className="text-right text-sand-200">{value || "—"}</span>
    </div>
  );
}

function DetailModal({
  row,
  isSuperAdmin,
  onClose,
  onCancelRegistration,
}: {
  row: ReportRow | null;
  isSuperAdmin: boolean;
  onClose: () => void;
  onCancelRegistration: (row: ReportRow) => void;
}) {
  if (!row) return null;
  const gearCount = row.equipment.items.reduce((n, it) => n + it.quantity, 0);

  return (
    <Dialog open={!!row} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass border-pink-500/10 max-h-[90vh] overflow-y-auto sm:max-w-lg">
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
          <DialogDescription className="text-sand-400">
            {row.email ?? "no email on file"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
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
            <Field
              label="Emergency contact"
              value={row.profile.emergencyContact}
            />
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

          {row.status !== "cancelled" && (
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

// ── Main ─────────────────────────────────────────────────────────────

export default function ReportsClient() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RosterFilter>("all");
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
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadRoster();
      const supabase = createClient();
      const { data: apps } = await supabase
        .from("applications")
        .select(
          "id, first_name, last_name, email, playa_name, status, created_at, reviewed_at"
        )
        .order("created_at", { ascending: false });
      if (apps) setApplications(apps as ApplicationRow[]);
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
    const matchesStatus = statusFilter === "all" || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          {
            label: "Applications",
            value: applications.length,
            detail: `${appsPending} pending`,
            icon: ListFilter,
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
            value="applications"
            className="data-[state=active]:bg-amber/15 data-[state=active]:text-amber text-sand-400"
          >
            Applications
          </TabsTrigger>
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
                    [
                      "all",
                      "confirmed",
                      "pending",
                      "waitlisted",
                      "cancelled",
                    ] as RosterFilter[]
                  ).map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatusFilter(s)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                        statusFilter === s
                          ? "bg-amber/15 text-amber"
                          : "text-sand-400 hover:bg-amber/5 hover:text-sand-200"
                      }`}
                    >
                      {s === "all" ? "All" : s.charAt(0).toUpperCase() + s.slice(1)}
                    </button>
                  ))}
                </div>
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
                            {statusBadge(r.status)}
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
                            <TableHead className="text-sand-400">Status</TableHead>
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
                                <TableCell>{statusBadge(r.status)}</TableCell>
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
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
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

          <div className="flex gap-3 pt-1">
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
