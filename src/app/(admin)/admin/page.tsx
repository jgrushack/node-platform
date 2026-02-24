"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Briefcase, DollarSign } from "lucide-react";

const stats = [
  {
    label: "Total Members",
    value: "84",
    change: "+12 this year",
    icon: Users,
    color: "text-pink-400",
  },
  {
    label: "Applications",
    value: "23",
    change: "8 pending",
    icon: FileText,
    color: "text-amber",
  },
  {
    label: "Active Jobs",
    value: "15",
    change: "67% filled",
    icon: Briefcase,
    color: "text-coral",
  },
  {
    label: "Revenue",
    value: "$42,800",
    change: "Dues collected",
    icon: DollarSign,
    color: "text-golden",
  },
];

export default function AdminDashboardPage() {
  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-3xl font-bold text-sand-100">Admin Dashboard</h1>
        <p className="mt-1 text-sand-400">
          Overview of NODE operations.
        </p>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat, i) => (
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
                <p className="mt-1 text-xs text-sand-500">{stat.change}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
