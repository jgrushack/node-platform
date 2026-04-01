"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Ticket,
  Car,
  CheckCircle2,
  Clock,
  XCircle,
  ListFilter,
  Search,
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
import { createClient } from "@/lib/supabase/client";

interface Registration {
  id: string;
  status: string;
  has_ticket: boolean;
  has_car_pass: boolean;
  created_at: string;
  profile: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    playa_name: string | null;
    email: string;
  };
}

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

type StatusFilter = "all" | "confirmed" | "pending" | "waitlisted" | "cancelled";

export default function ReportsClient() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("confirmed");
  const [appSearch, setAppSearch] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState<string>("all");

  useEffect(() => {
    const supabase = createClient();

    async function fetchData() {
      // Get the 2026 camp year
      const { data: campYear } = await supabase
        .from("camp_years")
        .select("id")
        .eq("year", 2026)
        .single();

      if (!campYear) {
        setLoading(false);
        return;
      }

      // Fetch registrations with profile data
      const { data: regs } = await supabase
        .from("registrations")
        .select(
          `id, status, has_ticket, has_car_pass, created_at,
           profile:profiles!profile_id (id, first_name, last_name, playa_name, email)`
        )
        .eq("camp_year_id", campYear.id)
        .order("created_at", { ascending: false });

      if (regs) {
        setRegistrations(
          regs.map((r) => ({
            ...r,
            profile: Array.isArray(r.profile) ? r.profile[0] : r.profile,
          })) as Registration[]
        );
      }

      // Fetch applications
      const { data: apps } = await supabase
        .from("applications")
        .select(
          "id, first_name, last_name, email, playa_name, status, created_at, reviewed_at"
        )
        .order("created_at", { ascending: false });

      if (apps) {
        setApplications(apps as ApplicationRow[]);
      }

      setLoading(false);
    }

    fetchData();
  }, []);

  // Filter registrations
  const filteredRegistrations = registrations.filter((r) => {
    const matchesSearch =
      !search ||
      [
        r.profile?.first_name,
        r.profile?.last_name,
        r.profile?.playa_name,
        r.profile?.email,
      ]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === "all" || r.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Filter applications
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
  const totalRegistered = registrations.length;
  const confirmed = registrations.filter((r) => r.status === "confirmed").length;
  const withTicket = registrations.filter((r) => r.has_ticket).length;
  const withCarPass = registrations.filter((r) => r.has_car_pass).length;

  const appsPending = applications.filter((a) => a.status === "pending").length;
  const appsApproved = applications.filter((a) => a.status === "approved").length;
  const appsRejected = applications.filter((a) => a.status === "rejected").length;
  const appsWaitlisted = applications.filter((a) => a.status === "waitlist").length;

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
          <p className="mt-1 text-sand-400">Loading data...</p>
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
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">Reports</h1>
        <p className="mt-1 text-sand-400">
          NODE 2026 attendance, tickets, and application data.
        </p>
      </motion.div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[
          {
            label: "Nodes Registered",
            value: totalRegistered,
            detail: `${confirmed} confirmed, ${totalRegistered - confirmed} other`,
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
            label: "Car Passes",
            value: withCarPass,
            detail: `${confirmed > 0 ? Math.round((withCarPass / confirmed) * 100) : 0}% of campers`,
            icon: Car,
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

      {/* Tabs */}
      <Tabs defaultValue="attendance">
        <TabsList className="bg-blue-950/50 border border-amber/10">
          <TabsTrigger value="attendance" className="data-[state=active]:bg-amber/15 data-[state=active]:text-amber text-sand-400">
            Attendance
          </TabsTrigger>
          <TabsTrigger value="applications" className="data-[state=active]:bg-amber/15 data-[state=active]:text-amber text-sand-400">
            Applications
          </TabsTrigger>
        </TabsList>

        {/* Attendance tab */}
        <TabsContent value="attendance" className="mt-6 space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sand-500" />
              <Input
                placeholder="Search by name, playa name, or email..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-blue-950/30 border-amber/10 text-sand-200 placeholder:text-sand-600"
              />
            </div>
            <div className="flex gap-2">
              {(["all", "confirmed", "pending", "waitlisted", "cancelled"] as StatusFilter[]).map(
                (s) => (
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
                )
              )}
            </div>
          </div>

          <Card className="glass-card border-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber/10 hover:bg-transparent">
                    <TableHead className="text-sand-400">Name</TableHead>
                    <TableHead className="text-sand-400 hidden sm:table-cell">Playa Name</TableHead>
                    <TableHead className="text-sand-400 hidden md:table-cell">Email</TableHead>
                    <TableHead className="text-sand-400">Status</TableHead>
                    <TableHead className="text-sand-400 text-center">Ticket</TableHead>
                    <TableHead className="text-sand-400 text-center">Car Pass</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRegistrations.length === 0 ? (
                    <TableRow className="border-amber/10">
                      <TableCell
                        colSpan={6}
                        className="py-8 text-center text-sand-500"
                      >
                        {registrations.length === 0
                          ? "No registrations for 2026 yet."
                          : "No results match your filters."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRegistrations.map((r) => (
                      <TableRow
                        key={r.id}
                        className="border-amber/10 hover:bg-amber/5"
                      >
                        <TableCell className="text-sand-200 font-medium">
                          {r.profile?.first_name} {r.profile?.last_name}
                        </TableCell>
                        <TableCell className="text-sand-300 hidden sm:table-cell">
                          {r.profile?.playa_name || "—"}
                        </TableCell>
                        <TableCell className="text-sand-400 hidden md:table-cell">
                          {r.profile?.email}
                        </TableCell>
                        <TableCell>{statusBadge(r.status)}</TableCell>
                        <TableCell className="text-center">
                          {r.has_ticket ? (
                            <CheckCircle2 className="inline h-4 w-4 text-emerald-400" />
                          ) : (
                            <XCircle className="inline h-4 w-4 text-sand-600" />
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {r.has_car_pass ? (
                            <CheckCircle2 className="inline h-4 w-4 text-emerald-400" />
                          ) : (
                            <XCircle className="inline h-4 w-4 text-sand-600" />
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>

          <p className="text-xs text-sand-500">
            Showing {filteredRegistrations.length} of {registrations.length} registrations
          </p>
        </TabsContent>

        {/* Applications tab */}
        <TabsContent value="applications" className="mt-6 space-y-4">
          {/* Application summary */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Pending", count: appsPending, icon: Clock, color: "text-amber" },
              { label: "Approved", count: appsApproved, icon: CheckCircle2, color: "text-emerald-400" },
              { label: "Waitlisted", count: appsWaitlisted, icon: ListFilter, color: "text-blue-400" },
              { label: "Rejected", count: appsRejected, icon: XCircle, color: "text-red-400" },
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
                placeholder="Search by name or email..."
                value={appSearch}
                onChange={(e) => setAppSearch(e.target.value)}
                className="pl-9 bg-blue-950/30 border-amber/10 text-sand-200 placeholder:text-sand-600"
              />
            </div>
            <div className="flex gap-2">
              {["all", "pending", "approved", "waitlist", "rejected"].map(
                (s) => (
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
                )
              )}
            </div>
          </div>

          <Card className="glass-card border-0 overflow-hidden">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-amber/10 hover:bg-transparent">
                    <TableHead className="text-sand-400">Name</TableHead>
                    <TableHead className="text-sand-400 hidden sm:table-cell">Playa Name</TableHead>
                    <TableHead className="text-sand-400 hidden md:table-cell">Email</TableHead>
                    <TableHead className="text-sand-400">Status</TableHead>
                    <TableHead className="text-sand-400 hidden lg:table-cell">Applied</TableHead>
                    <TableHead className="text-sand-400 hidden lg:table-cell">Reviewed</TableHead>
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
            Showing {filteredApplications.length} of {applications.length} applications
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
}
