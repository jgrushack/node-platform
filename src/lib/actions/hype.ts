"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendLockedInEmail } from "@/lib/email/send";

const CAMP_YEAR = 2026;
const PLAYA_TZ = "America/Los_Angeles";

export interface HypeData {
  /** Camp year dates (playa-local YYYY-MM-DD) — null if not configured. */
  startDate: string | null;
  endDate: string | null;
  /** Today's date on playa (YYYY-MM-DD). */
  todayPlaya: string;
  /** Whole days until gate (negative once we're there). */
  daysToGate: number | null;
  phase: "before" | "during" | "after";
  /** When this camper first completed the checklist, if ever. */
  readyAt: string | null;
  me: {
    arrivalDate: string | null;
    departureDate: string | null;
    renoArrivalDate: string | null;
    firstShift: {
      id: string;
      title: string;
      label: string | null;
      shiftDate: string;
      startTime: string;
    } | null;
  };
  /** Campers landing in Reno the same day as me (first names). */
  renoBuddies: string[];
  /** Campers arriving on playa the same day as me (first names). */
  arrivalBuddies: string[];
  pulse: {
    confirmed: number;
    ready: number;
    slotsTotal: number;
    slotsFilled: number;
  };
}

function playaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PLAYA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round(
    (Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86_400_000
  );
}

async function loadContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: campYear } = await admin
    .from("camp_years")
    .select("id, start_date, end_date")
    .eq("year", CAMP_YEAR)
    .single();
  if (!campYear) return null;

  const { data: reg } = await admin
    .from("registrations")
    .select(
      "id, status, arrival_date, departure_date, reno_arrival_date, ready_at"
    )
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .maybeSingle();

  return { user, admin, campYear, reg };
}

export async function getHypeData(): Promise<HypeData | { error: string }> {
  const ctx = await loadContext();
  if (!ctx) return { error: "Not signed in" };
  const { user, admin, campYear, reg } = ctx;
  if (!reg || reg.status !== "confirmed")
    return { error: "Not a confirmed camper" };

  const today = playaToday();
  const startDate: string | null = campYear.start_date;
  const endDate: string | null = campYear.end_date;
  const daysToGate = startDate ? daysBetween(today, startDate) : null;
  const phase: HypeData["phase"] =
    startDate && today < startDate
      ? "before"
      : endDate && today > endDate
        ? "after"
        : startDate
          ? "during"
          : "before";

  // My first shift.
  const { data: myShifts } = await admin
    .from("job_signups")
    .select(
      "shift:job_shifts!inner(id, label, shift_date, start_time, camp_year_id, definition:job_definitions!inner(title))"
    )
    .eq("profile_id", user.id)
    .eq("shift.camp_year_id", campYear.id);
  type ShiftJoin = {
    shift: {
      id: string;
      label: string | null;
      shift_date: string;
      start_time: string;
      definition: { title: string } | { title: string }[];
    } | null;
  };
  const sorted = ((myShifts ?? []) as unknown as ShiftJoin[])
    .map((r) => r.shift)
    .filter((s): s is NonNullable<ShiftJoin["shift"]> => !!s)
    .sort((a, b) =>
      `${a.shift_date} ${a.start_time}`.localeCompare(
        `${b.shift_date} ${b.start_time}`
      )
    );
  const first = sorted[0] ?? null;
  const firstShift = first
    ? {
        id: first.id,
        title: Array.isArray(first.definition)
          ? first.definition[0]?.title ?? "Shift"
          : first.definition.title,
        label: first.label,
        shiftDate: first.shift_date,
        startTime: first.start_time,
      }
    : null;

  // Camp pulse + buddies (camp-wide, service role — same pattern as leaderboard).
  const [{ data: regs }, { data: shifts }, { count: signupCount }] =
    await Promise.all([
      admin
        .from("registrations")
        .select(
          "profile_id, ready_at, arrival_date, reno_arrival_date, profile:profiles(first_name)"
        )
        .eq("camp_year_id", campYear.id)
        .eq("status", "confirmed"),
      admin
        .from("job_shifts")
        .select("id, capacity")
        .eq("camp_year_id", campYear.id),
      admin
        .from("job_signups")
        .select("shift_id, shift:job_shifts!inner(camp_year_id)", {
          count: "exact",
          head: true,
        })
        .eq("shift.camp_year_id", campYear.id),
    ]);

  type RegRow = {
    profile_id: string;
    ready_at: string | null;
    arrival_date: string | null;
    reno_arrival_date: string | null;
    profile: { first_name: string | null } | { first_name: string | null }[] | null;
  };
  const regRows = (regs ?? []) as unknown as RegRow[];
  const firstName = (r: RegRow) => {
    const p = Array.isArray(r.profile) ? r.profile[0] : r.profile;
    return p?.first_name?.trim() || null;
  };
  const renoBuddies = reg.reno_arrival_date
    ? regRows
        .filter(
          (r) =>
            r.profile_id !== user.id &&
            r.reno_arrival_date === reg.reno_arrival_date
        )
        .map(firstName)
        .filter((n): n is string => !!n)
    : [];
  const arrivalBuddies = reg.arrival_date
    ? regRows
        .filter(
          (r) => r.profile_id !== user.id && r.arrival_date === reg.arrival_date
        )
        .map(firstName)
        .filter((n): n is string => !!n)
    : [];

  return {
    startDate,
    endDate,
    todayPlaya: today,
    daysToGate,
    phase,
    readyAt: reg.ready_at,
    me: {
      arrivalDate: reg.arrival_date,
      departureDate: reg.departure_date,
      renoArrivalDate: reg.reno_arrival_date,
      firstShift,
    },
    renoBuddies,
    arrivalBuddies,
    pulse: {
      confirmed: regRows.length,
      ready: regRows.filter((r) => !!r.ready_at).length,
      slotsTotal: (shifts ?? []).reduce((s, x) => s + (x.capacity ?? 0), 0),
      slotsFilled: signupCount ?? 0,
    },
  };
}

/**
 * Called by the dashboard the first time every Road to 2026 row is done.
 * Stamps registrations.ready_at once and fires the "You're locked in" email.
 * Idempotent: later calls return firstTime=false and do nothing.
 */
export async function markReady(): Promise<
  { firstTime: boolean } | { error: string }
> {
  const ctx = await loadContext();
  if (!ctx) return { error: "Not signed in" };
  const { user, admin, reg } = ctx;
  if (!reg || reg.status !== "confirmed")
    return { error: "Not a confirmed camper" };
  if (reg.ready_at) return { firstTime: false };

  const now = new Date().toISOString();
  const { data: updated } = await admin
    .from("registrations")
    .update({ ready_at: now })
    .eq("id", reg.id)
    .is("ready_at", null)
    .select("id")
    .maybeSingle();
  if (!updated) return { firstTime: false }; // raced with another tab

  // Email is best-effort — never block the celebration on it.
  try {
    const [{ data: profile }, hype] = await Promise.all([
      admin
        .from("profiles")
        .select("first_name, email")
        .eq("id", user.id)
        .single(),
      getHypeData(),
    ]);
    const email = profile?.email || user.email;
    if (email && !("error" in hype)) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "https://www.node.family";
      await sendLockedInEmail({
        email,
        firstName: profile?.first_name?.trim() || "friend",
        daysToGate: hype.daysToGate,
        arrivalLabel: formatRange(hype.me.arrivalDate, hype.me.departureDate),
        firstShiftLabel: hype.me.firstShift
          ? `${hype.me.firstShift.title}${hype.me.firstShift.label ? ` — ${hype.me.firstShift.label}` : ""} · ${formatDay(hype.me.firstShift.shiftDate)} ${formatTime(hype.me.firstShift.startTime)}`
          : null,
        renoBuddies: hype.renoBuddies,
        dashboardUrl: `${siteUrl}/dashboard`,
      });
    }
  } catch (err) {
    console.error("[markReady] email failed", err);
  }

  return { firstTime: true };
}

function formatDay(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}
function formatRange(a: string | null, b: string | null): string | null {
  if (!a) return null;
  return b ? `${formatDay(a)} – ${formatDay(b)}` : formatDay(a);
}
