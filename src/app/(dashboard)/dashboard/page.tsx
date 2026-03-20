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
  Instagram,
  Megaphone,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { bmCalendarEvents } from "@/lib/data/bm-calendar";
import { OnboardingChecklist } from "@/components/onboarding/onboarding-checklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Lock, Loader2 as Spinner, Ticket, HandHeart } from "lucide-react";
import { updateTicketStatus } from "@/lib/actions/registrations";
import { requestCommitteeMembership, getMyCommitteeRequest } from "@/lib/actions/applications";

interface UserData {
  firstName: string;
  role: string;
  isCommitteeMember: boolean;
}

interface AppCounts {
  newCount: number;
  needsResponse: number;
}

type CampStatusLabel = "Unknown" | "Undecided" | "Approved" | "Attending" | "Not Attending";
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
  if (status.label === "Not Attending") return "text-sand-500";
  return "text-sand-400";
}

function getStatusIconColor(status: CampStatus): string {
  if (status.label === "Attending") {
    if (status.payment === "paid") return "text-green-400";
    if (status.payment === "partial") return "text-yellow-400";
    return "text-red-400";
  }
  if (status.label === "Approved") return "text-amber";
  if (status.label === "Not Attending") return "text-sand-600";
  return "text-sand-500";
}

function getStatusDisplay(status: CampStatus): string {
  if (status.label === "Not Attending") return "Not Attending";
  if (status.label !== "Attending") return status.label;
  return "Attending";
}

function getStatusSubtext(status: CampStatus): string | null {
  if (status.label !== "Attending") return null;
  if (status.payment === "paid") return "Paid";
  if (status.payment === "partial") return "Partial Payment";
  return "Unpaid";
}

const BUDGET_EMBED_URL =
  "https://docs.google.com/spreadsheets/d/1r-21HgEud7MnJqEanASO2JaC7AEJyav19bbEEJ97Abo/htmlview?widget=true";

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

const documents: { label: string; type: "action" | "view"; comingSoon: boolean }[] = [
  { label: "Camp Agreement / Liability", type: "action", comingSoon: true },
  { label: "Ticket Purchased Questionnaire", type: "action", comingSoon: true },
  { label: "Budget", type: "view", comingSoon: false },
];

export default function DashboardPage() {
  const [user, setUser] = useState<UserData | null>(null);
  const [appCounts, setAppCounts] = useState<AppCounts | null>(null);
  const [totalCampers, setTotalCampers] = useState<number | null>(null);
  const [campStatus, setCampStatus] = useState<CampStatus | null>(null);
  const [yearsAtNode, setYearsAtNode] = useState<number | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [hasTicket, setHasTicket] = useState<boolean | null>(null);
  const [hasCarPass, setHasCarPass] = useState<boolean | null>(null);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showTicketPopup, setShowTicketPopup] = useState(false);
  const [savingTicket, setSavingTicket] = useState(false);
  const [showCommitteePopup, setShowCommitteePopup] = useState(false);
  const [savingCommittee, setSavingCommittee] = useState(false);
  const [committeeRequestStatus, setCommitteeRequestStatus] = useState<string | null>(null);
  const [budgetOpen, setBudgetOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

      // Prompt password setup if user hasn't set one yet
      if (!authUser.user_metadata?.password_set) {
        setShowPasswordDialog(true);
      }

      supabase
        .from("profiles")
        .select("role, onboarding_completed_at, is_committee_member")
        .eq("id", authUser.id)
        .single()
        .then(({ data: profile }) => {
          const realRole = profile?.role || "member";
          setOnboardingComplete(!!profile?.onboarding_completed_at);
          // Support view-as mode for super_admins
          const viewAs = localStorage.getItem("viewAsRole");
          const role =
            viewAs && realRole === "super_admin" ? viewAs : realRole;
          setUser({ firstName: name.split(" ")[0], role, isCommitteeMember: !!profile?.is_committee_member });

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
                .select("status, has_ticket, has_car_pass")
                .eq("profile_id", authUser.id)
                .eq("camp_year_id", campYear.id)
                .maybeSingle()
                .then(({ data: reg }) => {
                  if (reg && reg.status === "confirmed") {
                    setHasTicket(!!reg.has_ticket);
                    setHasCarPass(!!reg.has_car_pass);
                    // Check if ticket sale popup should show
                    const now = Date.now();
                    const saleStart = Date.UTC(2026, 2, 4, 7, 0, 0); // Mar 4 00:00 PDT
                    const saleEnd = Date.UTC(2026, 2, 11, 19, 0, 0); // Mar 11 12:00 PDT
                    if (!reg.has_ticket && now >= saleStart && now <= saleEnd) {
                      setShowTicketPopup(true);
                    }
                    // Registration confirmed — check invoices for payment state
                    supabase
                      .from("invoices")
                      .select("amount_cents, amount_paid_cents, status")
                      .eq("profile_id", authUser.id)
                      .eq("camp_year_id", campYear.id)
                      .then(({ data: invoices }) => {
                        if (!invoices || invoices.length === 0) {
                          setCampStatus({ label: "Attending", payment: null });
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
                  } else if (reg && reg.status === "cancelled") {
                    setCampStatus({ label: "Not Attending", payment: null });
                  } else if (reg) {
                    // Registration exists but not confirmed (pending/waitlisted)
                    setCampStatus({ label: "Undecided", payment: null });
                  } else {
                    // No registration yet
                    setCampStatus({ label: "Undecided", payment: null });
                  }
                });
            });

          // Show committee popup for non-committee members who haven't requested yet
          if (!profile?.is_committee_member) {
            getMyCommitteeRequest().then((result) => {
              if (result && "error" in result) return;
              if (!result) {
                // No existing request — check if user previously dismissed
                const dismissed = localStorage.getItem("committeePopupDismissed");
                if (!dismissed) {
                  setShowCommitteePopup(true);
                }
              } else {
                setCommitteeRequestStatus(result.status);
              }
            });
          }

          // Fetch application counts for committee members or admins
          if (profile?.is_committee_member || ["admin", "super_admin"].includes(role)) {
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

          // Fetch 2026 campers (confirmed registrations) for super_admin
          if (role === "super_admin") {
            supabase
              .from("camp_years")
              .select("id")
              .eq("year", 2026)
              .single()
              .then(({ data: cy }) => {
                if (!cy) { setTotalCampers(0); return; }
                supabase
                  .from("registrations")
                  .select("id", { count: "exact", head: true })
                  .eq("camp_year_id", cy.id)
                  .eq("status", "confirmed")
                  .then(({ count }) => {
                    setTotalCampers(count ?? 0);
                  });
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
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((r: any) => r.camp_years?.year)
                    .filter(Boolean).length
                );
              }
            });
        });
    });
  }, []);

  const isCommittee =
    user && (user.isCommitteeMember || ["admin", "super_admin"].includes(user.role));
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
  // Documents attention items — will be enabled when docs are completable
  const actionDocs = documents.filter((d) => d.type === "action" && !d.comingSoon);
  if (actionDocs.length > 0) {
    attentionItems.push({
      label: `${actionDocs.length} document${actionDocs.length > 1 ? "s" : ""} still need to be completed`,
      urgent: false,
    });
  }

  async function handleSetPassword() {
    setPasswordError("");
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords don't match.");
      return;
    }
    setSavingPassword(true);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
      data: { password_set: true },
    });
    setSavingPassword(false);
    if (error) {
      setPasswordError(error.message);
    } else {
      setShowPasswordDialog(false);
      setNewPassword("");
      setConfirmPassword("");
    }
  }

  async function handleCommitteeRequest(interested: boolean) {
    if (!interested) {
      localStorage.setItem("committeePopupDismissed", "true");
      setShowCommitteePopup(false);
      return;
    }
    setSavingCommittee(true);
    const result = await requestCommitteeMembership();
    setSavingCommittee(false);
    if ("error" in result) {
      setShowCommitteePopup(false);
      return;
    }
    setCommitteeRequestStatus("pending");
    setShowCommitteePopup(false);
  }

  async function handleTicketConfirm(carPass: boolean) {
    setSavingTicket(true);
    await updateTicketStatus(carPass);
    setSavingTicket(false);
    setShowTicketPopup(false);
    setHasTicket(true);
    setHasCarPass(carPass);
  }

  function refreshDashboardData() {
    // Re-fetch camp status after onboarding changes
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (!authUser) return;
      supabase
        .from("camp_years")
        .select("id")
        .eq("year", 2026)
        .single()
        .then(({ data: campYear }) => {
          if (!campYear) return;
          supabase
            .from("registrations")
            .select("status")
            .eq("profile_id", authUser.id)
            .eq("camp_year_id", campYear.id)
            .maybeSingle()
            .then(({ data: reg }) => {
              if (reg?.status === "confirmed") {
                setCampStatus({ label: "Attending", payment: null });
              } else if (reg?.status === "cancelled") {
                setCampStatus({ label: "Not Attending", payment: null });
              } else {
                setCampStatus({ label: "Undecided", payment: null });
              }
            });
        });
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

      {/* Onboarding Checklist */}
      {onboardingComplete === false && (
        <OnboardingChecklist
          onStatusChange={refreshDashboardData}
          onComplete={() => setOnboardingComplete(true)}
        />
      )}

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
                {(stat.subtext || (stat.label === "2026 Status" && hasTicket !== null)) && (
                  <p className="text-xs mt-0.5 flex items-center gap-1.5">
                    {stat.subtext && (
                      <span className={stat.valueColor}>{stat.subtext}</span>
                    )}
                    {stat.label === "2026 Status" && hasTicket !== null && campStatus?.label === "Attending" && (
                      <span className={hasTicket ? "text-green-400" : "text-red-400"}>
                        {stat.subtext ? "· " : ""}{hasTicket ? (hasCarPass ? "Ticket + Car Pass" : "Ticket") : "No Ticket"}
                      </span>
                    )}
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

          {/* 2026 Campers — super_admin only */}
          {isSuperAdmin && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.55 }}
            >
              <Card className="glass-card border-0">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-sand-400">
                    2026 Campers
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
                      className={`h-2 w-2 rounded-full ${item.urgent ? "bg-coral" : "bg-amber"
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

      {/* Bottom grid: Recent Updates + Documents */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Updates */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75 }}
        >
          <Card className="glass-card border-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sand-200">
                <Megaphone className="h-4 w-4 text-pink-400" />
                Recent Updates
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Latest Instagram post */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Instagram className="h-3.5 w-3.5 text-pink-400" />
                  <span className="text-xs font-medium text-sand-400">
                    @node_brc
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl border border-pink-500/10 mx-auto" style={{ maxWidth: "480px" }}>
                  <iframe
                    src="https://www.instagram.com/p/DVTzj2NEbhB/embed"
                    className="border-0"
                    style={{ width: "480px", height: "640px", maxWidth: "100%" }}
                    loading="lazy"
                    scrolling="no"
                    title="NODE Instagram"
                  />
                </div>
                <a
                  href="https://www.instagram.com/node_brc/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs text-pink-400 hover:text-pink-300 transition-colors"
                >
                  <Instagram className="h-3 w-3" />
                  Follow @node_brc on Instagram
                </a>
              </div>
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
                  <li
                    key={doc.label}
                    className={`flex items-center gap-3 ${
                      !doc.comingSoon && doc.type === "view"
                        ? "cursor-pointer hover:bg-white/5 -mx-2 px-2 py-1.5 rounded-lg transition-colors"
                        : ""
                    }`}
                    onClick={
                      !doc.comingSoon && doc.type === "view"
                        ? () => setBudgetOpen(true)
                        : undefined
                    }
                  >
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                        doc.type === "view"
                          ? "bg-blue-500/20 text-blue-400"
                          : "bg-sand-700/30 text-sand-500"
                      }`}
                    >
                      {doc.type === "view" ? "!" : ""}
                    </span>
                    <span className="text-sm text-sand-200">
                      {doc.label}
                    </span>
                    {doc.comingSoon ? (
                      <Badge className="ml-auto bg-sand-700/30 text-sand-500 text-[10px]">
                        Coming Soon
                      </Badge>
                    ) : doc.type === "view" ? (
                      <Badge className="ml-auto bg-blue-500/15 text-blue-400 text-[10px]">
                        View Only
                      </Badge>
                    ) : null}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Budget Dialog */}
      <Dialog open={budgetOpen} onOpenChange={setBudgetOpen}>
        <DialogContent className="glass border-pink-500/10 sm:max-w-5xl h-[85vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-sand-100">
              <CreditCard className="h-5 w-5 text-blue-400" />
              NODE 2026 Budget
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden px-6 pb-6">
            <iframe
              src={BUDGET_EMBED_URL}
              className="h-full w-full rounded-xl border border-pink-500/10"
              loading="lazy"
              title="NODE 2026 Budget"
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Ticket Sale Popup */}
      <Dialog open={showTicketPopup} onOpenChange={setShowTicketPopup}>
        <DialogContent className="glass border-pink-500/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sand-100">
              <Ticket className="h-5 w-5 text-amber" />
              Steward Tickets Are Now On Sale!
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-sand-300">
            Steward tickets are now on sale! Have you purchased yours?
          </p>
          <p className="text-xs text-sand-500">
            Sale ends March 11 at 12pm PDT
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => handleTicketConfirm(false)}
              disabled={savingTicket}
              className="w-full rounded-full bg-green-600 text-white hover:bg-green-700"
            >
              {savingTicket ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes
            </Button>
            <Button
              onClick={() => handleTicketConfirm(true)}
              disabled={savingTicket}
              className="w-full rounded-full bg-green-600 text-white hover:bg-green-700"
            >
              {savingTicket ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : null}
              Yes + Car Pass
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowTicketPopup(false)}
              className="w-full text-sand-400 hover:text-sand-200"
            >
              Not yet
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Committee Request Popup */}
      <Dialog open={showCommitteePopup} onOpenChange={setShowCommitteePopup}>
        <DialogContent className="glass border-pink-500/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sand-100">
              <HandHeart className="h-5 w-5 text-pink-400" />
              Join the Membership Committee?
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-sand-300">
            The membership committee reviews applications and votes on new members
            joining NODE. Committee members get access to full application details
            and participate in decisions about our community.
          </p>
          <p className="text-xs text-sand-500">
            A super admin will review your request.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            <Button
              onClick={() => handleCommitteeRequest(true)}
              disabled={savingCommittee}
              className="w-full rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
            >
              {savingCommittee ? <Spinner className="mr-2 h-4 w-4 animate-spin" /> : <HandHeart className="mr-2 h-4 w-4" />}
              {savingCommittee ? "Submitting..." : "Yes, I'm Interested"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => handleCommitteeRequest(false)}
              className="w-full text-sand-400 hover:text-sand-200"
            >
              Not right now
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Set Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="glass border-pink-500/10 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sand-100">
              <Lock className="h-5 w-5 text-pink-400" />
              Set Your Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-sand-400">
            Set a password so you can sign in anytime without a magic link.
          </p>
          {passwordError && (
            <div className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive">
              {passwordError}
            </div>
          )}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sand-300">
                New Password
              </Label>
              <Input
                id="new-password"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password" className="text-sand-300">
                Confirm Password
              </Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Re-enter your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSetPassword()}
              />
            </div>
            <div className="flex gap-3">
              <Button
                onClick={handleSetPassword}
                disabled={savingPassword}
                className="flex-1 rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
              >
                {savingPassword && (
                  <Spinner className="mr-2 h-4 w-4 animate-spin" />
                )}
                {savingPassword ? "Saving..." : "Set Password"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowPasswordDialog(false)}
                className="text-sand-400 hover:text-sand-200"
              >
                Skip
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
