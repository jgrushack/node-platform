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
} from "@/lib/types/job";

const YEAR = 2026;

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
    .select("id")
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
  type SignupRow = { shift_id: string; profile_id: string };
  let signups: SignupRow[] = [];
  if (shiftIds.length > 0) {
    const { data } = await admin
      .from("job_signups")
      .select("shift_id, profile_id")
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
      profileId: s.profile_id,
      name: nameById.get(s.profile_id) ?? "Camper",
      isMe: s.profile_id === user.id,
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
      "signup_opens_at, early_access_enabled, early_access_years_threshold, early_access_hours, points_target"
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
      }
    : null;

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
  const progress: MyJobProgress = {
    totalPoints: myAgg.points,
    shiftCount: myAgg.count,
    pointsTarget,
    onTrack:
      pointsTarget > 0 ? myAgg.points >= pointsTarget : myAgg.count > 0,
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
