"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ClipboardList, CheckCircle2, BarChart3, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { getMySurvey, type MySurvey } from "@/lib/actions/survey";
import { SURVEY_YEAR } from "@/lib/survey/questions";

/**
 * Post-burn survey nudge on the dashboard overview. Self-loading; renders
 * nothing until the survey is open for this camper (confirmed + past gate).
 */
export function SurveyCard() {
  const [info, setInfo] = useState<MySurvey | null>(null);

  useEffect(() => {
    getMySurvey().then((res) => {
      if (!("error" in res)) setInfo(res);
    });
  }, []);

  if (!info || !info.open) return null;
  if (!info.eligible && !info.isAdmin) return null;

  const pct =
    info.confirmed > 0 ? Math.round((info.responded / info.confirmed) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="glass-card border-0 overflow-hidden">
        <CardContent className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ring-1 ${
                  info.submitted
                    ? "bg-green-500/15 ring-green-500/40"
                    : "bg-pink-500/15 ring-pink-500/30"
                }`}
              >
                {info.submitted ? (
                  <CheckCircle2 className="h-5 w-5 text-green-400" />
                ) : (
                  <ClipboardList className="h-5 w-5 text-pink-400" />
                )}
              </span>
              <div className="min-w-0">
                <p className="font-medium text-sand-100">
                  {info.submitted
                    ? `Thanks for filling out the ${SURVEY_YEAR} survey`
                    : `How was your burn? Take the ${SURVEY_YEAR} survey`}
                </p>
                <p className="text-sm text-sand-400">
                  {info.submitted
                    ? "You can edit your answers any time."
                    : "Five minutes. Honest answers build a better 2027."}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {info.isAdmin && (
                <Link
                  href="/dashboard/survey/results"
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 px-3 py-2 text-sm text-amber hover:bg-amber/10"
                >
                  <BarChart3 className="h-4 w-4" />
                  Results
                </Link>
              )}
              {info.eligible && (
                <Link
                  href="/dashboard/survey"
                  className={`inline-flex items-center gap-1 rounded-full px-4 py-2 text-sm font-medium ${
                    info.submitted
                      ? "border border-white/10 text-sand-300 hover:bg-white/5"
                      : "bg-gradient-to-r from-pink-500 to-amber text-white glow-pink"
                  }`}
                >
                  {info.submitted ? "Edit answers" : "Start survey"}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          </div>

          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-xs text-sand-500">
              <span>Camp pulse</span>
              <span className="tabular-nums">
                {info.responded} of {info.confirmed} campers answered
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-blue-900/50">
              <div
                className="h-full rounded-full bg-gradient-to-r from-pink-500 to-amber transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
