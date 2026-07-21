"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const YEAR = 2026;
const DUES_KIND = "dues_2026";
const STORAGE_KIND = "storage_survey_2026";
const EQUIPMENT_KIND = "equipment_2026";

type Admin = ReturnType<typeof createAdminClient>;

/** Admin/super-admin gate; returns the service-role client, camp year, and role. */
async function requireAdmin(): Promise<
  { admin: Admin; campYearId: string; role: string } | { error: string }
> {
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
  return { admin, campYearId: campYear.id, role: me.role };
}

export type StorageItemLine = { type: string; quantity: number; labels: string[] };

export type ReportRow = {
  registrationId: string;
  profileId: string;
  name: string;
  playaName: string | null;
  email: string | null;
  status: string;
  hasTicket: boolean;
  /** registrations.has_car_pass enum: no | car_pass_parking | burner_express | ride_sorted | ride_unsorted */
  carPass: string;
  arrivalDate: string | null;
  departureDate: string | null;
  /** Full dues obligation (the tier), owed = remaining. Super-admin only (else 0). */
  dues: { totalCents: number; owedCents: number; paidCents: number };
  storage: {
    owedCents: number;
    paidCents: number;
    summary: string | null;
    items: StorageItemLine[];
  };
  equipment: {
    owedCents: number;
    paidCents: number;
    items: { label: string; quantity: number }[];
  };
  jobs: {
    shiftCount: number;
    points: number;
    shifts: { title: string; date: string; time: string }[];
  };
  balanceCents: number;
  /** Has the camper engaged at all (any invoice or completed storage survey)? */
  formsStarted: boolean;
  profile: {
    phone: string | null;
    dietary: string | null;
    emergencyContact: string | null;
    instagram: string | null;
    bio: string | null;
    skills: string[];
    nodeYears: string[];
    otherBurns: string[];
  };
  application: {
    yearsAttended: string | null;
    previousCamps: string | null;
    favoritePrinciple: string | null;
    principleReason: string | null;
    referredBy: string | null;
    skills: string | null;
    videoUrl: string | null;
  } | null;
};

export type CampReportResult =
  | { error: string }
  | { rows: ReportRow[]; isSuperAdmin: boolean };

const STORAGE_ITEM_LABEL: Record<string, string> = {
  bike: "Bike",
  bin: "Bin",
  ac: "AC unit",
  shiftpod: "Tent",
};

/** Parse the storage invoice `notes` JSON into itemized lines with per-unit labels. */
function parseStorageItems(notes: string | null): StorageItemLine[] {
  if (!notes) return [];
  try {
    const j = JSON.parse(notes) as {
      items?: Record<string, { quantity?: number; description?: string }>;
    };
    const out: StorageItemLine[] = [];
    for (const [k, v] of Object.entries(j.items ?? {})) {
      const quantity = v?.quantity ?? 0;
      if (quantity <= 0) continue;
      out.push({
        type: STORAGE_ITEM_LABEL[k] ?? k,
        quantity,
        labels: (v?.description ?? "")
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      });
    }
    return out;
  } catch {
    return [];
  }
}

/** Full per-camper record: registration, travel, dues/storage/equipment, gear,
 *  jobs, and every profile + application answer. Admin + super_admin only;
 *  money (dues/balances) is stripped for non-super-admins. */
export async function getCampReport(): Promise<CampReportResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const { admin, campYearId, role } = ctx;
  const isSuperAdmin = role === "super_admin";

  const [regsRes, invRes, resvRes, itemsRes, signupsRes] = await Promise.all([
    admin
      .from("registrations")
      .select(
        "id, profile_id, status, has_ticket, has_car_pass, arrival_date, departure_date"
      )
      .eq("camp_year_id", campYearId),
    admin
      .from("invoices")
      .select(
        "profile_id, kind, amount_cents, amount_paid_cents, description, notes"
      )
      .eq("camp_year_id", campYearId),
    admin
      .from("equipment_reservations")
      .select("profile_id, item_key, custom_label, quantity")
      .eq("camp_year_id", campYearId),
    admin.from("equipment_items").select("key, label"),
    admin.from("job_signups").select("profile_id, shift_id"),
  ]);

  type RegRow = {
    id: string;
    profile_id: string;
    status: string;
    has_ticket: boolean;
    has_car_pass: string | null;
    arrival_date: string | null;
    departure_date: string | null;
  };
  const registrations = (regsRes.data ?? []) as RegRow[];
  const profileIds = Array.from(new Set(registrations.map((r) => r.profile_id)));

  // Profiles: names, contact, and the free-form answers they've given us.
  type ProfInfo = {
    name: string;
    playa: string | null;
    email: string | null;
    storageDone: boolean;
    phone: string | null;
    dietary: string | null;
    emergencyContact: string | null;
    instagram: string | null;
    bio: string | null;
    skills: string[];
    nodeYears: string[];
    otherBurns: string[];
  };
  const profById = new Map<string, ProfInfo>();
  const emails: string[] = [];
  if (profileIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select(
        "id, first_name, last_name, playa_name, email, storage_survey_completed_at, phone, dietary_restrictions, emergency_contact, instagram, bio, skills, node_events_attended, other_burns"
      )
      .in("id", profileIds);
    ((profs ?? []) as Record<string, unknown>[]).forEach((p) => {
      const first = (p.first_name as string | null) ?? null;
      const last = (p.last_name as string | null) ?? null;
      const playa = (p.playa_name as string | null) ?? null;
      const email = (p.email as string | null) ?? null;
      const full = [first, last].filter(Boolean).join(" ").trim();
      if (email) emails.push(email);
      profById.set(p.id as string, {
        name: full || playa || "Unknown",
        playa,
        email,
        storageDone: !!p.storage_survey_completed_at,
        phone: (p.phone as string | null) ?? null,
        dietary: (p.dietary_restrictions as string | null) ?? null,
        emergencyContact: (p.emergency_contact as string | null) ?? null,
        instagram: (p.instagram as string | null) ?? null,
        bio: (p.bio as string | null) ?? null,
        skills: (p.skills as string[] | null) ?? [],
        nodeYears: (p.node_events_attended as string[] | null) ?? [],
        otherBurns: (p.other_burns as string[] | null) ?? [],
      });
    });
  }

  // Application answers, keyed by (lowercased) email — keep the most recent.
  const appByEmail = new Map<string, NonNullable<ReportRow["application"]>>();
  if (emails.length > 0) {
    const { data: apps } = await admin
      .from("applications")
      .select(
        "email, years_attended, previous_camps, favorite_principle, principle_reason, referred_by, skills, video_url, created_at"
      )
      .in("email", emails)
      .order("created_at", { ascending: false });
    ((apps ?? []) as Record<string, unknown>[]).forEach((a) => {
      const key = ((a.email as string) ?? "").toLowerCase();
      if (!key || appByEmail.has(key)) return;
      appByEmail.set(key, {
        yearsAttended: (a.years_attended as string | null) ?? null,
        previousCamps: (a.previous_camps as string | null) ?? null,
        favoritePrinciple: (a.favorite_principle as string | null) ?? null,
        principleReason: (a.principle_reason as string | null) ?? null,
        referredBy: (a.referred_by as string | null) ?? null,
        skills: (a.skills as string | null) ?? null,
        videoUrl: (a.video_url as string | null) ?? null,
      });
    });
  }

  // Invoices by profile + kind (storage keeps its notes for item parsing).
  type Inv = {
    owed: number;
    paid: number;
    desc: string | null;
    notes: string | null;
  };
  const invByProfile = new Map<
    string,
    { dues?: Inv; storage?: Inv; equipment?: Inv }
  >();
  (
    (invRes.data ?? []) as {
      profile_id: string;
      kind: string;
      amount_cents: number;
      amount_paid_cents: number;
      description: string | null;
      notes: string | null;
    }[]
  ).forEach((i) => {
    const owed = Math.max(0, (i.amount_cents ?? 0) - (i.amount_paid_cents ?? 0));
    const entry: Inv = {
      owed,
      paid: i.amount_paid_cents ?? 0,
      desc: i.description ?? null,
      notes: i.notes ?? null,
    };
    const rec = invByProfile.get(i.profile_id) ?? {};
    if (i.kind === DUES_KIND) rec.dues = entry;
    else if (i.kind === STORAGE_KIND) rec.storage = entry;
    else if (i.kind === EQUIPMENT_KIND) rec.equipment = entry;
    invByProfile.set(i.profile_id, rec);
  });

  // Equipment reservations by profile (label resolved from the catalog).
  const labelByKey = new Map<string, string>();
  ((itemsRes.data ?? []) as { key: string; label: string }[]).forEach((it) =>
    labelByKey.set(it.key, it.label)
  );
  const equipByProfile = new Map<string, { label: string; quantity: number }[]>();
  (
    (resvRes.data ?? []) as {
      profile_id: string;
      item_key: string | null;
      custom_label: string | null;
      quantity: number;
    }[]
  ).forEach((r) => {
    const label = r.item_key
      ? labelByKey.get(r.item_key) ?? r.item_key
      : r.custom_label ?? "Custom item";
    const list = equipByProfile.get(r.profile_id) ?? [];
    list.push({ label, quantity: r.quantity });
    equipByProfile.set(r.profile_id, list);
  });

  // Jobs by profile: shift list (title/date/time) + points.
  type JobAgg = {
    shiftCount: number;
    points: number;
    shifts: { title: string; date: string; time: string }[];
  };
  const jobsByProfile = new Map<string, JobAgg>();
  const signups = (signupsRes.data ?? []) as {
    profile_id: string;
    shift_id: string;
  }[];
  if (signups.length > 0) {
    const shiftIds = Array.from(new Set(signups.map((s) => s.shift_id)));
    const { data: shifts } = await admin
      .from("job_shifts")
      .select("id, definition_id, shift_date, start_time")
      .in("id", shiftIds);
    const shiftRows = (shifts ?? []) as {
      id: string;
      definition_id: string;
      shift_date: string;
      start_time: string;
    }[];
    const defIds = Array.from(new Set(shiftRows.map((s) => s.definition_id)));
    const defById = new Map<string, { title: string; points: number }>();
    if (defIds.length > 0) {
      const { data: defs } = await admin
        .from("job_definitions")
        .select("id, title, point_value")
        .in("id", defIds);
      (
        (defs ?? []) as { id: string; title: string; point_value: number }[]
      ).forEach((d) => defById.set(d.id, { title: d.title, points: d.point_value }));
    }
    const shiftInfo = new Map<
      string,
      { title: string; points: number; date: string; time: string }
    >();
    shiftRows.forEach((s) => {
      const def = defById.get(s.definition_id);
      shiftInfo.set(s.id, {
        title: def?.title ?? "Shift",
        points: def?.points ?? 0,
        date: s.shift_date,
        time: (s.start_time ?? "").slice(0, 5),
      });
    });
    signups.forEach((s) => {
      const info = shiftInfo.get(s.shift_id);
      if (!info) return;
      const agg = jobsByProfile.get(s.profile_id) ?? {
        shiftCount: 0,
        points: 0,
        shifts: [],
      };
      agg.shiftCount += 1;
      agg.points += info.points;
      agg.shifts.push({ title: info.title, date: info.date, time: info.time });
      jobsByProfile.set(s.profile_id, agg);
    });
  }

  const rows: ReportRow[] = registrations.map((r) => {
    const prof = profById.get(r.profile_id);
    const inv = invByProfile.get(r.profile_id) ?? {};
    const dues = inv.dues ?? { owed: 0, paid: 0, desc: null, notes: null };
    const storage = inv.storage ?? { owed: 0, paid: 0, desc: null, notes: null };
    const equip = inv.equipment ?? { owed: 0, paid: 0, desc: null, notes: null };
    const hasAnyInvoice = !!(inv.dues || inv.storage || inv.equipment);
    return {
      registrationId: r.id,
      profileId: r.profile_id,
      name: prof?.name ?? "Unknown",
      playaName: prof?.playa ?? null,
      email: prof?.email ?? null,
      status: r.status,
      hasTicket: !!r.has_ticket,
      carPass: r.has_car_pass ?? "no",
      arrivalDate: r.arrival_date,
      departureDate: r.departure_date,
      formsStarted: hasAnyInvoice || !!prof?.storageDone,
      dues: {
        totalCents: dues.owed + dues.paid,
        owedCents: dues.owed,
        paidCents: dues.paid,
      },
      storage: {
        owedCents: storage.owed,
        paidCents: storage.paid,
        summary: storage.desc,
        items: parseStorageItems(storage.notes),
      },
      equipment: {
        owedCents: equip.owed,
        paidCents: equip.paid,
        items: equipByProfile.get(r.profile_id) ?? [],
      },
      jobs:
        jobsByProfile.get(r.profile_id) ?? {
          shiftCount: 0,
          points: 0,
          shifts: [],
        },
      balanceCents: dues.owed + storage.owed + equip.owed,
      profile: {
        phone: prof?.phone ?? null,
        dietary: prof?.dietary ?? null,
        emergencyContact: prof?.emergencyContact ?? null,
        instagram: prof?.instagram ?? null,
        bio: prof?.bio ?? null,
        skills: prof?.skills ?? [],
        nodeYears: prof?.nodeYears ?? [],
        otherBurns: prof?.otherBurns ?? [],
      },
      application: prof?.email
        ? appByEmail.get(prof.email.toLowerCase()) ?? null
        : null,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));

  // Balances are super-admin-only; strip all money for regular admins.
  if (!isSuperAdmin) {
    for (const r of rows) {
      r.dues = { totalCents: 0, owedCents: 0, paidCents: 0 };
      r.storage = {
        owedCents: 0,
        paidCents: 0,
        summary: r.storage.summary,
        items: r.storage.items,
      };
      r.equipment = { owedCents: 0, paidCents: 0, items: r.equipment.items };
      r.balanceCents = 0;
    }
  }

  return { rows, isSuperAdmin };
}

export type CancelRegistrationResult =
  | { success: true; releasedReservations: number; voidedInvoices: number }
  | { error: string };

/** Cancel a camper who backed out: mark the registration cancelled, delete their
 *  equipment reservations (frees inventory), and void their fully-UNPAID invoices.
 *  Any invoice with money on it is left alone — refunds are handled manually. */
export async function cancelRegistration(
  registrationId: string
): Promise<CancelRegistrationResult> {
  if (!registrationId || typeof registrationId !== "string")
    return { error: "Invalid registration." };
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const { admin } = ctx;

  const { data: reg } = await admin
    .from("registrations")
    .select("id, profile_id, camp_year_id")
    .eq("id", registrationId)
    .maybeSingle();
  if (!reg) return { error: "Registration not found." };

  const { error: statusErr } = await admin
    .from("registrations")
    .update({ status: "cancelled" })
    .eq("id", registrationId);
  if (statusErr) {
    console.error("[cancelRegistration] status", statusErr);
    return { error: "Failed to cancel the registration." };
  }

  // Free their held gear back into inventory.
  const { data: released } = await admin
    .from("equipment_reservations")
    .delete()
    .eq("profile_id", reg.profile_id)
    .eq("camp_year_id", reg.camp_year_id)
    .select("id");

  // Void only fully-unpaid invoices; anything with a payment is left for a
  // manual refund decision.
  const { data: voided } = await admin
    .from("invoices")
    .update({ status: "cancelled" })
    .eq("profile_id", reg.profile_id)
    .eq("camp_year_id", reg.camp_year_id)
    .eq("amount_paid_cents", 0)
    .not("status", "in", '("cancelled","refunded")')
    .select("id");

  revalidatePath("/dashboard/reports");
  revalidatePath("/dashboard/rentals");
  revalidatePath("/dashboard/payments");
  return {
    success: true,
    releasedReservations: released?.length ?? 0,
    voidedInvoices: voided?.length ?? 0,
  };
}
