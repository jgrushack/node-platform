"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const YEAR = 2026;
const DUES_KIND = "dues_2026";
const STORAGE_KIND = "storage_survey_2026";
const EQUIPMENT_KIND = "equipment_2026";

type Admin = ReturnType<typeof createAdminClient>;

/** Admin/super-admin gate; returns the service-role client + 2026 camp year id. */
async function requireAdmin(): Promise<
  { admin: Admin; campYearId: string } | { error: string }
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
  return { admin, campYearId: campYear.id };
}

export type ReportRow = {
  registrationId: string;
  profileId: string;
  name: string;
  playaName: string | null;
  email: string | null;
  status: string;
  hasTicket: boolean;
  hasCarPass: boolean;
  arrivalDate: string | null;
  departureDate: string | null;
  dues: { owedCents: number; paidCents: number };
  storage: { owedCents: number; paidCents: number; summary: string | null };
  equipment: {
    owedCents: number;
    paidCents: number;
    items: { label: string; quantity: number }[];
  };
  jobs: { shiftCount: number; points: number };
  balanceCents: number;
};

export type CampReportResult = { error: string } | { rows: ReportRow[] };

/** Full per-camper picture: status, tickets, dates, dues/storage/equipment
 *  balances, reserved gear, and job points. Admin + super_admin only. */
export async function getCampReport(): Promise<CampReportResult> {
  const ctx = await requireAdmin();
  if ("error" in ctx) return ctx;
  const { admin, campYearId } = ctx;

  const [regsRes, invRes, resvRes, itemsRes, signupsRes] = await Promise.all([
    admin
      .from("registrations")
      .select(
        "id, profile_id, status, has_ticket, has_car_pass, arrival_date, departure_date"
      )
      .eq("camp_year_id", campYearId),
    admin
      .from("invoices")
      .select("profile_id, kind, amount_cents, amount_paid_cents, description")
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
    has_car_pass: boolean;
    arrival_date: string | null;
    departure_date: string | null;
  };
  const registrations = (regsRes.data ?? []) as RegRow[];
  const profileIds = Array.from(new Set(registrations.map((r) => r.profile_id)));

  // Names / emails.
  const profById = new Map<
    string,
    { name: string; playa: string | null; email: string | null }
  >();
  if (profileIds.length > 0) {
    const { data: profs } = await admin
      .from("profiles")
      .select("id, first_name, last_name, playa_name, email")
      .in("id", profileIds);
    (
      (profs ?? []) as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        playa_name: string | null;
        email: string | null;
      }[]
    ).forEach((p) => {
      const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
      profById.set(p.id, {
        name: full || p.playa_name || "Unknown",
        playa: p.playa_name,
        email: p.email,
      });
    });
  }

  // Invoices by profile + kind.
  type Inv = { owed: number; paid: number; desc: string | null };
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
    }[]
  ).forEach((i) => {
    const owed = Math.max(0, (i.amount_cents ?? 0) - (i.amount_paid_cents ?? 0));
    const entry: Inv = {
      owed,
      paid: i.amount_paid_cents ?? 0,
      desc: i.description ?? null,
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

  // Job points by profile (signup → shift → definition.point_value).
  const jobsByProfile = new Map<string, { shiftCount: number; points: number }>();
  const signups = (signupsRes.data ?? []) as {
    profile_id: string;
    shift_id: string;
  }[];
  if (signups.length > 0) {
    const shiftIds = Array.from(new Set(signups.map((s) => s.shift_id)));
    const { data: shifts } = await admin
      .from("job_shifts")
      .select("id, definition_id")
      .in("id", shiftIds);
    const shiftRows = (shifts ?? []) as { id: string; definition_id: string }[];
    const defIds = Array.from(new Set(shiftRows.map((s) => s.definition_id)));
    const ptsByDef = new Map<string, number>();
    if (defIds.length > 0) {
      const { data: defs } = await admin
        .from("job_definitions")
        .select("id, point_value")
        .in("id", defIds);
      ((defs ?? []) as { id: string; point_value: number }[]).forEach((d) =>
        ptsByDef.set(d.id, d.point_value)
      );
    }
    const ptsByShift = new Map<string, number>();
    shiftRows.forEach((s) =>
      ptsByShift.set(s.id, ptsByDef.get(s.definition_id) ?? 0)
    );
    signups.forEach((s) => {
      const agg = jobsByProfile.get(s.profile_id) ?? { shiftCount: 0, points: 0 };
      agg.shiftCount += 1;
      agg.points += ptsByShift.get(s.shift_id) ?? 0;
      jobsByProfile.set(s.profile_id, agg);
    });
  }

  const rows: ReportRow[] = registrations.map((r) => {
    const prof = profById.get(r.profile_id) ?? {
      name: "Unknown",
      playa: null,
      email: null,
    };
    const inv = invByProfile.get(r.profile_id) ?? {};
    const dues = inv.dues ?? { owed: 0, paid: 0, desc: null };
    const storage = inv.storage ?? { owed: 0, paid: 0, desc: null };
    const equip = inv.equipment ?? { owed: 0, paid: 0, desc: null };
    return {
      registrationId: r.id,
      profileId: r.profile_id,
      name: prof.name,
      playaName: prof.playa,
      email: prof.email,
      status: r.status,
      hasTicket: !!r.has_ticket,
      hasCarPass: !!r.has_car_pass,
      arrivalDate: r.arrival_date,
      departureDate: r.departure_date,
      dues: { owedCents: dues.owed, paidCents: dues.paid },
      storage: {
        owedCents: storage.owed,
        paidCents: storage.paid,
        summary: storage.desc,
      },
      equipment: {
        owedCents: equip.owed,
        paidCents: equip.paid,
        items: equipByProfile.get(r.profile_id) ?? [],
      },
      jobs: jobsByProfile.get(r.profile_id) ?? { shiftCount: 0, points: 0 },
      balanceCents: dues.owed + storage.owed + equip.owed,
    };
  });

  rows.sort((a, b) => a.name.localeCompare(b.name));
  return { rows };
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
