"use client";

import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  AlertTriangle,
  Circle,
  Clock,
  ChevronRight,
  Map,
  type LucideIcon,
} from "lucide-react";

export type ChecklistState = "done" | "attention" | "todo" | "soon";

export interface ChecklistRow {
  key: string;
  label: string;
  icon: LucideIcon;
  state: ChecklistState;
  /** Short status text shown under the label, e.g. "Need a ride" or "$150 due". */
  detail: string;
  onClick?: () => void;
}

const STATUS: Record<
  ChecklistState,
  { icon: LucideIcon; tint: string; ring: string; detail: string }
> = {
  done: {
    icon: Check,
    tint: "text-emerald-400",
    ring: "bg-emerald-500/15 ring-emerald-500/30",
    detail: "text-emerald-400",
  },
  attention: {
    icon: AlertTriangle,
    tint: "text-amber-300",
    ring: "bg-amber-500/15 ring-amber-500/30",
    detail: "text-amber-300",
  },
  todo: {
    icon: Circle,
    tint: "text-sand-500",
    ring: "bg-sand-700/20 ring-sand-600/30",
    detail: "text-sand-400",
  },
  soon: {
    icon: Clock,
    tint: "text-sand-600",
    ring: "bg-sand-700/15 ring-sand-700/30",
    detail: "text-sand-500",
  },
};

export function RoadTo2026({ rows }: { rows: ChecklistRow[] }) {
  const counted = rows.filter((r) => r.state !== "soon");
  const done = counted.filter((r) => r.state === "done").length;
  const total = counted.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="glass-card border-0">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-sand-200">
            <Map className="h-4 w-4 text-pink-400" />
            Road to 2026
          </CardTitle>
          <span className="text-xs font-medium text-sand-400">
            {done} of {total} done
          </span>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Progress bar */}
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand-700/20">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-pink-500 to-amber"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>

          <ul className="divide-y divide-white/5">
            {rows.map((row) => {
              const s = STATUS[row.state];
              const StatusIcon = s.icon;
              const RowIcon = row.icon;
              const clickable = !!row.onClick && row.state !== "soon";
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={row.onClick}
                    className={`flex w-full items-center gap-3 py-2.5 text-left transition-colors ${
                      clickable
                        ? "cursor-pointer hover:bg-white/5 -mx-2 px-2 rounded-lg"
                        : "cursor-default"
                    }`}
                  >
                    <span
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-1 ${s.ring}`}
                    >
                      <StatusIcon className={`h-4 w-4 ${s.tint}`} />
                    </span>
                    <RowIcon className="h-4 w-4 flex-shrink-0 text-sand-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-sand-100">
                        {row.label}
                      </span>
                      <span className={`block truncate text-xs ${s.detail}`}>
                        {row.detail}
                      </span>
                    </span>
                    {clickable && (
                      <ChevronRight className="h-4 w-4 flex-shrink-0 text-sand-500" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </motion.div>
  );
}
