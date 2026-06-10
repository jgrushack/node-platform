"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const EQUIPMENT_KIND = "equipment_2026";
const YEAR = 2026;

// Custom "Other" line bounds — server-authoritative (the RPC also re-checks).
const CUSTOM_MIN_CENTS = 100; // $1
const CUSTOM_MAX_CENTS = 500000; // $5,000

const selectionSchema = z.object({
  key: z.string().max(60).nullable(),
  quantity: z.number().int().min(0).max(20),
  customLabel: z.string().trim().max(120).optional(),
  unitPriceCents: z.number().int().min(0).max(CUSTOM_MAX_CENTS).optional(),
});
export type EquipmentSelection = z.infer<typeof selectionSchema>;

const reserveSchema = z.array(selectionSchema).max(40);

export type CatalogItem = {
  key: string;
  label: string;
  description: string | null;
  priceCents: number;
  category: "tent" | "addon";
  sortOrder: number;
  /** Pool availability with the member's OWN holds added back; null = unlimited. */
  available: number | null;
  /** Sold out to this member (0 left and they hold none). */
  soldOut: boolean;
  /** Quantity this member currently holds. */
  mine: number;
};

export type EquipmentCustomLine = {
  label: string;
  quantity: number;
  unitPriceCents: number;
};

export type GetEquipmentCatalogResult =
  | { error: string }
  | {
      items: CatalogItem[];
      custom: EquipmentCustomLine[];
      hasInvoice: boolean;
      amountCents: number;
      amountPaidCents: number;
      status: string | null;
      editable: boolean;
    };

/** Catalog + live availability + this member's current selection + invoice state. */
export async function getEquipmentCatalog(): Promise<GetEquipmentCatalogResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id")
    .eq("year", YEAR)
    .single();

  const { data: items } = await supabase
    .from("equipment_items")
    .select("key, label, description, price_cents, category, sort_order, total_qty")
    .eq("active", true)
    .order("sort_order");

  const { data: avail } = await supabase.rpc("equipment_availability", {
    p_year: YEAR,
  });
  const availByKey = new Map<
    string,
    { available: number | null; sold_out: boolean }
  >();
  (avail ?? []).forEach((a: { key: string; available: number | null; sold_out: boolean }) =>
    availByKey.set(a.key, { available: a.available, sold_out: a.sold_out })
  );

  // This member's current holds (RLS lets a user read their own rows).
  const { data: mine } = await supabase
    .from("equipment_reservations")
    .select("item_key, custom_label, quantity, unit_price_cents")
    .eq("profile_id", user.id);
  const mineByKey = new Map<string, number>();
  const custom: EquipmentCustomLine[] = [];
  (mine ?? []).forEach(
    (r: {
      item_key: string | null;
      custom_label: string | null;
      quantity: number;
      unit_price_cents: number;
    }) => {
      if (r.item_key)
        mineByKey.set(r.item_key, (mineByKey.get(r.item_key) ?? 0) + r.quantity);
      else if (r.custom_label)
        custom.push({
          label: r.custom_label,
          quantity: r.quantity,
          unitPriceCents: r.unit_price_cents,
        });
    }
  );

  const catalog: CatalogItem[] = (items ?? []).map(
    (i: {
      key: string;
      label: string;
      description: string | null;
      price_cents: number;
      category: "tent" | "addon";
      sort_order: number;
      total_qty: number | null;
    }) => {
      const a = availByKey.get(i.key);
      const myQty = mineByKey.get(i.key) ?? 0;
      const poolAvail = a ? a.available : i.total_qty;
      // Add my own holds back so editing shows my picks as selectable.
      const displayAvail = poolAvail === null ? null : poolAvail + myQty;
      return {
        key: i.key,
        label: i.label,
        description: i.description,
        priceCents: i.price_cents,
        category: i.category,
        sortOrder: i.sort_order,
        available: displayAvail,
        soldOut: poolAvail !== null && poolAvail <= 0 && myQty === 0,
        mine: myQty,
      };
    }
  );

  let hasInvoice = false;
  let amountCents = 0;
  let amountPaidCents = 0;
  let status: string | null = null;
  let editable = true;
  if (campYear) {
    const { data: inv } = await supabase
      .from("invoices")
      .select("amount_cents, amount_paid_cents, status")
      .eq("profile_id", user.id)
      .eq("camp_year_id", campYear.id)
      .eq("kind", EQUIPMENT_KIND)
      .maybeSingle();
    if (inv) {
      const isActive = inv.status !== "cancelled";
      hasInvoice = isActive;
      amountCents = isActive ? inv.amount_cents : 0;
      amountPaidCents = inv.amount_paid_cents;
      status = inv.status;
      editable =
        inv.amount_paid_cents === 0 &&
        inv.status !== "refunded" &&
        inv.status !== "processing";
    }
  }

  return { items: catalog, custom, hasInvoice, amountCents, amountPaidCents, status, editable };
}

export type ReserveEquipmentResult =
  | { success: true; totalCents: number }
  | { error: string };

/** Atomically claim the selected units (server-validated) and upsert the invoice. */
export async function reserveEquipment(
  input: EquipmentSelection[]
): Promise<ReserveEquipmentResult> {
  const parsed = reserveSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // Shape the RPC payload (snake_case keys the function reads) + guard customs.
  const items: Array<
    | { key: string; quantity: number }
    | { key: null; custom_label: string; unit_price_cents: number; quantity: number }
  > = [];
  for (const s of parsed.data) {
    if (s.quantity <= 0) continue;
    if (s.key) {
      items.push({ key: s.key, quantity: s.quantity });
    } else {
      const label = (s.customLabel ?? "").trim();
      const price = s.unitPriceCents ?? 0;
      if (!label) return { error: "Give your custom item a name." };
      if (price < CUSTOM_MIN_CENTS || price > CUSTOM_MAX_CENTS)
        return { error: "Custom price must be between $1 and $5,000." };
      items.push({ key: null, custom_label: label, unit_price_cents: price, quantity: s.quantity });
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // User-scoped RPC so auth.uid() resolves inside the SECURITY DEFINER function.
  const { data, error } = await supabase.rpc("reserve_equipment", {
    p_year: YEAR,
    p_items: items,
  });
  if (error) {
    const msg = error.message || "";
    if (msg.includes("sold out"))
      return {
        error: "Sorry — one of those just got taken. Adjust your picks and try again.",
      };
    if (msg.includes("already paid"))
      return { error: "Your rental is already paid. Contact an admin to change it." };
    if (msg.includes("payment processing"))
      return {
        error:
          "An equipment payment is processing. You can change your items once it clears.",
      };
    console.error("[reserveEquipment]", error);
    return { error: "Couldn't reserve your equipment. Please try again." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  return { success: true, totalCents: row?.total_cents ?? 0 };
}

// ── Admin view ───────────────────────────────────────────────────────

export type RentalsAdminResult =
  | { error: string }
  | {
      items: {
        key: string;
        label: string;
        category: string;
        totalQty: number | null;
        heldQty: number;
        reserved: number;
        available: number | null;
        holders: { name: string; quantity: number; paid: boolean }[];
      }[];
      custom: {
        name: string;
        label: string;
        quantity: number;
        unitPriceCents: number;
        paid: boolean;
      }[];
    };

/** Who has reserved what, with paid/unpaid. Admin + super_admin only. */
export async function getRentalsAdmin(): Promise<RentalsAdminResult> {
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

  const { data: items } = await admin
    .from("equipment_items")
    .select("key, label, category, total_qty, held_qty, sort_order")
    .order("sort_order");

  const { data: reservations } = await admin
    .from("equipment_reservations")
    .select("item_key, custom_label, quantity, unit_price_cents, profile_id")
    .eq("camp_year_id", campYear.id);

  const { data: invoices } = await admin
    .from("invoices")
    .select("profile_id, amount_paid_cents")
    .eq("camp_year_id", campYear.id)
    .eq("kind", EQUIPMENT_KIND);
  const paidByProfile = new Map<string, boolean>();
  (invoices ?? []).forEach((i: { profile_id: string; amount_paid_cents: number }) =>
    paidByProfile.set(i.profile_id, (i.amount_paid_cents ?? 0) > 0)
  );

  // Resolve member names in a single query (FK embeds type awkwardly untyped).
  const profileIds = Array.from(
    new Set((reservations ?? []).map((r: { profile_id: string }) => r.profile_id))
  );
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
      }) => {
        const full = [p.first_name, p.last_name].filter(Boolean).join(" ").trim();
        nameById.set(p.id, full || p.playa_name || "Unknown");
      }
    );
  }

  const byKey = new Map<string, { name: string; quantity: number; paid: boolean }[]>();
  const customLines: {
    name: string;
    label: string;
    quantity: number;
    unitPriceCents: number;
    paid: boolean;
  }[] = [];
  (reservations ?? []).forEach(
    (r: {
      item_key: string | null;
      custom_label: string | null;
      quantity: number;
      unit_price_cents: number;
      profile_id: string;
    }) => {
      const paid = paidByProfile.get(r.profile_id) ?? false;
      const name = nameById.get(r.profile_id) ?? "Unknown";
      if (r.item_key) {
        const arr = byKey.get(r.item_key) ?? [];
        arr.push({ name, quantity: r.quantity, paid });
        byKey.set(r.item_key, arr);
      } else if (r.custom_label) {
        customLines.push({
          name,
          label: r.custom_label,
          quantity: r.quantity,
          unitPriceCents: r.unit_price_cents,
          paid,
        });
      }
    }
  );

  const result = (items ?? []).map(
    (i: {
      key: string;
      label: string;
      category: string;
      total_qty: number | null;
      held_qty: number;
    }) => {
      const holders = byKey.get(i.key) ?? [];
      const reserved = holders.reduce((s, h) => s + h.quantity, 0);
      const available =
        i.total_qty === null ? null : i.total_qty - i.held_qty - reserved;
      return {
        key: i.key,
        label: i.label,
        category: i.category,
        totalQty: i.total_qty,
        heldQty: i.held_qty,
        reserved,
        available,
        holders,
      };
    }
  );

  return { items: result, custom: customLines };
}
