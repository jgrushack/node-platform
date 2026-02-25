"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Briefcase, DollarSign } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface AdminStats {
  totalMembers: number | null;
  totalApplications: number | null;
  pendingApplications: number | null;
  activeJobs: number | null;
  fillRate: number | null;
  duesCollected: number | null;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats>({
    totalMembers: null,
    totalApplications: null,
    pendingApplications: null,
    activeJobs: null,
    fillRate: null,
    duesCollected: null,
  });

  useEffect(() => {
    const supabase = createClient();

    // Total members
    supabase
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .then(({ count }) => {
        setStats((prev) => ({ ...prev, totalMembers: count ?? 0 }));
      });

    // Applications
    supabase
      .from("applications")
      .select("status")
      .then(({ data }) => {
        if (data) {
          setStats((prev) => ({
            ...prev,
            totalApplications: data.length,
            pendingApplications: data.filter((a) => a.status === "pending")
              .length,
          }));
        }
      });

    // Jobs + signups for fill rate
    supabase
      .from("jobs")
      .select("slots")
      .then(({ data: jobs }) => {
        const jobCount = jobs?.length ?? 0;
        const totalSlots =
          jobs?.reduce((s, j) => s + (j.slots || 0), 0) ?? 0;

        supabase
          .from("job_signups")
          .select("id", { count: "exact", head: true })
          .neq("status", "cancelled")
          .then(({ count }) => {
            const filled = count ?? 0;
            const rate =
              totalSlots > 0
                ? Math.round((filled / totalSlots) * 100)
                : 0;
            setStats((prev) => ({
              ...prev,
              activeJobs: jobCount,
              fillRate: rate,
            }));
          });
      });

    // Dues collected
    supabase
      .from("invoices")
      .select("amount_paid_cents")
      .then(({ data }) => {
        const total =
          data?.reduce((s, i) => s + (i.amount_paid_cents || 0), 0) ?? 0;
        setStats((prev) => ({ ...prev, duesCollected: total }));
      });
  }, []);

  const statCards = [
    {
      label: "Total Members",
      value:
        stats.totalMembers !== null ? String(stats.totalMembers) : null,
      detail: null as string | null,
      icon: Users,
      color: "text-pink-400",
    },
    {
      label: "Applications",
      value:
        stats.totalApplications !== null
          ? String(stats.totalApplications)
          : null,
      detail:
        stats.pendingApplications !== null
          ? `${stats.pendingApplications} pending`
          : null,
      icon: FileText,
      color: "text-amber",
    },
    {
      label: "Active Jobs",
      value:
        stats.activeJobs !== null ? String(stats.activeJobs) : null,
      detail:
        stats.fillRate !== null ? `${stats.fillRate}% filled` : null,
      icon: Briefcase,
      color: "text-coral",
    },
    {
      label: "Dues Collected",
      value:
        stats.duesCollected !== null
          ? `$${(stats.duesCollected / 100).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}`
          : null,
      detail: null as string | null,
      icon: DollarSign,
      color: "text-golden",
    },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">Admin Dashboard</h1>
        <p className="mt-1 text-sand-400">Overview of NODE operations.</p>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {statCards.map((stat, i) => (
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
                {stat.value !== null ? (
                  <>
                    <div className="text-2xl font-bold text-sand-100">
                      {stat.value}
                    </div>
                    {stat.detail && (
                      <p className="mt-1 text-xs text-sand-500">
                        {stat.detail}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="h-8 w-20 animate-pulse rounded bg-pink-500/10" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
