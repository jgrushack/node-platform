"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  jobDefinitionSchema,
  jobShiftSchema,
  jobBoardSettingsSchema,
  type JobDefinitionFormData,
  type JobShiftFormData,
  type JobBoardSettingsFormData,
  type JobDefinitionRow,
  type ShiftView,
  type ShiftSignup,
  type LeaderboardEntry,
  type JobBoardSettings,
  type SignupWindow,
  type MyJobProgress,
  type BoardMode,
  type BoardModeSetting,
  type MyNextShift,
} from "@/lib/types/job";

const YEAR = 2026;

// ── Playa-local time helpers (America/Los_Angeles) ───────────────────

const PLAYA_TZ = "America/Los_Angeles";

function playaParts(d: Date): { y: number; m: number; d: number; h: number; mi: number } {
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
  for (const p of fmt.formatToParts(d)) map[p.type] = p.value;
  return {
    y: Number(map.year),
    m: Number(map.month),
    d: Number(map.day),
    h: Number(map.hour) % 24,
    mi: Number(map.minute),
  };
}

/** Today's date on playa as YYYY-MM-DD. */
function playaToday(now = new Date()): string {
  const p = playaParts(now);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`;
}

/** Playa-local wall time (date + HH:MM) → epoch ms. */
function playaLocalToMs(dateStr: string, hhmm: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, mi);
  const p = playaParts(new Date(guess));
  const asLocal = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  const offset = asLocal - guess; // ms playa is ahead of UTC (negative)
  return guess - offset;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

type ModeInputs = {
  boardMode: BoardModeSetting | null | undefined;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
};

/** Resolve the effective board mode for a given playa date. */
function resolveMode(inp: ModeInputs, today: string): BoardMode {
  if (inp.boardMode && inp.boardMode !== "auto") return inp.boardMode;
  if (inp.startDate && inp.endDate) {
    if (today > inp.endDate) return "closed";
    if (today >= inp.startDate) return "live";
  }
  return "prep";
}

/** Small shared loader: camp year + board settings + resolved mode. */
async function loadModeContext(admin: ReturnType<typeof createAdminClient>) {
  const { data: campYear } = await admin
    .from("camp_years")
    .select("id, start_date, end_date")
    .eq("year", YEAR)
    .single();
  if (!campYear) return null;
  const { data: settingsRow } = await admin
    .from("job_board_settings")
    .select("board_mode, drop_lock_at")
    .eq("camp_year_id", campYear.id)
    .maybeSingle();
  const todayPlaya = playaToday();
  const mode = resolveMode(
    {
      boardMode: settingsRow?.board_mode as BoardModeSetting | undefined,
      startDate: campYear.start_date,
      endDate: campYear.end_date,
    },
    todayPlaya
  );
  const dropLocked =
    !!settingsRow?.drop_lock_at &&
    Date.now() >= new Date(settingsRow.drop_lock_at).getTime();
  return { campYearId: campYear.id as string, mode, dropLocked, todayPlaya };
}

function displayName(p: {
  first_name: string | null;
  last_name: string | null;
  playa_name: string | null;
}): string {
  const real = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
  return (p.playa_name?.trim() || real || "Camper");
}

// ── Board (member + admin) ───────────────────────────────────────────

export type JobsBoardData = {
  isAdmin: boolean;
  isConfirmedCamper: boolean;
  shifts: ShiftView[];
  definitions: JobDefinitionRow[];
  settings: JobBoardSettings | null;
  window: SignupWindow;
  progress: MyJobProgress;
  leaderboard: LeaderboardEntry[];
  /** Resolved board mode: pre-playa, on-playa live, or closed. */
  mode: BoardMode;
  /** True once members can no longer drop shifts themselves. */
  dropLocked: boolean;
  /** Today's date on playa (America/Los_Angeles), YYYY-MM-DD. */
  todayPlaya: string;
};

export type GetJobsBoardResult = { error: string } | JobsBoardData;

/** Everything the jobs page needs in a single round trip. */
export async function getJobsBoard(): Promise<GetJobsBoardResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const isAdmin = !!me && ["admin", "super_admin"].includes(me.role);

  // Cross-member rosters + leaderboard are an intentional camp-wide display,
  // so they're read with the service-role client (mirrors getRentalsAdmin).
  const admin = createAdminClient();

  const { data: campYear } = await admin
    .from("camp_years")
    .select("id, start_date, end_date")
    .eq("year", YEAR)
    .single();
  if (!campYear) return { error: "No 2026 camp year configured." };

  // Confirmed-camper + tenure (distinct non-cancelled registration years).
  const { data: myRegs } = await admin
    .from("registrations")
    .select("camp_year_id, status, camp_years(year)")
    .eq("profile_id", user.id);
  const isConfirmedCamper = (myRegs ?? []).some(
    (r: { camp_year_id: string; status: string }) =>
      r.camp_year_id === campYear.id && r.status === "confirmed"
  );
  const tenureYears = new Set(
    (myRegs ?? [])
      .filter((r: { status: string }) => r.status !== "cancelled")
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((r: any) => r.camp_years?.year)
      .filter((y: number | undefined): y is number => typeof y === "number")
  ).size;

  // Definitions catalog.
  const { data: defs } = await admin
    .from("job_definitions")
    .select(
      "id, title, description, category, people_required, duration_min, difficulty, point_value, active, sort_order"
    )
    .eq("camp_year_id", campYear.id)
    .order("sort_order");
  const definitions: JobDefinitionRow[] = (defs ?? []) as JobDefinitionRow[];
  const defById = new Map(definitions.map((d) => [d.id, d]));

  // Shifts.
  const { data: shiftRows } = await admin
    .from("job_shifts")
    .select(
      "id, definition_id, label, shift_date, start_time, end_time, capacity"
    )
    .eq("camp_year_id", campYear.id)
    .order("shift_date")
    .order("start_time");
  const shifts = shiftRows ?? [];
  const shiftIds = shifts.map((s: { id: string }) => s.id);

  // Signups across all shifts → rosters, leaderboard, my points.
  type SignupRow = {
    id: string;
    shift_id: string;
    profile_id: string;
    checked_in_at: string | null;
    no_show: boolean;
  };
  let signups: SignupRow[] = [];
  if (shiftIds.length > 0) {
    const { data } = await admin
      .from("job_signups")
      .select("id, shift_id, profile_id, checked_in_at, no_show")
      .in("shift_id", shiftIds);
    signups = (data ?? []) as SignupRow[];
  }

  // Resolve names for everyone who signed up.
  const profileIds = Array.from(new Set(signups.map((s) => s.profile_id)));
  const nameById = new Map<string, string>();
  if (profileIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, first_name, last_name, playa_name")
      .in("id", profileIds);
    (profs ?? []).forEach(
      (p: {
        id: string;
        first_name: string | null;
        last_name: string | null;
        playa_name: string | null;
      }) => nameById.set(p.id, displayName(p))
    );
  }

  const rosterByShift = new Map<string, ShiftSignup[]>();
  const pointsByProfile = new Map<string, { points: number; count: number }>();
  for (const s of signups) {
    const shift = shifts.find((x: { id: string }) => x.id === s.shift_id);
    const def = shift ? defById.get(shift.definition_id) : undefined;
    const pts = def?.point_value ?? 0;

    const roster = rosterByShift.get(s.shift_id) ?? [];
    roster.push({
      signupId: s.id,
      profileId: s.profile_id,
      name: nameById.get(s.profile_id) ?? "Camper",
      isMe: s.profile_id === user.id,
      checkedInAt: s.checked_in_at,
      noShow: !!s.no_show,
    });
    rosterByShift.set(s.shift_id, roster);

    const agg = pointsByProfile.get(s.profile_id) ?? { points: 0, count: 0 };
    agg.points += pts;
    agg.count += 1;
    pointsByProfile.set(s.profile_id, agg);
  }

  const shiftViews: ShiftView[] = shifts.map(
    (s: {
      id: string;
      definition_id: string;
      label: string | null;
      shift_date: string;
      start_time: string;
      end_time: string | null;
      capacity: number;
    }) => {
      const def = defById.get(s.definition_id);
      const roster = rosterByShift.get(s.id) ?? [];
      return {
        id: s.id,
        definitionId: s.definition_id,
        title: def?.title ?? "Job",
        category: def?.category ?? null,
        description: def?.description ?? null,
        label: s.label,
        shiftDate: s.shift_date,
        startTime: s.start_time.slice(0, 5),
        endTime: s.end_time ? s.end_time.slice(0, 5) : null,
        capacity: s.capacity,
        pointValue: def?.point_value ?? 0,
        signups: roster,
        filled: roster.length,
        isFull: roster.length >= s.capacity,
        mine: roster.some((r) => r.isMe),
        myCheckedInAt: roster.find((r) => r.isMe)?.checkedInAt ?? null,
      };
    }
  );

  // Leaderboard (camp-wide, ranked).
  const leaderboard: LeaderboardEntry[] = Array.from(pointsByProfile.entries())
    .map(([profileId, agg]) => ({
      profileId,
      name: nameById.get(profileId) ?? "Camper",
      totalPoints: agg.points,
      shiftCount: agg.count,
      isMe: profileId === user.id,
      rank: 0,
    }))
    .sort(
      (a, b) =>
        b.totalPoints - a.totalPoints ||
        b.shiftCount - a.shiftCount ||
        a.name.localeCompare(b.name)
    )
    .map((e, i) => ({ ...e, rank: i + 1 }));

  // Settings.
  const { data: settingsRow } = await admin
    .from("job_board_settings")
    .select(
      "signup_opens_at, early_access_enabled, early_access_years_threshold, early_access_hours, points_target, board_mode, drop_lock_at"
    )
    .eq("camp_year_id", campYear.id)
    .maybeSingle();

  const settings: JobBoardSettings | null = settingsRow
    ? {
        signupOpensAt: settingsRow.signup_opens_at,
        earlyAccessEnabled: settingsRow.early_access_enabled,
        earlyAccessYearsThreshold: settingsRow.early_access_years_threshold,
        earlyAccessHours: settingsRow.early_access_hours,
        pointsTarget: settingsRow.points_target,
        boardMode: (settingsRow.board_mode as BoardModeSetting) ?? "auto",
        dropLockAt: settingsRow.drop_lock_at ?? null,
      }
    : null;

  // Board mode (prep / live / closed) + drop lock.
  const todayPlaya = playaToday();
  const mode = resolveMode(
    {
      boardMode: settings?.boardMode,
      startDate: campYear.start_date,
      endDate: campYear.end_date,
    },
    todayPlaya
  );
  const dropLocked =
    !!settings?.dropLockAt &&
    Date.now() >= new Date(settings.dropLockAt).getTime();

  // Resolve this member's signup window.
  let signupWindow: SignupWindow = { open: true, opensAt: null, earlyAccess: false };
  if (settings && settings.signupOpensAt) {
    const earlyAccess =
      settings.earlyAccessEnabled &&
      tenureYears >= settings.earlyAccessYearsThreshold;
    const base = new Date(settings.signupOpensAt).getTime();
    const opensAtMs = earlyAccess
      ? base - settings.earlyAccessHours * 3600_000
      : base;
    signupWindow = {
      open: Date.now() >= opensAtMs,
      opensAt: new Date(opensAtMs).toISOString(),
      earlyAccess,
    };
  }

  const myAgg = pointsByProfile.get(user.id) ?? { points: 0, count: 0 };
  const pointsTarget = settings?.pointsTarget ?? 0;
  const myShifts = shiftViews.filter((s) => s.mine);
  const progress: MyJobProgress = {
    totalPoints: myAgg.points,
    shiftCount: myAgg.count,
    pointsTarget,
    onTrack:
      pointsTarget > 0 ? myAgg.points >= pointsTarget : myAgg.count > 0,
    hasStrikeShift: myShifts.some((s) => s.category === "Strike"),
    hasBbqShift: myShifts.some((s) => s.category === "BBQ"),
  };

  return {
    isAdmin,
    isConfirmedCamper,
    shifts: shiftViews,
    definitions,
    settings,
    window: signupWindow,
    progress,
    leaderboard,
    mode,
    dropLocked,
    todayPlaya,
  };
}

// ── Member signup / drop ─────────────────────────────────────────────

export type SignupResult = { success: true } | { error: string };

export async function signUpForShift(shiftId: string): Promise<SignupResult> {
  if (!shiftId || typeof shiftId !== "string") return { error: "Invalid shift" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // User-scoped RPC so auth.uid() resolves inside SECURITY DEFINER.
  const { error } = await supabase.rpc("signup_for_shift", {
    p_shift_id: shiftId,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("shift full"))
      return { error: "That shift just filled up. Try another slot." };
    if (msg.includes("not a confirmed camper"))
      return { error: "Only confirmed 2026 campers can sign up for shifts." };
    if (msg.includes("signups not open"))
      return { error: "Signups aren't open for you yet." };
    if (msg.includes("shift not found"))
      return { error: "That shift no longer exists." };
    console.error("[signUpForShift]", error);
    return { error: "Couldn't sign you up. Please try again." };
  }
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function dropShift(shiftId: string): Promise<SignupResult> {
  if (!shiftId || typeof shiftId !== "string") return { error: "Invalid shift" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // On playa (or once the admin lock kicks in) members can't drop —
  // rosters are printed and crews are counting on them.
  const ctx = await loadModeContext(createAdminClient());
  if (ctx && (ctx.dropLocked || ctx.mode !== "prep")) {
    return {
      error: "Drops are locked — find someone to swap and ask a lead.",
    };
  }

  const { error } = await supabase
    .from("job_signups")
    .delete()
    .eq("shift_id", shiftId)
    .eq("profile_id", user.id);
  if (error) {
    console.error("[dropShift]", error);
    return { error: "Couldn't drop the shift. Please try again." };
  }
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}

// ── On-playa: check-in, attendance, dashboard helpers ────────────────

/** Members may self check-in this many ms either side of a shift start. */
const CHECKIN_WINDOW_MS = 3 * 3600_000;

/** Self check-in on my own signup (live mode, within ±3h of shift start). */
export async function checkInToShift(shiftId: string): Promise<SignupResult> {
  if (!shiftId || typeof shiftId !== "string") return { error: "Invalid shift" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const ctx = await loadModeContext(admin);
  if (!ctx) return { error: "No 2026 camp year configured." };
  if (ctx.mode !== "live")
    return { error: "Check-in opens once we're on playa." };

  const { data: shift } = await admin
    .from("job_shifts")
    .select("id, shift_date, start_time")
    .eq("id", shiftId)
    .eq("camp_year_id", ctx.campYearId)
    .maybeSingle();
  if (!shift) return { error: "That shift no longer exists." };

  const startMs = playaLocalToMs(shift.shift_date, shift.start_time.slice(0, 5));
  const delta = Date.now() - startMs;
  if (delta < -CHECKIN_WINDOW_MS)
    return { error: "Too early — check-in opens 3 hours before your shift." };
  if (delta > CHECKIN_WINDOW_MS)
    return { error: "Check-in window has passed — ask a lead to mark you in." };

  // User-scoped update; RLS limits this to my own signup row.
  const { data: updated, error } = await supabase
    .from("job_signups")
    .update({ checked_in_at: new Date().toISOString(), checked_in_by: user.id })
    .eq("shift_id", shiftId)
    .eq("profile_id", user.id)
    .select("id");
  if (error) {
    console.error("[checkInToShift]", error);
    return { error: "Couldn't check you in. Please try again." };
  }
  if (!updated || updated.length === 0)
    return { error: "You're not signed up for that shift." };
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}

/** Admin/lead: mark a signup checked-in and/or no-show. */
export async function setSignupAttendance(
  signupId: string,
  input: { checkedIn: boolean; noShow: boolean }
): Promise<MutationResult> {
  if (!signupId || typeof signupId !== "string") return { error: "Invalid signup" };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const { error } = await ctx.admin
    .from("job_signups")
    .update({
      checked_in_at: input.checkedIn ? new Date().toISOString() : null,
      checked_in_by: input.checkedIn ? ctx.userId : null,
      no_show: !!input.noShow,
    })
    .eq("id", signupId);
  if (error) {
    console.error("[setSignupAttendance]", error);
    return { error: "Couldn't update attendance." };
  }
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard/jobs/day-sheet");
  return { success: true };
}

export type OpenShiftSoon = {
  id: string;
  title: string;
  label: string | null;
  category: string | null;
  date: string; // YYYY-MM-DD
  start: string; // HH:MM
  end: string | null;
  filled: number;
  capacity: number;
  pointValue: number;
  mine: boolean;
};

/**
 * Live mode only: today/tomorrow shifts that still need people, soonest
 * first. Returns [] outside live mode. Used by the dashboard.
 */
export async function getOpenShiftsSoon(): Promise<OpenShiftSoon[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const admin = createAdminClient();
  const ctx = await loadModeContext(admin);
  if (!ctx || ctx.mode !== "live") return [];

  const { data: shifts } = await admin
    .from("job_shifts")
    .select("id, definition_id, label, shift_date, start_time, end_time, capacity")
    .eq("camp_year_id", ctx.campYearId)
    .in("shift_date", [ctx.todayPlaya, addDays(ctx.todayPlaya, 1)])
    .order("shift_date")
    .order("start_time");
  if (!shifts || shifts.length === 0) return [];

  const ids = shifts.map((s: { id: string }) => s.id);
  const { data: signups } = await admin
    .from("job_signups")
    .select("shift_id, profile_id")
    .in("shift_id", ids);
  const countBy = new Map<string, number>();
  const mineSet = new Set<string>();
  for (const s of signups ?? []) {
    countBy.set(s.shift_id, (countBy.get(s.shift_id) ?? 0) + 1);
    if (s.profile_id === user.id) mineSet.add(s.shift_id);
  }
  const defIds = Array.from(
    new Set(shifts.map((s: { definition_id: string }) => s.definition_id))
  );
  const { data: defs } = await admin
    .from("job_definitions")
    .select("id, title, category, point_value")
    .in("id", defIds);
  const defById = new Map(
    (defs ?? []).map((d: { id: string }) => [d.id, d as { id: string; title: string; category: string | null; point_value: number }])
  );

  const now = Date.now();
  return shifts
    .map((s: { id: string; definition_id: string; label: string | null; shift_date: string; start_time: string; end_time: string | null; capacity: number }) => {
      const def = defById.get(s.definition_id);
      const filled = countBy.get(s.id) ?? 0;
      return {
        id: s.id,
        title: def?.title ?? "Job",
        label: s.label,
        category: def?.category ?? null,
        date: s.shift_date,
        start: s.start_time.slice(0, 5),
        end: s.end_time ? s.end_time.slice(0, 5) : null,
        filled,
        capacity: s.capacity,
        pointValue: def?.point_value ?? 0,
        mine: mineSet.has(s.id),
      };
    })
    .filter((s) => s.filled < s.capacity)
    // Hide shifts whose end has already passed today.
    .filter((s) => {
      const endMs = playaLocalToMs(s.date, s.end ?? s.start) + (s.end ? 0 : 3600_000);
      return endMs >= now;
    });
}

/**
 * The current member's next upcoming shift (playa-local), or null.
 * Includes a shift that's in progress right now. Used by the dashboard.
 */
export async function getMyNextShift(): Promise<MyNextShift | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const ctx = await loadModeContext(admin);
  if (!ctx) return null;

  const { data: mySignups } = await admin
    .from("job_signups")
    .select("shift_id, checked_in_at")
    .eq("profile_id", user.id);
  if (!mySignups || mySignups.length === 0) return null;
  const checkedBy = new Map<string, string | null>(
    mySignups.map((r: { shift_id: string; checked_in_at: string | null }) => [
      r.shift_id,
      r.checked_in_at,
    ])
  );

  const { data: shifts } = await admin
    .from("job_shifts")
    .select("id, definition_id, label, shift_date, start_time, end_time")
    .eq("camp_year_id", ctx.campYearId)
    .in("id", Array.from(checkedBy.keys()))
    .order("shift_date")
    .order("start_time");
  if (!shifts || shifts.length === 0) return null;

  const now = Date.now();
  const next = shifts.find(
    (s: { shift_date: string; start_time: string; end_time: string | null }) => {
      const endMs = s.end_time
        ? playaLocalToMs(s.shift_date, s.end_time.slice(0, 5))
        : playaLocalToMs(s.shift_date, s.start_time.slice(0, 5)) + 3600_000;
      return endMs >= now;
    }
  );
  if (!next) return null;

  const { data: def } = await admin
    .from("job_definitions")
    .select("title")
    .eq("id", next.definition_id)
    .maybeSingle();

  return {
    id: next.id,
    title: def?.title ?? "Job",
    label: next.label,
    date: next.shift_date,
    start: next.start_time.slice(0, 5),
    end: next.end_time ? next.end_time.slice(0, 5) : null,
    checkedIn: !!checkedBy.get(next.id),
  };
}

// ── Lightweight progress (for the dashboard Road-to-2026 row) ────────

export type MyJobProgressResult = { error: string } | MyJobProgress;

export async function getMyJobProgress(): Promise<MyJobProgressResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: campYear } = await admin
    .from("camp_years")
    .select("id")
    .eq("year", YEAR)
    .single();
  if (!campYear)
    return { totalPoints: 0, shiftCount: 0, pointsTarget: 0, onTrack: false };

  const { data: settingsRow } = await admin
    .from("job_board_settings")
    .select("points_target")
    .eq("camp_year_id", campYear.id)
    .maybeSingle();
  const pointsTarget = settingsRow?.points_target ?? 0;

  const { data: myRows } = await admin
    .from("job_signups")
    .select("shift_id")
    .eq("profile_id", user.id);
  const shiftIds = (myRows ?? []).map((r: { shift_id: string }) => r.shift_id);
  if (shiftIds.length === 0)
    return { totalPoints: 0, shiftCount: 0, pointsTarget, onTrack: false };

  const { data: shifts } = await admin
    .from("job_shifts")
    .select("id, definition_id")
    .in("id", shiftIds)
    .eq("camp_year_id", campYear.id);
  const defIds = Array.from(
    new Set((shifts ?? []).map((s: { definition_id: string }) => s.definition_id))
  );
  const ptsByDef = new Map<string, number>();
  if (defIds.length > 0) {
    const { data: defs } = await admin
      .from("job_definitions")
      .select("id, point_value")
      .in("id", defIds);
    (defs ?? []).forEach((d: { id: string; point_value: number }) =>
      ptsByDef.set(d.id, d.point_value)
    );
  }

  let totalPoints = 0;
  let shiftCount = 0;
  for (const s of shifts ?? []) {
    totalPoints += ptsByDef.get((s as { definition_id: string }).definition_id) ?? 0;
    shiftCount += 1;
  }
  const onTrack = pointsTarget > 0 ? totalPoints >= pointsTarget : shiftCount > 0;
  return { totalPoints, shiftCount, pointsTarget, onTrack };
}

// ── Admin: definitions, shifts, settings ─────────────────────────────

type AdminCtx = { admin: ReturnType<typeof createAdminClient>; userId: string; campYearId: string };

async function requireAdmin(): Promise<AdminCtx | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data: me } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!me || !["admin", "super_admin"].includes(me.role))
    return { error: "Not authorized" };
  const admin = createAdminClient();
  const { data: campYear } = await admin
    .from("camp_years")
    .select("id")
    .eq("year", YEAR)
    .single();
  if (!campYear) return { error: "No 2026 camp year configured." };
  return { admin, userId: user.id, campYearId: campYear.id };
}

export type MutationResult = { success: true } | { error: string };

export async function createJobDefinition(
  input: JobDefinitionFormData
): Promise<MutationResult> {
  const parsed = jobDefinitionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const d = parsed.data;
  const { error } = await ctx.admin.from("job_definitions").insert({
    camp_year_id: ctx.campYearId,
    title: d.title,
    description: d.description || null,
    category: d.category || null,
    people_required: d.people_required,
    duration_min: d.duration_min,
    difficulty: d.difficulty,
    active: d.active ?? true,
    sort_order: d.sort_order ?? 0,
    created_by: ctx.userId,
  });
  if (error) {
    console.error("[createJobDefinition]", error);
    return { error: "Couldn't create the job." };
  }
  revalidatePath("/dashboard/jobs");
  return { success: true };
}

export async function updateJobDefinition(
  id: string,
  input: JobDefinitionFormData
): Promise<MutationResult> {
  const parsed = jobDefinitionSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const d = parsed.data;
  const { error } = await ctx.admin
    .from("job_definitions")
    .update({
      title: d.title,
      description: d.description || null,
      category: d.category || null,
      people_required: d.people_required,
      duration_min: d.duration_min,
      difficulty: d.difficulty,
      active: d.active ?? true,
      sort_order: d.sort_order ?? 0,
    })
    .eq("id", id)
    .eq("camp_year_id", ctx.campYearId);
  if (error) {
    console.error("[updateJobDefinition]", error);
    return { error: "Couldn't update the job." };
  }
  revalidatePath("/dashboard/jobs");
  return { success: true };
}

export async function deleteJobDefinition(id: string): Promise<MutationResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  // Cascades to its shifts and their signups.
  const { error } = await ctx.admin
    .from("job_definitions")
    .delete()
    .eq("id", id)
    .eq("camp_year_id", ctx.campYearId);
  if (error) {
    console.error("[deleteJobDefinition]", error);
    return { error: "Couldn't delete the job." };
  }
  revalidatePath("/dashboard/jobs");
  return { success: true };
}

export async function createJobShift(
  input: JobShiftFormData
): Promise<MutationResult> {
  const parsed = jobShiftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const d = parsed.data;
  const { error } = await ctx.admin.from("job_shifts").insert({
    camp_year_id: ctx.campYearId,
    definition_id: d.definition_id,
    label: d.label || null,
    shift_date: d.shift_date,
    start_time: d.start_time,
    end_time: d.end_time || null,
    capacity: d.capacity,
    notes: d.notes || null,
    created_by: ctx.userId,
  });
  if (error) {
    console.error("[createJobShift]", error);
    return { error: "Couldn't create the shift." };
  }
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateJobShift(
  id: string,
  input: JobShiftFormData
): Promise<MutationResult> {
  const parsed = jobShiftSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const d = parsed.data;
  const { error } = await ctx.admin
    .from("job_shifts")
    .update({
      definition_id: d.definition_id,
      label: d.label || null,
      shift_date: d.shift_date,
      start_time: d.start_time,
      end_time: d.end_time || null,
      capacity: d.capacity,
      notes: d.notes || null,
    })
    .eq("id", id)
    .eq("camp_year_id", ctx.campYearId);
  if (error) {
    console.error("[updateJobShift]", error);
    return { error: "Couldn't update the shift." };
  }
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteJobShift(id: string): Promise<MutationResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const { error } = await ctx.admin
    .from("job_shifts")
    .delete()
    .eq("id", id)
    .eq("camp_year_id", ctx.campYearId);
  if (error) {
    console.error("[deleteJobShift]", error);
    return { error: "Couldn't delete the shift." };
  }
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateJobBoardSettings(
  input: JobBoardSettingsFormData
): Promise<MutationResult> {
  const parsed = jobBoardSettingsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const d = parsed.data;
  const { error } = await ctx.admin.from("job_board_settings").upsert(
    {
      camp_year_id: ctx.campYearId,
      signup_opens_at: d.signup_opens_at ? d.signup_opens_at : null,
      early_access_enabled: d.early_access_enabled,
      early_access_years_threshold: d.early_access_years_threshold,
      early_access_hours: d.early_access_hours,
      points_target: d.points_target,
      board_mode: d.board_mode ?? "auto",
      drop_lock_at: d.drop_lock_at ? d.drop_lock_at : null,
      updated_by: ctx.userId,
    },
    { onConflict: "camp_year_id" }
  );
  if (error) {
    console.error("[updateJobBoardSettings]", error);
    return { error: "Couldn't save settings." };
  }
  revalidatePath("/dashboard/jobs");
  revalidatePath("/dashboard");
  return { success: true };
}
