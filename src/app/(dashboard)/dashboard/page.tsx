"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Users, CreditCard, Shield } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const stats = [
  {
    label: "Camp Year",
    value: "2026",
    icon: Calendar,
    color: "text-pink-400",
  },
  {
    label: "Status",
    value: "Active",
    icon: Shield,
    color: "text-amber",
  },
  {
    label: "Group",
    value: "—",
    icon: Users,
    color: "text-coral",
  },
  {
    label: "Balance",
    value: "$0.00",
    icon: CreditCard,
    color: "text-golden",
  },
];

export default function DashboardPage() {
  const [userName, setUserName] = useState("");

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      const name =
        user.user_metadata?.full_name ||
        user.email?.split("@")[0] ||
        "there";
      setUserName(name.split(" ")[0]);
    });
  }, []);

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">
          Welcome back{userName ? `, ${userName}` : ""}
        </h1>
        <p className="mt-1 text-sand-400">
          Here&apos;s your NODE dashboard.
        </p>
      </motion.div>

      {/* Stats grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                <div className="text-2xl font-bold text-sand-100">
                  {stat.value}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Skeleton placeholder sections */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-sand-200">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full bg-pink-500/10" />
            <Skeleton className="h-4 w-3/4 bg-pink-500/10" />
            <Skeleton className="h-4 w-5/6 bg-pink-500/10" />
          </CardContent>
        </Card>
        <Card className="glass-card border-0">
          <CardHeader>
            <CardTitle className="text-sand-200">Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-4 w-full bg-pink-500/10" />
            <Skeleton className="h-4 w-2/3 bg-pink-500/10" />
            <Skeleton className="h-4 w-4/5 bg-pink-500/10" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
