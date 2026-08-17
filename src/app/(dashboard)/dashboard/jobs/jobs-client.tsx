"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  Briefcase,
  Hand,
  Zap,
  Printer,
  Radio,
  Flame,
  Trophy,
  Clock,
  Users,
  Plus,
  Pencil,
  Trash2,
  Settings,
  CalendarDays,
  CheckCircle2,
  Circle,
  Lock,
  Star,
  BookOpen,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  getJobsBoard,
  signUpForShift,
  dropShift,
  checkInToShift,
  createJobDefinition,
  updateJobDefinition,
  deleteJobDefinition,
  createJobShift,
  deleteJobShift,
  updateJobBoardSettings,
  type GetJobsBoardResult,
  type JobsBoardData,
} from "@/lib/actions/jobs";
import type {
  JobDefinitionRow,
  ShiftView,
  JobDefinitionFormData,
  JobShiftFormData,
  BoardModeSetting,
} from "@/lib/types/job";

// ── Formatting helpers (date/time are floating playa-local) ──────────

function formatDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function pointValue(difficulty: number, durationMin: number): number {
  return difficulty * Math.ceil(durationMin / 30);
}

// ── Playa-local clock (America/Los_Angeles) ──────────────────────────

const PLAYA_TZ = "America/Los_Angeles";

/** Current playa-local date + minutes-since-midnight. */
function playaNow(): { date: string; minutes: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: PLAYA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const map: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date())) map[p.type] = p.value;
  return {
    date: `${map.year}-${map.month}-${map.day}`,
    minutes: (Number(map.hour) % 24) * 60 + Number(map.minute),
  };
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function dayIndex(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86_400_000);
}

/** Minutes from now (playa-local) until the shift starts; negative = started. */
function minutesUntil(shift: ShiftView, now: { date: string; minutes: number }): number {
  const dayDelta = dayIndex(shift.shiftDate) - dayIndex(now.date);
  return dayDelta * 1440 + toMinutes(shift.startTime) - now.minutes;
}

function shiftEndMinutes(shift: ShiftView): number {
  return shift.endTime ? toMinutes(shift.endTime) : toMinutes(shift.startTime) + 60;
}

/** Shift is in progress right now (playa-local). */
function isHappeningNow(shift: ShiftView, now: { date: string; minutes: number }): boolean {
  return (
    shift.shiftDate === now.date &&
    now.minutes >= toMinutes(shift.startTime) &&
    now.minutes < shiftEndMinutes(shift)
  );
}

/** Ticks once a minute so "now" highlights stay fresh while the tab is open. */
function usePlayaNow() {
  const [now, setNow] = useState(() => playaNow());
  useEffect(() => {
    const id = setInterval(() => setNow(playaNow()), 60_000);
    return () => clearInterval(id);
  }, []);
  return now;
}

const CHECKIN_WINDOW_MIN = 3 * 60;

const DROP_LOCK_MSG = "Drops are locked — find someone to swap and ask a lead.";

export function JobsClient({ initial }: { initial: GetJobsBoardResult }) {
  const [board, setBoard] = useState<GetJobsBoardResult>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);

  async function refresh() {
    const next = await getJobsBoard();
    setBoard(next);
  }

  if ("error" in board) {
    return (
      <div className="mx-auto max-w-2xl py-12 text-center text-sand-300">
        <Briefcase className="mx-auto mb-3 h-8 w-8 text-pink-400" />
        <p>{board.error}</p>
      </div>
    );
  }

  const mode = board.mode;

  const memberView =
    mode === "live" ? (
      <LiveBoard
        data={board}
        busyId={busyId}
        setBusyId={setBusyId}
        refresh={refresh}
      />
    ) : mode === "closed" ? (
      <ClosedBoard data={board} />
    ) : (
      <MemberBoard
        data={board}
        busyId={busyId}
        setBusyId={setBusyId}
        refresh={refresh}
      />
    );

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold text-sand-100">
            <Briefcase className="h-6 w-6 text-pink-400" />
            Camp Jobs
            {mode === "live" && (
              <Badge className="ml-1 gap-1 bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/30">
                <Radio className="h-3 w-3" /> Live on playa
              </Badge>
            )}
            {mode === "closed" && (
              <Badge className="ml-1 bg-sand-700/30 text-sand-300">
                2026 closed
              </Badge>
            )}
          </h1>
          <p className="text-sm text-sand-400">
            {mode === "live"
              ? "Show up, check in, pitch in. Need to swap? Ask a lead."
              : mode === "closed"
                ? "The 2026 board is closed — thank you for pitching in."
                : "Sign up for shifts during burn week. Jobs earn points — pitch in and keep NODE running. Strike is required of everyone."}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="shrink-0 border-amber/20 text-sand-300 hover:bg-amber/10"
          onClick={() => setShowGuide((v) => !v)}
        >
          <BookOpen className="mr-1.5 h-4 w-4" />
          {showGuide ? "Back to board" : "Job guide"}
        </Button>
      </header>

      {showGuide ? (
        <JobGuide definitions={board.definitions} />
      ) : board.isAdmin ? (
        <Tabs defaultValue="board" className="space-y-6">
          <TabsList className="glass">
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <TabsContent value="board">{memberView}</TabsContent>
          <TabsContent value="schedule">
            <AdminSchedule data={board} refresh={refresh} />
          </TabsContent>
          <TabsContent value="catalog">
            <AdminCatalog data={board} refresh={refresh} />
          </TabsContent>
          <TabsContent value="settings">
            <AdminSettings data={board} refresh={refresh} />
          </TabsContent>
        </Tabs>
      ) : (
        memberView
      )}
    </div>
  );
}

// ── Job guide ────────────────────────────────────────────────────────

function JobGuide({ definitions }: { definitions: JobDefinitionRow[] }) {
  const byCategory = useMemo(() => {
    const map = new Map<string, JobDefinitionRow[]>();
    for (const d of definitions) {
      const cat = d.category || "Other";
      const list = map.get(cat) ?? [];
      list.push(d);
      map.set(cat, list);
    }
    return Array.from(map.entries());
  }, [definitions]);

  return (
    <div className="space-y-6">
      <p className="text-sm text-sand-400">
        What each job involves — review before you sign up. These become
        per-job checklists soon.
      </p>
      {byCategory.map(([cat, defs]) => (
        <div key={cat} className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber">
            {cat}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {defs.map((d) => (
              <Card key={d.id} className="glass-card border-0">
                <CardContent className="space-y-2 py-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sand-100">{d.title}</h3>
                    <Badge
                      variant="outline"
                      className="shrink-0 border-amber/20 text-amber"
                    >
                      {d.point_value} pts
                    </Badge>
                  </div>
                  <p className="text-sm text-sand-300">
                    {d.description || "Responsibilities coming soon."}
                  </p>
                  <p className="text-xs text-sand-500">
                    Crew of {d.people_required} · ~{d.duration_min} min
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Member board ─────────────────────────────────────────────────────

function MemberBoard({
  data,
  busyId,
  setBusyId,
  refresh,
}: {
  data: JobsBoardData;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  refresh: () => Promise<void>;
}) {
  const {
    shifts,
    progress,
    window: signupWindow,
    leaderboard,
    isConfirmedCamper,
    mode,
    dropLocked,
    todayPlaya,
  } = data;
  const canDrop = mode === "prep" && !dropLocked;

  // Pre-playa nudge: the six emptiest upcoming shifts I'm not already on.
  const needsYou = useMemo(() => {
    if (mode !== "prep" || progress.pointsTarget <= 0 || progress.onTrack)
      return [] as ShiftView[];
    return shifts
      .filter((s) => !s.mine && !s.isFull && s.shiftDate >= todayPlaya)
      .sort(
        (a, b) =>
          a.filled / a.capacity - b.filled / b.capacity ||
          a.shiftDate.localeCompare(b.shiftDate) ||
          a.startTime.localeCompare(b.startTime)
      )
      .slice(0, 6);
  }, [shifts, mode, progress.pointsTarget, progress.onTrack, todayPlaya]);

  const days = useMemo(() => {
    const map = new Map<string, ShiftView[]>();
    for (const s of shifts) {
      const arr = map.get(s.shiftDate) ?? [];
      arr.push(s);
      map.set(s.shiftDate, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [shifts]);

  const myShifts = shifts.filter((s) => s.mine);
  const canSignup = isConfirmedCamper && signupWindow.open;

  async function handleSignup(shift: ShiftView) {
    setBusyId(shift.id);
    const res = await signUpForShift(shift.id);
    setBusyId(null);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success(`You're on: ${shift.title}`);
      await refresh();
    }
  }

  async function handleDrop(shift: ShiftView) {
    if (!canDrop) {
      toast.error(DROP_LOCK_MSG);
      return;
    }
    setBusyId(shift.id);
    const res = await dropShift(shift.id);
    setBusyId(null);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success(`Dropped: ${shift.title}`);
      await refresh();
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {/* Main column */}
      <div className="space-y-6 lg:col-span-2">
        {/* Pre-playa nudge */}
        {needsYou.length > 0 && canSignup && (
          <motion.section
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <h2 className="flex items-center gap-2 text-sm font-semibold text-sand-200">
              <Hand className="h-4 w-4 text-amber" />
              Shifts that need you
              <span className="text-xs font-normal text-sand-500">
                {progress.pointsTarget - progress.totalPoints} pts to your goal
              </span>
            </h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {needsYou.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between gap-3 rounded-xl bg-amber/10 px-4 py-3 ring-1 ring-amber/20"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-sand-100">
                      {s.title}
                      {s.label ? ` — ${s.label}` : ""}
                    </p>
                    <p className="text-xs text-sand-400">
                      {formatDay(s.shiftDate)} · {formatTime(s.startTime)} ·{" "}
                      {s.filled}/{s.capacity} filled · {s.pointValue} pts
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-pink-500 hover:bg-pink-600"
                    disabled={busyId === s.id}
                    onClick={() => handleSignup(s)}
                  >
                    Sign up
                  </Button>
                </div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Progress */}
        <Card className="glass-card border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sand-200">
              <Star className="h-4 w-4 text-amber" />
              Your contribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <span className="text-3xl font-bold text-sand-100">
                  {progress.totalPoints}
                </span>
                <span className="ml-1 text-sm text-sand-400">
                  point{progress.totalPoints === 1 ? "" : "s"}
                </span>
              </div>
              <span className="text-sm text-sand-400">
                {progress.shiftCount} shift{progress.shiftCount === 1 ? "" : "s"}
              </span>
            </div>
            {progress.pointsTarget > 0 && (
              <>
                <div className="h-2 w-full overflow-hidden rounded-full bg-sand-700/20">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-pink-500 to-amber transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.round(
                          (progress.totalPoints / progress.pointsTarget) * 100
                        )
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-sand-400">
                  {progress.onTrack
                    ? `Target met — thank you! (${progress.pointsTarget} pts)`
                    : `${progress.totalPoints} / ${progress.pointsTarget} points toward your goal`}
                </p>
              </>
            )}

            {/* Required of everyone: 1 strike + 1 BBQ */}
            <div className="space-y-1.5 rounded-lg border border-amber/10 bg-blue-950/20 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-sand-400">
                Required of every camper
              </p>
              <div className="flex items-center gap-2 text-sm">
                {progress.hasStrikeShift ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-sand-600" />
                )}
                <span
                  className={
                    progress.hasStrikeShift ? "text-sand-200" : "text-sand-400"
                  }
                >
                  1 Strike shift
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                {progress.hasBbqShift ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 text-sand-600" />
                )}
                <span
                  className={
                    progress.hasBbqShift ? "text-sand-200" : "text-sand-400"
                  }
                >
                  1 BBQ (hip hop) shift
                </span>
              </div>
            </div>

            {/* How points work */}
            <p className="text-xs leading-relaxed text-sand-500">
              Points scale with effort — difficulty × 30-minute blocks — so
              longer, harder shifts are worth more (a dinner = 16, a quick
              tidy = 2). Strike shifts earn no points — everyone is required
              to help strike, on top of your points goal.
              {progress.pointsTarget > 0 && (
                <>
                  {" "}
                  Aim for{" "}
                  <span className="font-semibold text-sand-300">
                    {progress.pointsTarget} points
                  </span>{" "}
                  (about 4–5 shifts) so every shift gets covered. The Strike
                  and BBQ shifts above are required on top of that.
                </>
              )}
            </p>
          </CardContent>
        </Card>

        {/* Eligibility / window notices */}
        {!isConfirmedCamper && (
          <NoticeCard icon={Lock}>
            Only confirmed 2026 campers can sign up for shifts. Confirm your spot
            from your dashboard, then come back.
          </NoticeCard>
        )}
        {isConfirmedCamper && !signupWindow.open && signupWindow.opensAt && (
          <NoticeCard icon={Clock}>
            {/* A far-future opens-at is a "locked until we announce a date"
                sentinel, not a real launch date — don't show the bogus date. */}
            {new Date(signupWindow.opensAt).getFullYear() < 2090 ? (
              <>
                Signups open{" "}
                <span className="font-semibold text-sand-200">
                  {new Date(signupWindow.opensAt).toLocaleString()}
                </span>
                {signupWindow.earlyAccess &&
                  " (early access — thanks for your years!)"}
                .
              </>
            ) : (
              "Signups aren’t open yet — we’ll announce the launch date soon."
            )}
          </NoticeCard>
        )}

        {/* My shifts */}
        {myShifts.length > 0 && (
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-sand-200">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              My shifts
              {!canDrop && (
                <span className="text-xs font-normal text-sand-500">
                  · drops locked
                </span>
              )}
            </h2>
            <div className="space-y-2">
              {myShifts.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-xl bg-emerald-500/10 px-4 py-3 ring-1 ring-emerald-500/20"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-sand-100">
                      {s.title}
                      {s.label ? ` — ${s.label}` : ""}
                    </p>
                    <p className="text-xs text-sand-400">
                      {formatDay(s.shiftDate)} · {formatTime(s.startTime)}
                      {s.endTime ? `–${formatTime(s.endTime)}` : ""} ·{" "}
                      {s.pointValue} pts
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-sand-300 hover:text-red-400 disabled:opacity-50"
                    disabled={busyId === s.id || !canDrop}
                    title={canDrop ? undefined : DROP_LOCK_MSG}
                    onClick={() => handleDrop(s)}
                  >
                    {canDrop ? "Drop" : <Lock className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* All shifts by day */}
        {days.length === 0 ? (
          <Card className="glass-card border-0">
            <CardContent className="py-10 text-center text-sm text-sand-400">
              No shifts posted yet. Check back soon!
            </CardContent>
          </Card>
        ) : (
          days.map(([date, dayShifts]) => (
            <section key={date} className="space-y-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-sand-200">
                <CalendarDays className="h-4 w-4 text-pink-400" />
                {formatDay(date)}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2">
                {dayShifts.map((s) => (
                  <ShiftCard
                    key={s.id}
                    shift={s}
                    busy={busyId === s.id}
                    canSignup={canSignup}
                    canDrop={canDrop}
                    onSignup={() => handleSignup(s)}
                    onDrop={() => handleDrop(s)}
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>

      {/* Leaderboard */}
      <div className="lg:col-span-1">
        <Card className="glass-card sticky top-4 border-0">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sand-200">
              <Trophy className="h-4 w-4 text-amber" />
              Leaderboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-sand-400">
                No points yet — be the first to sign up!
              </p>
            ) : (
              <ol className="space-y-1.5">
                {leaderboard.slice(0, 15).map((e) => (
                  <li
                    key={e.profileId}
                    className={`flex items-center justify-between rounded-lg px-2 py-1.5 text-sm ${
                      e.isMe ? "bg-pink-500/15 text-pink-300" : "text-sand-200"
                    }`}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="w-5 shrink-0 text-right text-xs text-sand-500">
                        {e.rank}
                      </span>
                      <span className="truncate">{e.name}</span>
                    </span>
                    <span className="shrink-0 font-semibold">
                      {e.totalPoints}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ── Live (on-playa) board ────────────────────────────────────────────

function LiveBoard({
  data,
  busyId,
  setBusyId,
  refresh,
}: {
  data: JobsBoardData;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  refresh: () => Promise<void>;
}) {
  return (
    <Tabs defaultValue="today" className="space-y-4">
      <TabsList className="glass w-full sm:w-auto">
        <TabsTrigger value="today" className="flex-1 sm:flex-none">
          Today
        </TabsTrigger>
        <TabsTrigger value="week" className="flex-1 sm:flex-none">
          Full week
        </TabsTrigger>
      </TabsList>
      <TabsContent value="today">
        <TodayView
          data={data}
          busyId={busyId}
          setBusyId={setBusyId}
          refresh={refresh}
        />
      </TabsContent>
      <TabsContent value="week">
        <MemberBoard
          data={data}
          busyId={busyId}
          setBusyId={setBusyId}
          refresh={refresh}
        />
      </TabsContent>
    </Tabs>
  );
}

function TodayView({
  data,
  busyId,
  setBusyId,
  refresh,
}: {
  data: JobsBoardData;
  busyId: string | null;
  setBusyId: (id: string | null) => void;
  refresh: () => Promise<void>;
}) {
  const { shifts, isConfirmedCamper, isAdmin, todayPlaya } = data;
  const now = usePlayaNow();
  // Prefer the live clock's date; fall back to the server's.
  const today = now.date || todayPlaya;
  const tomorrow = useMemo(() => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  }, [today]);

  const myUpcoming = useMemo(
    () =>
      shifts
        .filter((s) => s.mine)
        .filter((s) => {
          // Keep anything still in progress or ahead of us.
          const dayDelta = dayIndex(s.shiftDate) - dayIndex(today);
          if (dayDelta > 0) return true;
          if (dayDelta < 0) return false;
          return shiftEndMinutes(s) > now.minutes;
        })
        .sort(
          (a, b) =>
            a.shiftDate.localeCompare(b.shiftDate) ||
            a.startTime.localeCompare(b.startTime)
        ),
    [shifts, today, now.minutes]
  );
  const nextShift = myUpcoming[0] ?? null;

  const needsHands = useMemo(
    () =>
      shifts
        .filter(
          (s) =>
            !s.isFull &&
            !s.mine &&
            (s.shiftDate === today || s.shiftDate === tomorrow) &&
            !(s.shiftDate === today && shiftEndMinutes(s) <= now.minutes)
        )
        .sort(
          (a, b) =>
            a.shiftDate.localeCompare(b.shiftDate) ||
            a.startTime.localeCompare(b.startTime)
        ),
    [shifts, today, tomorrow, now.minutes]
  );

  const todaysRoster = useMemo(
    () =>
      shifts
        .filter((s) => s.shiftDate === today)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [shifts, today]
  );

  async function handleSignup(shift: ShiftView) {
    setBusyId(shift.id);
    const res = await signUpForShift(shift.id);
    setBusyId(null);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success(`You're on: ${shift.title}`);
      await refresh();
    }
  }

  async function handleCheckIn(shift: ShiftView) {
    setBusyId(shift.id);
    const res = await checkInToShift(shift.id);
    setBusyId(null);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success("Checked in — thank you!");
      await refresh();
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      {isAdmin && (
        <div className="flex justify-end">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="border-amber/20 text-sand-300 hover:bg-amber/10"
          >
            <Link href={`/dashboard/jobs/day-sheet?date=${today}`}>
              <Printer className="mr-1.5 h-4 w-4" /> Day sheet
            </Link>
          </Button>
        </div>
      )}

      {/* (a) Right now / up next */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-sand-200">
          <Zap className="h-4 w-4 text-amber" />
          {nextShift && isHappeningNow(nextShift, now) ? "Right now" : "Up next"}
        </h2>
        {nextShift ? (
          <NextShiftCard
            shift={nextShift}
            now={now}
            busy={busyId === nextShift.id}
            onCheckIn={() => handleCheckIn(nextShift)}
          />
        ) : (
          <Card className="glass-card border-0">
            <CardContent className="py-6 text-center text-sm text-sand-400">
              {isConfirmedCamper
                ? "No upcoming shifts on your plate. Grab one below!"
                : "Only confirmed 2026 campers can take shifts."}
            </CardContent>
          </Card>
        )}
        {myUpcoming.length > 1 && (
          <p className="px-1 text-xs text-sand-500">
            Then:{" "}
            {myUpcoming
              .slice(1, 4)
              .map(
                (s) =>
                  `${s.title} · ${
                    s.shiftDate === today ? "today" : formatDay(s.shiftDate)
                  } ${formatTime(s.startTime)}`
              )
              .join(" · ")}
          </p>
        )}
      </section>

      {/* (b) Needs hands */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-sand-200">
          <Hand className="h-4 w-4 text-pink-400" />
          Needs hands
          <span className="text-xs font-normal text-sand-500">today + tomorrow</span>
        </h2>
        {needsHands.length === 0 ? (
          <Card className="glass-card border-0">
            <CardContent className="py-5 text-center text-sm text-sand-400">
              Everything&apos;s covered — legends.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {needsHands.map((s) => (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between gap-3 rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sand-100">
                    {s.title}
                    {s.label ? ` — ${s.label}` : ""}
                  </p>
                  <p className="text-xs text-sand-400">
                    {s.shiftDate === today ? "Today" : "Tomorrow"} ·{" "}
                    {formatTime(s.startTime)}
                    {s.endTime ? `–${formatTime(s.endTime)}` : ""} ·{" "}
                    <span className="text-amber">
                      {s.capacity - s.filled} more needed
                    </span>
                  </p>
                </div>
                <Button
                  size="sm"
                  className="h-10 shrink-0 bg-pink-500 px-4 hover:bg-pink-600"
                  disabled={busyId === s.id || !isConfirmedCamper}
                  onClick={() => handleSignup(s)}
                >
                  Sign up
                </Button>
              </motion.div>
            ))}
          </div>
        )}
      </section>

      {/* (c) Today's roster */}
      <section className="space-y-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-sand-200">
          <CalendarDays className="h-4 w-4 text-pink-400" />
          Today&apos;s roster
          <span className="text-xs font-normal text-sand-500">{formatDay(today)}</span>
        </h2>
        {todaysRoster.length === 0 ? (
          <Card className="glass-card border-0">
            <CardContent className="py-5 text-center text-sm text-sand-400">
              Nothing scheduled today.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {todaysRoster.map((s) => {
              const current = isHappeningNow(s, now);
              const past = shiftEndMinutes(s) <= now.minutes;
              return (
                <div
                  key={s.id}
                  className={`rounded-xl px-4 py-3 ring-1 ${
                    current
                      ? "bg-emerald-500/10 ring-emerald-500/40"
                      : s.mine
                        ? "bg-pink-500/10 ring-pink-500/20"
                        : "bg-white/5 ring-white/10"
                  } ${past && !current ? "opacity-60" : ""}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-sand-100">
                        {s.title}
                        {s.label ? ` — ${s.label}` : ""}
                      </p>
                      <p className="text-xs text-sand-400">
                        {formatTime(s.startTime)}
                        {s.endTime ? `–${formatTime(s.endTime)}` : ""} ·{" "}
                        {s.filled}/{s.capacity}
                      </p>
                    </div>
                    {current && (
                      <Badge className="shrink-0 bg-emerald-500/20 text-emerald-300">
                        Now
                      </Badge>
                    )}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {s.signups.length === 0 ? (
                      <span className="text-xs text-sand-500">Nobody yet</span>
                    ) : (
                      s.signups.map((r) => (
                        <span
                          key={r.profileId}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                            r.isMe
                              ? "bg-pink-500/20 text-pink-300"
                              : "bg-sand-700/30 text-sand-300"
                          } ${r.noShow ? "line-through opacity-60" : ""}`}
                        >
                          {r.checkedInAt && (
                            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
                          )}
                          {r.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function NextShiftCard({
  shift,
  now,
  busy,
  onCheckIn,
}: {
  shift: ShiftView;
  now: { date: string; minutes: number };
  busy: boolean;
  onCheckIn: () => void;
}) {
  const until = minutesUntil(shift, now);
  const inWindow = Math.abs(until) <= CHECKIN_WINDOW_MIN;
  const checkedIn = !!shift.myCheckedInAt;
  const happening = isHappeningNow(shift, now);

  let when: string;
  if (happening) when = "Happening now";
  else if (until < 0) when = "Started";
  else if (until < 60) when = `In ${until} min`;
  else if (shift.shiftDate === now.date) when = `Today at ${formatTime(shift.startTime)}`;
  else when = `${formatDay(shift.shiftDate)} at ${formatTime(shift.startTime)}`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`glass-card rounded-2xl p-5 ring-1 ${
        happening ? "ring-emerald-500/40" : "ring-pink-500/20"
      }`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-amber">
        {when}
      </p>
      <h3 className="mt-1 text-2xl font-bold text-sand-100">
        {shift.title}
        {shift.label ? (
          <span className="text-sand-300"> — {shift.label}</span>
        ) : null}
      </h3>
      <p className="mt-1 text-sm text-sand-300">
        {formatDay(shift.shiftDate)} · {formatTime(shift.startTime)}
        {shift.endTime ? `–${formatTime(shift.endTime)}` : ""}
        {shift.category ? ` · ${shift.category}` : ""}
      </p>
      {shift.description && (
        <p className="mt-2 text-sm text-sand-400">{shift.description}</p>
      )}
      {shift.signups.length > 1 && (
        <p className="mt-2 text-xs text-sand-500">
          With:{" "}
          {shift.signups
            .filter((r) => !r.isMe)
            .map((r) => r.name)
            .join(", ")}
        </p>
      )}

      <div className="mt-4">
        {checkedIn ? (
          <div className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500/15 text-base font-semibold text-emerald-300 ring-1 ring-emerald-500/30">
            <CheckCircle2 className="h-5 w-5" /> Checked in
          </div>
        ) : (
          <Button
            className="h-14 w-full bg-emerald-500 text-base font-semibold text-blue-950 hover:bg-emerald-400 disabled:opacity-50"
            disabled={busy || !inWindow}
            title={
              inWindow
                ? undefined
                : "Check-in opens 3 hours before your shift"
            }
            onClick={onCheckIn}
          >
            <CheckCircle2 className="mr-2 h-5 w-5" />
            {busy ? "Checking in…" : "I'm here ✓"}
          </Button>
        )}
        {!checkedIn && !inWindow && (
          <p className="mt-1.5 text-center text-xs text-sand-500">
            Check-in opens 3 hours before your shift.
          </p>
        )}
      </div>
    </motion.div>
  );
}

// ── Closed board (post-burn) ─────────────────────────────────────────

function ClosedBoard({ data }: { data: JobsBoardData }) {
  const { shifts, progress, leaderboard } = data;
  const myShifts = shifts.filter((s) => s.mine);
  const me = leaderboard.find((e) => e.isMe);
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Card className="glass-card border-0">
        <CardContent className="space-y-3 py-6 text-center">
          <Flame className="mx-auto h-8 w-8 text-amber" />
          <h2 className="text-lg font-semibold text-sand-100">
            2026 board is closed — thanks for pitching in
          </h2>
          <p className="text-sm text-sand-400">
            You put in{" "}
            <span className="font-semibold text-sand-200">
              {progress.totalPoints} point{progress.totalPoints === 1 ? "" : "s"}
            </span>{" "}
            across {progress.shiftCount} shift
            {progress.shiftCount === 1 ? "" : "s"}
            {me ? ` · #${me.rank} on the leaderboard` : ""}.
          </p>
        </CardContent>
      </Card>

      {myShifts.length > 0 && (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-sand-200">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            My shifts
          </h2>
          <div className="space-y-2">
            {myShifts.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-sand-100">
                    {s.title}
                    {s.label ? ` — ${s.label}` : ""}
                  </p>
                  <p className="text-xs text-sand-400">
                    {formatDay(s.shiftDate)} · {formatTime(s.startTime)}
                    {s.endTime ? `–${formatTime(s.endTime)}` : ""} ·{" "}
                    {s.pointValue} pts
                  </p>
                </div>
                {s.myCheckedInAt && (
                  <Badge className="shrink-0 bg-emerald-500/15 text-emerald-300">
                    Checked in
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function NoticeCard({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl bg-amber/10 px-4 py-3 text-sm text-amber ring-1 ring-amber/20">
      <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" />
      <p>{children}</p>
    </div>
  );
}

function ShiftCard({
  shift,
  busy,
  canSignup,
  canDrop = true,
  onSignup,
  onDrop,
}: {
  shift: ShiftView;
  busy: boolean;
  canSignup: boolean;
  canDrop?: boolean;
  onSignup: () => void;
  onDrop: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col rounded-xl bg-white/5 p-4 ring-1 ring-white/10"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-sand-100">
            {shift.title}
            {shift.label ? ` — ${shift.label}` : ""}
          </p>
          <p className="mt-0.5 text-xs text-sand-400">
            {formatTime(shift.startTime)}
            {shift.endTime ? `–${formatTime(shift.endTime)}` : ""}
            {shift.category ? ` · ${shift.category}` : ""}
          </p>
        </div>
        <Badge className="shrink-0 bg-amber/15 text-amber">
          {shift.pointValue} pts
        </Badge>
      </div>

      {shift.description && (
        <p className="mt-2 line-clamp-2 text-xs text-sand-400">
          {shift.description}
        </p>
      )}

      <div className="mt-3 flex items-center gap-1.5 text-xs text-sand-400">
        <Users className="h-3.5 w-3.5" />
        <span>
          {shift.filled} / {shift.capacity} filled
        </span>
      </div>

      {shift.signups.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {shift.signups.map((r) => (
            <span
              key={r.profileId}
              className={`rounded-full px-2 py-0.5 text-[11px] ${
                r.isMe
                  ? "bg-pink-500/20 text-pink-300"
                  : "bg-sand-700/30 text-sand-300"
              }`}
            >
              {r.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-3">
        {shift.mine ? (
          <Button
            size="sm"
            variant="outline"
            className="w-full"
            disabled={busy || !canDrop}
            title={canDrop ? undefined : DROP_LOCK_MSG}
            onClick={onDrop}
          >
            {canDrop ? (
              "Drop shift"
            ) : (
              <>
                <Lock className="mr-1 h-3.5 w-3.5" /> You&apos;re on it
              </>
            )}
          </Button>
        ) : shift.isFull ? (
          <Button size="sm" variant="outline" className="w-full" disabled>
            Full
          </Button>
        ) : (
          <Button
            size="sm"
            className="w-full bg-pink-500 hover:bg-pink-600"
            disabled={busy || !canSignup}
            onClick={onSignup}
          >
            {canSignup ? "Sign up" : "Locked"}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

// ── Admin: schedule ──────────────────────────────────────────────────

function AdminSchedule({
  data,
  refresh,
}: {
  data: JobsBoardData;
  refresh: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const activeDefs = data.definitions.filter((d) => d.active);

  const byDay = useMemo(() => {
    const map = new Map<string, ShiftView[]>();
    for (const s of data.shifts) {
      const arr = map.get(s.shiftDate) ?? [];
      arr.push(s);
      map.set(s.shiftDate, arr);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [data.shifts]);

  async function handleDelete(s: ShiftView) {
    if (!confirm(`Delete this ${s.title} shift? Signups will be removed.`))
      return;
    const res = await deleteJobShift(s.id);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success("Shift deleted");
      await refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-sand-400">
          Schedule dated shifts during burn week. Capacity defaults to the
          job&apos;s people-required.
        </p>
        <Button
          size="sm"
          className="bg-pink-500 hover:bg-pink-600"
          disabled={activeDefs.length === 0}
          onClick={() => setOpen(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Add shift
        </Button>
      </div>

      {activeDefs.length === 0 && (
        <NoticeCard icon={Briefcase}>
          Add a job to the Catalog first, then you can schedule shifts for it.
        </NoticeCard>
      )}

      {byDay.length === 0 ? (
        <Card className="glass-card border-0">
          <CardContent className="py-8 text-center text-sm text-sand-400">
            No shifts scheduled yet.
          </CardContent>
        </Card>
      ) : (
        byDay.map(([date, shifts]) => (
          <div key={date} className="space-y-2">
            <h3 className="text-sm font-semibold text-sand-200">
              {formatDay(date)}
            </h3>
            <div className="space-y-1.5">
              {shifts.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
                >
                  <div className="min-w-0">
                    <span className="text-sand-100">
                      {s.title}
                      {s.label ? ` — ${s.label}` : ""}
                    </span>
                    <span className="ml-2 text-xs text-sand-400">
                      {formatTime(s.startTime)}
                      {s.endTime ? `–${formatTime(s.endTime)}` : ""} ·{" "}
                      {s.filled}/{s.capacity} · {s.pointValue} pts
                    </span>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-sand-400 hover:text-red-400 pointer-coarse:h-10 pointer-coarse:w-10"
                    onClick={() => handleDelete(s)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}

      <ShiftDialog
        open={open}
        onOpenChange={setOpen}
        definitions={activeDefs}
        onSaved={refresh}
      />
    </div>
  );
}

function ShiftDialog({
  open,
  onOpenChange,
  definitions,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  definitions: JobDefinitionRow[];
  onSaved: () => Promise<void>;
}) {
  const [definitionId, setDefinitionId] = useState("");
  const [label, setLabel] = useState("");
  const [shiftDate, setShiftDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [capacity, setCapacity] = useState("");
  const [saving, setSaving] = useState(false);

  const selectedDef = definitions.find((d) => d.id === definitionId);

  function reset() {
    setDefinitionId("");
    setLabel("");
    setShiftDate("");
    setStartTime("");
    setEndTime("");
    setCapacity("");
  }

  async function handleSave() {
    const payload: JobShiftFormData = {
      definition_id: definitionId,
      label,
      shift_date: shiftDate,
      start_time: startTime,
      end_time: endTime,
      capacity: Number(capacity || selectedDef?.people_required || 1),
    };
    setSaving(true);
    const res = await createJobShift(payload);
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Shift added");
    reset();
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add shift</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sand-300">Job</Label>
            <Select value={definitionId} onValueChange={setDefinitionId}>
              <SelectTrigger>
                <SelectValue placeholder="Pick a job…" />
              </SelectTrigger>
              <SelectContent>
                {definitions.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.title} ({d.point_value} pts)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-sand-300">Date</Label>
              <Input
                type="date"
                value={shiftDate}
                onChange={(e) => setShiftDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sand-300">
                Capacity{" "}
                {selectedDef ? `(default ${selectedDef.people_required})` : ""}
              </Label>
              <Input
                type="number"
                min={1}
                placeholder={
                  selectedDef ? String(selectedDef.people_required) : "1"
                }
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sand-300">Start time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sand-300">End time (optional)</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label className="text-sand-300">Label (optional)</Label>
            <Input
              placeholder='e.g. dinner theme "Taco Night"'
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-pink-500 hover:bg-pink-600"
            disabled={saving || !definitionId || !shiftDate || !startTime}
            onClick={handleSave}
          >
            {saving ? "Saving…" : "Add shift"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Admin: catalog ───────────────────────────────────────────────────

function AdminCatalog({
  data,
  refresh,
}: {
  data: JobsBoardData;
  refresh: () => Promise<void>;
}) {
  const [editing, setEditing] = useState<JobDefinitionRow | null>(null);
  const [creating, setCreating] = useState(false);

  async function handleDelete(d: JobDefinitionRow) {
    if (
      !confirm(`Delete "${d.title}"? Its shifts and signups will be removed.`)
    )
      return;
    const res = await deleteJobDefinition(d.id);
    if ("error" in res) toast.error(res.error);
    else {
      toast.success("Job deleted");
      await refresh();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-sand-400">
          The catalog of jobs. Points = difficulty × 30-min blocks, computed
          automatically.
        </p>
        <Button
          size="sm"
          className="bg-pink-500 hover:bg-pink-600"
          onClick={() => setCreating(true)}
        >
          <Plus className="mr-1 h-4 w-4" /> Add job
        </Button>
      </div>

      <div className="space-y-1.5">
        {data.definitions.map((d) => (
          <div
            key={d.id}
            className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm ring-1 ring-white/10"
          >
            <div className="min-w-0">
              <span className="text-sand-100">{d.title}</span>
              {!d.active && (
                <Badge className="ml-2 bg-sand-700/40 text-sand-300">
                  inactive
                </Badge>
              )}
              <span className="ml-2 text-xs text-sand-400">
                {d.category ? `${d.category} · ` : ""}
                {d.people_required} ppl · {d.duration_min}m · diff {d.difficulty}{" "}
                · <span className="text-amber">{d.point_value} pts</span>
              </span>
            </div>
            <div className="flex shrink-0 gap-1 pointer-coarse:gap-2">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-sand-400 hover:text-sand-100 pointer-coarse:h-10 pointer-coarse:w-10"
                onClick={() => setEditing(d)}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-sand-400 hover:text-red-400 pointer-coarse:h-10 pointer-coarse:w-10"
                onClick={() => handleDelete(d)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
        {data.definitions.length === 0 && (
          <Card className="glass-card border-0">
            <CardContent className="py-8 text-center text-sm text-sand-400">
              No jobs yet. Add one to get started.
            </CardContent>
          </Card>
        )}
      </div>

      <DefinitionDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={refresh}
      />
      <DefinitionDialog
        open={!!editing}
        onOpenChange={(v) => !v && setEditing(null)}
        existing={editing ?? undefined}
        onSaved={refresh}
      />
    </div>
  );
}

function DefinitionDialog({
  open,
  onOpenChange,
  existing,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existing?: JobDefinitionRow;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(existing?.title ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [peopleRequired, setPeopleRequired] = useState(
    String(existing?.people_required ?? 1)
  );
  const [durationMin, setDurationMin] = useState(
    String(existing?.duration_min ?? 30)
  );
  const [difficulty, setDifficulty] = useState(
    String(existing?.difficulty ?? 1)
  );
  const [active, setActive] = useState(existing?.active ?? true);
  const [saving, setSaving] = useState(false);

  // Reset fields whenever the dialog opens for a different row.
  const key = existing?.id ?? "new";
  const [boundKey, setBoundKey] = useState(key);
  if (open && boundKey !== key) {
    setBoundKey(key);
    setTitle(existing?.title ?? "");
    setCategory(existing?.category ?? "");
    setDescription(existing?.description ?? "");
    setPeopleRequired(String(existing?.people_required ?? 1));
    setDurationMin(String(existing?.duration_min ?? 30));
    setDifficulty(String(existing?.difficulty ?? 1));
    setActive(existing?.active ?? true);
  }

  const previewPts = pointValue(Number(difficulty || 0), Number(durationMin || 0));

  async function handleSave() {
    const payload: JobDefinitionFormData = {
      title,
      category,
      description,
      people_required: Number(peopleRequired || 1),
      duration_min: Number(durationMin || 30),
      difficulty: Number(difficulty || 0),
      active,
    };
    setSaving(true);
    const res = existing
      ? await updateJobDefinition(existing.id, payload)
      : await createJobDefinition(payload);
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success(existing ? "Job updated" : "Job added");
    onOpenChange(false);
    await onSaved();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit job" : "Add job"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-sand-300">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label className="text-sand-300">Category</Label>
            <Input
              placeholder="Kitchen, Cleaning, Build…"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sand-300">Description</Label>
            <Textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-sand-300">People</Label>
              <Input
                type="number"
                min={1}
                value={peopleRequired}
                onChange={(e) => setPeopleRequired(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sand-300">Duration (min)</Label>
              <Input
                type="number"
                min={1}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-sand-300">Difficulty 0–10</Label>
              <Input
                type="number"
                min={0}
                max={10}
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
              />
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
            <span className="flex items-center gap-2 text-sm text-sand-300">
              <Checkbox
                checked={active}
                onCheckedChange={(v) => setActive(!!v)}
              />
              Active (available to schedule)
            </span>
            <Badge className="bg-amber/15 text-amber">{previewPts} pts</Badge>
          </div>
        </div>
        <DialogFooter>
          <Button
            className="bg-pink-500 hover:bg-pink-600"
            disabled={saving || !title.trim()}
            onClick={handleSave}
          >
            {saving ? "Saving…" : existing ? "Save" : "Add job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Admin: settings ──────────────────────────────────────────────────

/** ISO instant → value for <input type="datetime-local"> in local time. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function AdminSettings({
  data,
  refresh,
}: {
  data: JobsBoardData;
  refresh: () => Promise<void>;
}) {
  const s = data.settings;
  const [opensAt, setOpensAt] = useState(isoToLocalInput(s?.signupOpensAt ?? null));
  const [earlyEnabled, setEarlyEnabled] = useState(s?.earlyAccessEnabled ?? true);
  const [threshold, setThreshold] = useState(
    String(s?.earlyAccessYearsThreshold ?? 2)
  );
  const [hours, setHours] = useState(String(s?.earlyAccessHours ?? 24));
  const [target, setTarget] = useState(String(s?.pointsTarget ?? 0));
  const [boardMode, setBoardMode] = useState<BoardModeSetting>(
    s?.boardMode ?? "auto"
  );
  const [dropLockAt, setDropLockAt] = useState(
    isoToLocalInput(s?.dropLockAt ?? null)
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    const res = await updateJobBoardSettings({
      // datetime-local has no TZ; interpret as the admin's local time.
      signup_opens_at: opensAt ? new Date(opensAt).toISOString() : "",
      early_access_enabled: earlyEnabled,
      early_access_years_threshold: Number(threshold || 2),
      early_access_hours: Number(hours || 24),
      points_target: Number(target || 0),
      board_mode: boardMode,
      drop_lock_at: dropLockAt ? new Date(dropLockAt).toISOString() : "",
    });
    setSaving(false);
    if ("error" in res) {
      toast.error(res.error);
      return;
    }
    toast.success("Settings saved");
    await refresh();
  }

  return (
    <Card className="glass-card max-w-xl border-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sand-200">
          <Settings className="h-4 w-4 text-pink-400" />
          Board settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label className="text-sand-300">Signups open at</Label>
          <Input
            type="datetime-local"
            value={opensAt}
            onChange={(e) => setOpensAt(e.target.value)}
          />
          <p className="mt-1 text-xs text-sand-500">
            Leave blank to open immediately (no window).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            checked={earlyEnabled}
            onCheckedChange={(v) => setEarlyEnabled(!!v)}
          />
          <span className="text-sm text-sand-300">
            Senior early access head start
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sand-300">NODE years to qualify</Label>
            <Input
              type="number"
              min={1}
              disabled={!earlyEnabled}
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-sand-300">Head start (hours)</Label>
            <Input
              type="number"
              min={0}
              disabled={!earlyEnabled}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
            />
          </div>
        </div>

        <div>
          <Label className="text-sand-300">Points target per camper</Label>
          <Input
            type="number"
            min={0}
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
          <p className="mt-1 text-xs text-sand-500">
            Shown as a progress goal. 0 = no target.
          </p>
        </div>

        <div className="space-y-4 rounded-lg border border-amber/10 bg-blue-950/20 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-sand-400">
            On-playa mode
          </p>
          <div>
            <Label className="text-sand-300">Board mode</Label>
            <Select
              value={boardMode}
              onValueChange={(v) => setBoardMode(v as BoardModeSetting)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (from camp dates)</SelectItem>
                <SelectItem value="prep">Pre-playa</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-sand-500">
              Currently resolving to{" "}
              <span className="font-semibold text-sand-300">{data.mode}</span>.
              Auto goes live on the camp start date and closes after the end
              date. Live + Closed lock drops automatically.
            </p>
          </div>
          <div>
            <Label className="text-sand-300">Lock drops after</Label>
            <Input
              type="datetime-local"
              value={dropLockAt}
              onChange={(e) => setDropLockAt(e.target.value)}
            />
            <p className="mt-1 text-xs text-sand-500">
              Members can&apos;t drop shifts after this time. Blank = drops
              allowed until the board goes live.
              {data.dropLocked && " Drops are currently locked."}
            </p>
          </div>
        </div>

        <Button
          className="bg-pink-500 hover:bg-pink-600"
          disabled={saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
