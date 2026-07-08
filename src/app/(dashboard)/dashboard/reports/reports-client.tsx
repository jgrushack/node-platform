"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
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
  ChevronDown,
  ChevronRight,
  Ban,
  Loader2,
  Wallet,
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

/** Owed (red) / paid (green) / nothing (dash) cell. */
function BalanceCell({ owed, paid }: { owed: number; paid: number }) {
  if (owed > 0) return <span className="text-red-400">{money(owed)}</span>;
  if (paid > 0) return <span className="text-emerald-400">Paid</span>;
  return <span className="text-sand-600">—</span>;
}

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
        <span
          title={title}
          className="inline-flex items-center text-emerald-400"
        >
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

export default function ReportsClient() {
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [rosterError, setRosterError] = useState<string | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<RosterFilter>("all");
  const [appSearch, setAppSearch] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
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

  const statusBadge = (status: string) => {
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
  };

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
          NODE 2026 roster — who&apos;s in, what they&apos;ve reserved, and what
          they owe.
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
          {
            label: "Outstanding",
            value: money(outstanding),
            detail: "across dues, storage, gear",
            icon: Wallet,
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

              <Card className="glass-card border-0 overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-amber/10 hover:bg-transparent">
                        <TableHead className="text-sand-400 w-8"></TableHead>
                        <TableHead className="text-sand-400">Name</TableHead>
                        <TableHead className="text-sand-400">Status</TableHead>
                        <TableHead className="text-sand-400 text-center">
                          Ticket
                        </TableHead>
                        <TableHead className="text-sand-400 text-center">
                          Travel
                        </TableHead>
                        <TableHead className="text-sand-400 hidden md:table-cell">
                          Dates
                        </TableHead>
                        <TableHead className="text-sand-400 hidden lg:table-cell">
                          Dues
                        </TableHead>
                        <TableHead className="text-sand-400 hidden lg:table-cell">
                          Storage
                        </TableHead>
                        <TableHead className="text-sand-400 hidden lg:table-cell">
                          Gear
                        </TableHead>
                        <TableHead className="text-sand-400 hidden xl:table-cell">
                          Jobs
                        </TableHead>
                        <TableHead className="text-sand-400">Balance</TableHead>
                        <TableHead className="text-sand-400 text-right">
                          Actions
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.length === 0 ? (
                        <TableRow className="border-amber/10">
                          <TableCell
                            colSpan={12}
                            className="py-8 text-center text-sand-500"
                          >
                            {rows.length === 0
                              ? "No registrations for 2026 yet."
                              : "No results match your filters."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredRows.map((r) => {
                          const isOpen = expanded === r.registrationId;
                          const cancelled = r.status === "cancelled";
                          return (
                            <Fragment key={r.registrationId}>
                              <TableRow className="border-amber/10 hover:bg-amber/5">
                                <TableCell className="align-top">
                                  <button
                                    onClick={() =>
                                      setExpanded(
                                        isOpen ? null : r.registrationId
                                      )
                                    }
                                    className="text-sand-500 hover:text-sand-200"
                                    aria-label={isOpen ? "Collapse" : "Expand"}
                                  >
                                    {isOpen ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                </TableCell>
                                <TableCell className="text-sand-200 font-medium">
                                  {r.name}
                                  {r.playaName ? (
                                    <span className="ml-1 text-xs text-sand-500">
                                      “{r.playaName}”
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell>{statusBadge(r.status)}</TableCell>
                                <TableCell className="text-center">
                                  {r.hasTicket ? (
                                    <CheckCircle2
                                      className="inline h-4 w-4 text-emerald-400"
                                      aria-label="Has ticket"
                                    />
                                  ) : (
                                    <XCircle
                                      className="inline h-4 w-4 text-sand-600"
                                      aria-label="No ticket"
                                    />
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <TravelCell value={r.carPass} />
                                </TableCell>
                                <TableCell className="text-sand-300 text-sm hidden md:table-cell whitespace-nowrap">
                                  {fmtDate(r.arrivalDate)} → {fmtDate(r.departureDate)}
                                </TableCell>
                                <TableCell className="text-sm hidden lg:table-cell">
                                  <BalanceCell
                                    owed={r.dues.owedCents}
                                    paid={r.dues.paidCents}
                                  />
                                </TableCell>
                                <TableCell className="text-sm hidden lg:table-cell">
                                  <BalanceCell
                                    owed={r.storage.owedCents}
                                    paid={r.storage.paidCents}
                                  />
                                </TableCell>
                                <TableCell className="text-sm hidden lg:table-cell text-sand-300">
                                  {r.equipment.items.length > 0
                                    ? `${r.equipment.items.reduce(
                                        (n, it) => n + it.quantity,
                                        0
                                      )} item${
                                        r.equipment.items.reduce(
                                          (n, it) => n + it.quantity,
                                          0
                                        ) === 1
                                          ? ""
                                          : "s"
                                      }`
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-sm hidden xl:table-cell text-sand-300">
                                  {r.jobs.shiftCount > 0
                                    ? `${r.jobs.points} pts`
                                    : "—"}
                                </TableCell>
                                <TableCell className="text-sm font-semibold">
                                  {r.balanceCents > 0 ? (
                                    <span className="text-red-400">
                                      {money(r.balanceCents)}
                                    </span>
                                  ) : (
                                    <span className="text-emerald-400">$0</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {!cancelled && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      title="Cancel registration"
                                      aria-label="Cancel registration"
                                      className="h-8 w-8 text-red-400/80 hover:bg-red-500/10 hover:text-red-300"
                                      onClick={() => setCancelTarget(r)}
                                    >
                                      <Ban className="h-4 w-4" />
                                    </Button>
                                  )}
                                </TableCell>
                              </TableRow>

                              {isOpen && (
                                <TableRow className="border-amber/10 bg-blue-950/20 hover:bg-blue-950/20">
                                  <TableCell colSpan={12} className="py-4">
                                    <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                                      <div>
                                        <p className="text-xs uppercase tracking-wide text-sand-500">
                                          Contact
                                        </p>
                                        <p className="mt-1 text-sand-300">
                                          {r.email ?? "—"}
                                        </p>
                                        <p className="mt-2 flex items-center gap-3 text-xs text-sand-400">
                                          <span className="inline-flex items-center gap-1">
                                            <Ticket className="h-3.5 w-3.5" />
                                            {r.hasTicket ? "Ticket" : "No ticket"}
                                          </span>
                                          <span className="inline-flex items-center gap-1">
                                            <TravelCell value={r.carPass} />
                                            {TRAVEL_LABEL[r.carPass] ?? "Not answered"}
                                          </span>
                                        </p>
                                      </div>
                                      <div>
                                        <p className="text-xs uppercase tracking-wide text-sand-500">
                                          Storage
                                        </p>
                                        <p className="mt-1 text-sand-300">
                                          {r.storage.summary ?? "No items stored"}
                                        </p>
                                        {r.storage.owedCents > 0 && (
                                          <p className="mt-1 text-xs text-red-400">
                                            {money(r.storage.owedCents)} owed
                                          </p>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-xs uppercase tracking-wide text-sand-500">
                                          Gear reserved
                                        </p>
                                        {r.equipment.items.length > 0 ? (
                                          <ul className="mt-1 space-y-0.5 text-sand-300">
                                            {r.equipment.items.map((it, idx) => (
                                              <li key={idx}>
                                                {it.quantity}× {it.label}
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <p className="mt-1 text-sand-500">—</p>
                                        )}
                                        {r.equipment.owedCents > 0 && (
                                          <p className="mt-1 text-xs text-red-400">
                                            {money(r.equipment.owedCents)} owed
                                          </p>
                                        )}
                                      </div>
                                      <div>
                                        <p className="text-xs uppercase tracking-wide text-sand-500">
                                          Dues &amp; jobs
                                        </p>
                                        <p className="mt-1 text-sand-300">
                                          Dues:{" "}
                                          {r.dues.owedCents > 0
                                            ? `${money(r.dues.owedCents)} owed`
                                            : r.dues.paidCents > 0
                                              ? `${money(r.dues.paidCents)} paid`
                                              : "not started"}
                                        </p>
                                        <p className="mt-1 text-sand-300">
                                          {r.jobs.shiftCount > 0
                                            ? `${r.jobs.shiftCount} shift${
                                                r.jobs.shiftCount === 1 ? "" : "s"
                                              } · ${r.jobs.points} pts`
                                            : "No shifts signed up"}
                                        </p>
                                      </div>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </Fragment>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </Card>

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
                    <TableHead className="text-sand-400 hidden lg:table-cell">
                      Reviewed
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredApplications.length === 0 ? (
                    <TableRow className="border-amber/10">
                      <TableCell
                        colSpan={6}
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
                        <TableCell className="text-sand-400 text-xs hidden lg:table-cell">
                          {a.reviewed_at
                            ? new Date(a.reviewed_at).toLocaleDateString()
                            : "—"}
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

          {cancelTarget && (
            <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-sand-300">
              {cancelTarget.equipment.items.length > 0 ? (
                <p>
                  Frees{" "}
                  <span className="text-sand-100">
                    {cancelTarget.equipment.items.reduce(
                      (n, it) => n + it.quantity,
                      0
                    )}{" "}
                    gear item(s)
                  </span>{" "}
                  back to inventory.
                </p>
              ) : (
                <p>No reserved gear to release.</p>
              )}
              {cancelTarget.balanceCents > 0 ? (
                <p className="mt-1">
                  Voids{" "}
                  <span className="text-sand-100">
                    {money(cancelTarget.balanceCents)}
                  </span>{" "}
                  in unpaid balance.
                </p>
              ) : null}
            </div>
          )}

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
