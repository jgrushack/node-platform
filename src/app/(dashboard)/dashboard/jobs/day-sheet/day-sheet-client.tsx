"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Printer,
  CheckCircle2,
  UserX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getJobsBoard,
  setSignupAttendance,
  type GetJobsBoardResult,
} from "@/lib/actions/jobs";
import type { ShiftView, ShiftSignup } from "@/lib/types/job";

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function shiftDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + deltaDays)).toISOString().slice(0, 10);
}

const PRINT_CSS = `
@media print {
  @page { margin: 12mm; }
  html, body { background: #fff !important; color: #000 !important; }
  body * { visibility: hidden; }
  #day-sheet, #day-sheet * { visibility: visible; }
  #day-sheet {
    position: absolute; left: 0; top: 0; width: 100%;
    background: #fff !important; color: #000 !important;
    box-shadow: none !important; backdrop-filter: none !important;
  }
  #day-sheet * {
    color: #000 !important; background: transparent !important;
    box-shadow: none !important; backdrop-filter: none !important;
    text-shadow: none !important; opacity: 1 !important;
  }
  #day-sheet .print-hide { display: none !important; }
  #day-sheet .print-row { border-bottom: 1px solid #000 !important; break-inside: avoid; }
  #day-sheet .print-shift { border: 1px solid #000 !important; break-inside: avoid; margin-bottom: 10px; }
  #day-sheet .print-box {
    display: inline-block !important; width: 14px; height: 14px;
    border: 1.5px solid #000 !important; vertical-align: middle; margin-right: 6px;
  }
}
`;

export function DaySheetClient({
  initial,
  date,
}: {
  initial: GetJobsBoardResult;
  date: string;
}) {
  const router = useRouter();
  const [board, setBoard] = useState<GetJobsBoardResult>(initial);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setBoard(await getJobsBoard());
  }

  const dayShifts = useMemo(() => {
    if ("error" in board) return [] as ShiftView[];
    return board.shifts
      .filter((s) => s.shiftDate === date)
      .sort((a, b) => a.startTime.localeCompare(b.startTime));
  }, [board, date]);

  const allDates = useMemo(() => {
    if ("error" in board) return [] as string[];
    return Array.from(new Set(board.shifts.map((s) => s.shiftDate))).sort();
  }, [board]);

  if ("error" in board) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sand-300">
        <ClipboardList className="mx-auto mb-3 h-8 w-8 text-pink-400" />
        <p>{board.error}</p>
      </div>
    );
  }

  const isAdmin = board.isAdmin;

  async function toggle(
    signup: ShiftSignup,
    patch: Partial<{ checkedIn: boolean; noShow: boolean }>
  ) {
    const next = {
      checkedIn: patch.checkedIn ?? !!signup.checkedInAt,
      noShow: patch.noShow ?? signup.noShow,
    };
    // Checked-in and no-show are mutually exclusive.
    if (patch.checkedIn) next.noShow = false;
    if (patch.noShow) next.checkedIn = false;
    setBusy(signup.signupId);
    const res = await setSignupAttendance(signup.signupId, next);
    setBusy(null);
    if ("error" in res) toast.error(res.error);
    else await refresh();
  }

  function go(d: string) {
    router.push(`/dashboard/jobs/day-sheet?date=${d}`);
  }

  const totalSlots = dayShifts.reduce((n, s) => n + s.capacity, 0);
  const totalFilled = dayShifts.reduce((n, s) => n + s.filled, 0);
  const totalCheckedIn = dayShifts.reduce(
    (n, s) => n + s.signups.filter((r) => r.checkedInAt).length,
    0
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="ghost" size="sm" className="text-sand-300">
          <Link href="/dashboard/jobs">
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Jobs board
          </Link>
        </Button>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-amber/20 text-sand-300"
            onClick={() => go(shiftDate(date, -1))}
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <select
            className="h-9 rounded-md border border-amber/20 bg-blue-950/40 px-2 text-sm text-sand-200"
            value={allDates.includes(date) ? date : ""}
            onChange={(e) => e.target.value && go(e.target.value)}
          >
            {!allDates.includes(date) && <option value="">{date}</option>}
            {allDates.map((d) => (
              <option key={d} value={d}>
                {formatDay(d)}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9 border-amber/20 text-sand-300"
            onClick={() => go(shiftDate(date, 1))}
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            className="bg-pink-500 hover:bg-pink-600"
            onClick={() => window.print()}
          >
            <Printer className="mr-1.5 h-4 w-4" /> Print
          </Button>
        </div>
      </div>

      <motion.div
        id="day-sheet"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-2xl p-5 sm:p-6"
      >
        <header className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b border-white/10 pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber">
              NODE 2026 · Day sheet
            </p>
            <h1 className="text-2xl font-bold text-sand-100">{formatDay(date)}</h1>
          </div>
          <p className="text-sm text-sand-400">
            {dayShifts.length} shift{dayShifts.length === 1 ? "" : "s"} ·{" "}
            {totalFilled}/{totalSlots} slots filled
            {isAdmin ? ` · ${totalCheckedIn} checked in` : ""}
          </p>
        </header>

        {dayShifts.length === 0 ? (
          <p className="py-8 text-center text-sm text-sand-400">
            No shifts scheduled this day.
          </p>
        ) : (
          <div className="space-y-4">
            {dayShifts.map((s) => (
              <section
                key={s.id}
                className="print-shift rounded-xl bg-white/5 p-4 ring-1 ring-white/10"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-base font-semibold text-sand-100">
                    {formatTime(s.startTime)}
                    {s.endTime ? `–${formatTime(s.endTime)}` : ""} · {s.title}
                    {s.label ? ` — ${s.label}` : ""}
                  </h2>
                  <span className="text-xs text-sand-400">
                    {s.filled}/{s.capacity}
                    {s.category ? ` · ${s.category}` : ""}
                  </span>
                </div>
                {s.description && (
                  <p className="mt-1 text-xs text-sand-400">{s.description}</p>
                )}

                <ul className="mt-3 divide-y divide-white/5">
                  {s.signups.length === 0 && (
                    <li className="print-row py-2 text-sm text-sand-500">
                      — nobody signed up —
                    </li>
                  )}
                  {s.signups.map((r) => (
                    <li
                      key={r.signupId}
                      className="print-row flex items-center justify-between gap-3 py-2"
                    >
                      <span className="flex min-w-0 items-center gap-2 text-sm text-sand-100">
                        <span className="print-box hidden" aria-hidden />
                        {r.checkedInAt && (
                          <CheckCircle2 className="print-hide h-4 w-4 shrink-0 text-emerald-400" />
                        )}
                        {r.noShow && (
                          <UserX className="print-hide h-4 w-4 shrink-0 text-red-400" />
                        )}
                        <span className={r.noShow ? "line-through opacity-70" : ""}>
                          {r.name}
                        </span>
                        {r.isMe && (
                          <Badge className="print-hide bg-pink-500/20 text-pink-300">
                            you
                          </Badge>
                        )}
                      </span>
                      {isAdmin ? (
                        <span className="print-hide flex shrink-0 gap-1.5">
                          <Button
                            size="sm"
                            variant={r.checkedInAt ? "default" : "outline"}
                            className={
                              r.checkedInAt
                                ? "h-8 bg-emerald-500 text-blue-950 hover:bg-emerald-400"
                                : "h-8 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
                            }
                            disabled={busy === r.signupId}
                            onClick={() => toggle(r, { checkedIn: !r.checkedInAt })}
                          >
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                            {r.checkedInAt ? "In" : "Check in"}
                          </Button>
                          <Button
                            size="sm"
                            variant={r.noShow ? "default" : "outline"}
                            className={
                              r.noShow
                                ? "h-8 bg-red-500 text-white hover:bg-red-400"
                                : "h-8 border-red-500/30 text-red-300 hover:bg-red-500/10"
                            }
                            disabled={busy === r.signupId}
                            onClick={() => toggle(r, { noShow: !r.noShow })}
                          >
                            <UserX className="mr-1 h-3.5 w-3.5" />
                            No-show
                          </Button>
                        </span>
                      ) : (
                        <span className="print-hide text-xs text-sand-500">
                          {r.checkedInAt ? "Checked in" : r.noShow ? "No-show" : ""}
                        </span>
                      )}
                    </li>
                  ))}
                  {/* Blank lines for walk-ups when printed */}
                  {Array.from({
                    length: Math.max(0, s.capacity - s.signups.length),
                  }).map((_, i) => (
                    <li
                      key={`blank-${i}`}
                      className="print-row hidden py-2 text-sm print:flex"
                    >
                      <span className="print-box hidden" aria-hidden />
                      <span className="text-sand-500">
                        ____________________________
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
