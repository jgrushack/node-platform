"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Flame,
  Shield,
  CalendarDays,
  CreditCard,
  Users,
  FileText,
  CheckCircle2,
  AlertCircle,
  FileCheck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bmCalendarEvents } from "@/lib/data/bm-calendar";

interface UserData {
  firstName: string;
  role: string;
}

interface AppCounts {
  newCount: number;
  needsResponse: number;
}

type CampStatusLabel = "Unknown" | "Undecided" | "Approved" | "Attending";
type PaymentState = "unpaid" | "partial" | "paid" | null;

interface CampStatus {
  label: CampStatusLabel;
  payment: PaymentState;
}

function getStatusColor(status: CampStatus): string {
  if (status.label === "Attending") {
    if (status.payment === "paid") return "text-green-400";
    if (status.payment === "partial") return "text-yellow-400";
    return "text-red-400";
  }
  return "text-sand-400";
}

function getStatusIconColor(status: CampStatus): string {
  if (status.label === "Attending") {
    if (status.payment === "paid") return "text-green-400";
    if (status.payment === "partial") return "text-yellow-400";
    return "text-red-400";
  }
  if (status.label === "Approved") return "text-amber";
  return "text-sand-500";
}

function getStatusDisplay(status: CampStatus): string {
  if (status.label !== "Attending") return status.label;
  if (status.payment === "paid") return "Attending";
  if (status.payment === "partial") return "Attending";
  return "Attending";
}

function getStatusSubtext(status: CampStatus): string | null {
  if (status.label !== "Attending") return null;
  if (status.payment === "paid") return "Paid";
  if (status.payment === "partial") return "Partial Payment";
  return "Unpaid";
}

const FILTERED_BM_KEYWORDS = ["office hours", "campfire talk"];

function formatEventDate(dateStr: string, tz: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: tz,
  });
}

function getUpcomingBmEvents(tz: string) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  return bmCalendarEvents
    .filter((e) => {
      const endDate = e.end || e.start;
      if (endDate < todayStr) return false;
      const lower = e.title.toLowerCase();
      return !FILTERED_BM_KEYWORDS.some((kw) => lower.includes(kw));
    })
    .sort((a, b) => a.start.localeCompare(b.start))
    .slice(0, 10)
    .map((e) => {
      const dateLabel = e.end
        ? `${formatEventDate(e.start, tz)} – ${formatEventDate(e.end, tz)}`
        : formatEventDate(e.start, tz);
      return { date: dateLabel, label: e.title };
    });
}

// NODE-specific events — placeholder until wired to a real source
const nodeEvents = [
  { date: "TBD", label: "NODE Town Hall" },
  { date: "TBD", label: "Dues Deadline" },
  { date: "TBD", label: "Build Week Planning" },
];

const documents = [
  { label: "Camp Agreement", done: false },
  { label: "Liability Waiver", done: false },
  { label: "Emergency Contact Form", done: false },
  { label: "Ticket Proof of Purchase", done: false },
  { label: "Vehicle Pass (if applicable)", done: false },
];

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [appCounts, setAppCounts] = useState<AppCounts | null>(null);
  const [totalCampers, setTotalCampers] = useState<number | null>(null);
  const [campStatus, setCampStatus] = useState<CampStatus | null>(null);
  const [yearsAtNode, setYearsAtNode] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);

  const userTz = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    []
  );
  const upcomingBmEvents = useMemo(() => getUpcomingBmEvents(userTz), [userTz]);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      const name =
        authUser.user_metadata?.full_name ||
        authUser.email?.split("@")[0] ||
        "there";

      supabase
        .from("profiles")
        .select("role")
        .eq("id", authUser.id)
        .single()
        .then(({ data: profile }) => {
          const realRole = profile?.role || "member";
          // Support view-as mode for super_admins
          const viewAs = localStorage.getItem("viewAsRole");
          const role =
            viewAs && realRole === "super_admin" ? viewAs : realRole;
          setUser({ firstName: name.split(" ")[0], role });

          // Fetch 2026 camp status
          supabase
            .from("camp_years")
            .select("id")
            .eq("year", 2026)
            .single()
            .then(({ data: campYear }) => {
              if (!campYear) {
                setCampStatus({ label: "Unknown", payment: null });
                return;
              }

              // Check registration
              supabase
                .from("registrations")
                .select("status")
                .eq("profile_id", authUser.id)
                .eq("camp_year_id", campYear.id)
                .single()
                .then(({ data: reg }) => {
                  if (reg && reg.status === "confirmed") {
                    // Registration confirmed — check invoices for payment state
                    supabase
                      .from("invoices")
                      .select("amount_cents, amount_paid_cents, status")
                      .eq("profile_id", authUser.id)
                      .eq("camp_year_id", campYear.id)
                      .then(({ data: invoices }) => {
                        if (!invoices || invoices.length === 0) {
                          setCampStatus({ label: "Approved", payment: null });
                          setBalance(0);
                          return;
                        }
                        const totalOwed = invoices.reduce((s, i) => s + i.amount_cents, 0);
                        const totalPaid = invoices.reduce((s, i) => s + i.amount_paid_cents, 0);
                        setBalance(Math.max(0, totalOwed - totalPaid));
                        let payment: PaymentState = "unpaid";
                        if (totalPaid >= totalOwed) payment = "paid";
                        else if (totalPaid > 0) payment = "partial";
                        setCampStatus({ label: "Attending", payment });
                      });
                  } else if (reg) {
                    // Registration exists but not confirmed (pending/waitlisted)
                    setCampStatus({ label: "Undecided", payment: null });
                  } else {
                    // No registration — check application
                    supabase
                      .from("applications")
                      .select("status")
                      .eq("email", authUser.email!)
                      .order("created_at", { ascending: false })
                      .limit(1)
                      .maybeSingle()
                      .then(({ data: app }) => {
                        if (app?.status === "approved") {
                          setCampStatus({ label: "Approved", payment: null });
                        } else if (app) {
                          setCampStatus({ label: "Undecided", payment: null });
                        } else {
                          setCampStatus({ label: "Unknown", payment: null });
                        }
                      });
                  }
                });
            });

          // Fetch application counts for committee/admin/super_admin
          if (["committee", "admin", "super_admin"].includes(role)) {
            supabase
              .from("applications")
              .select("status", { count: "exact", head: false })
              .then(({ data: apps }) => {
                if (apps) {
                  const newCount = apps.filter((a) => a.status === "pending").length;
                  const needsResponse = apps.filter(
                    (a) => a.status === "pending" || a.status === "waitlist"
                  ).length;
                  setAppCounts({ newCount, needsResponse });
                }
              });
          }

          // Fetch total campers for super_admin
          if (role === "super_admin") {
            supabase
              .from("profiles")
              .select("id", { count: "exact", head: true })
              .then(({ count }) => {
                setTotalCampers(count ?? 0);
              });
          }

          // Fetch years at NODE
          supabase
            .from("registrations")
            .select("camp_years(year)")
            .eq("profile_id", authUser.id)
            .eq("status", "confirmed")
            .then(({ data: regs }) => {
              if (regs) {
                setYearsAtNode(
                  regs
                    .map((r: any) => r.camp_years?.year)
                    .filter(Boolean).length
                );
              }
            });
        });
    });
  }, []);

  const isCommittee =
    user && ["committee", "admin", "super_admin"].includes(user.role);
  const isSuperAdmin = user?.role === "super_admin";
  const canSeeBmEvents =
    user && ["lead", "admin", "super_admin"].includes(user.role);

  // Build attention items
  const attentionItems: { label: string; urgent: boolean }[] = [];
  if (appCounts && appCounts.newCount > 0) {
    attentionItems.push({
      label: `${appCounts.newCount} new application${appCounts.newCount > 1 ? "s" : ""} to review`,
      urgent: true,
    });
  }
  // Placeholder attention items — these would come from real data
  const incompleteDocs = documents.filter((d) => !d.done).length;
  if (incompleteDocs > 0) {
    attentionItems.push({
      label: `${incompleteDocs} document${incompleteDocs > 1 ? "s" : ""} still need to be completed`,
      urgent: false,
    });
  }

  const statusDisplay = campStatus ? getStatusDisplay(campStatus) : "—";
  const statusSubtext = campStatus ? getStatusSubtext(campStatus) : null;
  const statusIconColor = campStatus
    ? getStatusIconColor(campStatus)
    : "text-sand-500";
  const statusValueColor = campStatus
    ? getStatusColor(campStatus)
    : "text-sand-400";

  const stats = [
    {
      label: "Years at Node",
      value: yearsAtNode !== null ? String(yearsAtNode) : "—",
      icon: Flame,
      color: "text-pink-400",
      valueColor: "text-sand-100",
      subtext: null as string | null,
    },
    {
      label: "2026 Status",
      value: statusDisplay,
      icon: Shield,
      color: statusIconColor,
      valueColor: statusValueColor,
      subtext: statusSubtext,
    },
    {
      label: "Next Event",
      value: "TBD",
      icon: CalendarDays,
      color: "text-coral",
      valueColor: "text-sand-100",
      subtext: null as string | null,
    },
    {
      label: "Balance",
      value:
        balance !== null
          ? `$${(balance / 100).toLocaleString("en-US", {
              minimumFractionDigits: 2,
            })}`
          : "—",
      icon: CreditCard,
      color: "text-golden",
      valueColor: "text-sand-100",
      subtext: null as string | null,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">
          Welcome back{user ? `, ${user.firstName}` : ""}
        </h1>
        <p className="mt-1 text-sand-400">
          Here&apos;s your NODE dashboard.
        </p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: i * 0.1 }}
          >
            <Card className="glass-card border-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-sand-400">
                  {stat.label}
                </CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-xl sm:text-2xl font-bold ${stat.valueColor}`}>
                  {stat.value}
                </div>
                {stat.subtext && (
                  <p className={`text-xs mt-0.5 ${stat.valueColor}`}>
                    {stat.subtext}
                  </p>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Role-based sections: Applications + Total Campers */}
      {(isCommittee || isSuperAdmin) && (
        <div className={`grid gap-4 ${isSuperAdmin ? "sm:grid-cols-2" : ""}`}>
          {/* Applications — committee/admin/super_admin */}
          {isCommittee && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-sand-400">
                    Applications
                  </CardTitle>
                  <FileText className="h-4 w-4 text-pink-400" />
                </CardHeader>
                <CardContent>
                  {appCounts ? (
                    <div className="flex items-baseline gap-4">
                      <div>
                        <span className="text-2xl font-bold text-sand-100">
                          {appCounts.newCount}
                        </span>
                        <span className="ml-1.5 text-sm text-sand-400">new</span>
                      </div>
                      <div>
                        <span className="text-2xl font-bold text-sand-100">
                          {appCounts.needsResponse}
                        </span>
                        <span className="ml-1.5 text-sm text-sand-400">needs response</span>
                      </div>
                    </div>
                  ) : (
                    <div className="h-8 w-32 animate-pulse rounded bg-pink-500/10" />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Total Campers — super_admin only */}
          {isSuperAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-sand-400">
                    Total Campers
                  </CardTitle>
                  <Users className="h-4 w-4 text-amber" />
                </CardHeader>
                <CardContent>
                  {totalCampers !== null ? (
                    <div className="text-2xl font-bold text-sand-100">
                      {totalCampers}
                    </div>
                  ) : (
                    <div className="h-8 w-16 animate-pulse rounded bg-pink-500/10" />
                  )}
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      )}

      {/* Requires Attention */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
      >
        <Card className="glass-card border-0">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-sand-400">
              Requires Attention
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-coral" />
          </CardHeader>
          <CardContent>
            {attentionItems.length === 0 ? (
              <div className="flex items-center gap-3 py-2">
                <CheckCircle2 className="h-5 w-5 text-green-400" />
                <p className="text-sm text-sand-200">
                  You&apos;re all good to go!
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {attentionItems.map((item) => (
                  <li
                    key={item.label}
                    className="flex items-center gap-3 text-sm"
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        item.urgent ? "bg-coral" : "bg-amber"
                      }`}
                    />
                    <span className="text-sand-200">{item.label}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Upcoming Burning Man Events — lead/admin/super_admin only */}
      {canSeeBmEvents && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sand-200">
                <Flame className="h-4 w-4 text-amber" />
                Upcoming Burning Man Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {upcomingBmEvents.length === 0 ? (
                <p className="py-2 text-sm text-sand-400">
                  No upcoming Burning Man events.
                </p>
              ) : (
                <ul className="space-y-3">
                  {upcomingBmEvents.map((event) => (
                    <li key={event.label} className="flex items-start gap-3">
                      <span className="w-20 sm:w-28 flex-shrink-0 text-xs font-medium text-sand-400 pt-0.5">
                        {event.date}
                      </span>
                      <span className="text-sm text-sand-200">
                        {event.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Bottom grid: Upcoming NODE Events + Documents */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Upcoming Events (NODE) */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sand-200">
                <CalendarDays className="h-4 w-4 text-pink-400" />
                Upcoming Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              {nodeEvents.length === 0 ? (
                <p className="py-2 text-sm text-sand-400">
                  No upcoming events.
                </p>
              ) : (
                <ul className="space-y-3">
                  {nodeEvents.map((event) => (
                    <li key={event.label} className="flex items-start gap-3">
                      <span className="w-20 sm:w-28 flex-shrink-0 text-xs font-medium text-sand-400 pt-0.5">
                        {event.date}
                      </span>
                      <span className="text-sm text-sand-200">
                        {event.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Documents */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sand-200">
                <FileCheck className="h-4 w-4 text-pink-400" />
                Documents
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {documents.map((doc) => (
                  <li key={doc.label} className="flex items-center gap-3">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        doc.done
                          ? "bg-green-500/20 text-green-400"
                          : "bg-sand-700/30 text-sand-500"
                      }`}
                    >
                      {doc.done ? "✓" : ""}
                    </span>
                    <span
                      className={`text-sm ${
                        doc.done ? "text-sand-400 line-through" : "text-sand-200"
                      }`}
                    >
                      {doc.label}
                    </span>
                    {!doc.done && (
                      <Badge className="ml-auto bg-sand-700/30 text-sand-400 text-[10px]">
                        Incomplete
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
