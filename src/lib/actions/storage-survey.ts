"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { STORAGE_PRICES_CENTS } from "@/lib/storage-prices";

const STORAGE_KIND = "storage_survey_2026";

const itemSchema = z.object({
  quantity: z.number().int().min(0).max(50),
  // Holds the per-unit labels newline-joined (one per item), so allow room.
  description: z.string().max(2000).optional().default(""),
});

const storageSurveySchema = z
  .object({
    hasItems: z.boolean(),
    bikes: itemSchema,
    bins: itemSchema,
    acs: itemSchema,
    shiftpods: itemSchema,
  })
  .refine(
    (d) =>
      !d.hasItems ||
      d.bikes.quantity > 0 ||
      d.bins.quantity > 0 ||
      d.acs.quantity > 0 ||
      d.shiftpods.quantity > 0,
    {
      message: "Pick at least one item, or answer No.",
    }
  );

export type StorageSurveyInput = z.infer<typeof storageSurveySchema>;

// Internal, domain-shaped item map (singular keys, matches the notes JSON).
type Item = { quantity: number; description: string };
export type StorageItems = {
  bike: Item;
  bin: Item;
  ac: Item;
  shiftpod: Item;
};

const ZERO_ITEMS = (): StorageItems => ({
  bike: { quantity: 0, description: "" },
  bin: { quantity: 0, description: "" },
  ac: { quantity: 0, description: "" },
  shiftpod: { quantity: 0, description: "" },
});

/** Map validated (plural-keyed) input to the domain item map; zero-out when hasItems=false. */
function inputToItems(d: StorageSurveyInput): StorageItems {
  if (!d.hasItems) return ZERO_ITEMS();
  return { bike: d.bikes, bin: d.bins, ac: d.acs, shiftpod: d.shiftpods };
}

function computeChargeCents(it: StorageItems): number {
  return (
    it.bike.quantity * STORAGE_PRICES_CENTS.bike +
    it.bin.quantity * STORAGE_PRICES_CENTS.bin +
    it.ac.quantity * STORAGE_PRICES_CENTS.ac +
    it.shiftpod.quantity * STORAGE_PRICES_CENTS.shiftpod
  );
}

// NOTE: the "Storage 2026:" prefix is load-bearing — migration 00043 backfills
// `kind` by matching `description LIKE 'Storage 2026:%'`. Keep it.
function buildDescription(it: StorageItems): string {
  const parts: string[] = [];
  if (it.bike.quantity > 0)
    parts.push(`${it.bike.quantity} bike${it.bike.quantity === 1 ? "" : "s"}`);
  if (it.bin.quantity > 0)
    parts.push(`${it.bin.quantity} bin${it.bin.quantity === 1 ? "" : "s"}`);
  if (it.ac.quantity > 0)
    parts.push(`${it.ac.quantity} AC${it.ac.quantity === 1 ? "" : "s"}`);
  if (it.shiftpod.quantity > 0)
    parts.push(
      `${it.shiftpod.quantity} ShiftPod${it.shiftpod.quantity === 1 ? "" : "s"}`
    );
  return `Storage 2026: ${parts.length ? parts.join(", ") : "(no items)"}`;
}

function buildNotes(
  it: StorageItems,
  opts: { submittedAt: string; updatedAt?: string }
): string {
  return JSON.stringify({
    kind: STORAGE_KIND,
    items: { bike: it.bike, bin: it.bin, ac: it.ac, shiftpod: it.shiftpod },
    submitted_at: opts.submittedAt,
    ...(opts.updatedAt ? { updated_at: opts.updatedAt } : {}),
  });
}

/** Defensive parse of an invoice's notes JSON; null on missing/unparseable.
 *  Missing `shiftpod` (older invoices) defaults to {0,""} so they edit cleanly. */
function parseNotes(notes: string | null | undefined): StorageItems | null {
  if (!notes) return null;
  try {
    const j = JSON.parse(notes) as {
      kind?: string;
      items?: Record<string, { quantity?: number; description?: string }>;
      submitted_at?: string;
    };
    if (j.kind !== STORAGE_KIND) return null;
    const get = (k: string): Item => ({
      quantity: j.items?.[k]?.quantity ?? 0,
      description: j.items?.[k]?.description ?? "",
    });
    return { bike: get("bike"), bin: get("bin"), ac: get("ac"), shiftpod: get("shiftpod") };
  } catch {
    return null;
  }
}

function originalSubmittedAt(notes: string | null | undefined): string | null {
  if (!notes) return null;
  try {
    const j = JSON.parse(notes) as { submitted_at?: string };
    return j.submitted_at ?? null;
  } catch {
    return null;
  }
}

export type StorageSurveyResult =
  | { success: true; chargeCents: number }
  | { error: string };

export async function submitStorageSurvey(
  input: StorageSurveyInput
): Promise<StorageSurveyResult> {
  const parsed = storageSurveySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const items = inputToItems(parsed.data);
  const chargeCents = computeChargeCents(items);

  // Use the admin client for the invoice insert — invoices RLS only permits
  // user SELECTs; INSERTs are system/admin-initiated.
  const admin = createAdminClient();

  // Atomically CLAIM completion before doing anything billable: flip
  // storage_survey_completed_at null -> now() in one conditional update. If no
  // row comes back, the survey was already submitted (double-click, retry, or
  // race) — return idempotently WITHOUT inserting a second invoice.
  const completedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await admin
    .from("profiles")
    .update({ storage_survey_completed_at: completedAt })
    .eq("id", user.id)
    .is("storage_survey_completed_at", null)
    .select("id");

  if (claimError) {
    console.error("[submitStorageSurvey] claim", claimError);
    return { error: "Failed to record survey response. Please try again." };
  }
  if (!claimed || claimed.length === 0) {
    // Already submitted — no double charge.
    return { success: true, chargeCents: 0 };
  }

  // Release the claim if anything below fails, so the user can retry cleanly.
  const releaseClaim = async () => {
    const { error: releaseError } = await admin
      .from("profiles")
      .update({ storage_survey_completed_at: null })
      .eq("id", user.id);
    if (releaseError) console.error("[submitStorageSurvey] release", releaseError);
  };

  if (chargeCents > 0) {
    const { data: campYear, error: campYearError } = await admin
      .from("camp_years")
      .select("id")
      .eq("year", 2026)
      .single();
    if (campYearError || !campYear) {
      await releaseClaim();
      return { error: "No 2026 camp year configured." };
    }

    const { error: invoiceError } = await admin.from("invoices").insert({
      profile_id: user.id,
      camp_year_id: campYear.id,
      amount_cents: chargeCents,
      status: "sent",
      kind: STORAGE_KIND,
      description: buildDescription(items),
      notes: buildNotes(items, { submittedAt: completedAt }),
    });
    if (invoiceError) {
      // 23505 = unique-index violation: a storage invoice already exists for
      // this member/year (e.g. a prior attempt committed but its ack was lost).
      // Treat as already-charged — keep the completion flag, do NOT re-insert.
      if (invoiceError.code === "23505") {
        return { success: true, chargeCents };
      }
      console.error("[submitStorageSurvey] invoice insert", invoiceError);
      await releaseClaim();
      return { error: "Failed to record storage charge. Please try again." };
    }
  }

  // Completion flag was already set by the atomic claim above.
  return { success: true, chargeCents };
}

export type GetStorageSurveyResult =
  | { error: string }
  | {
      completed: boolean;
      hasInvoice: boolean;
      items: StorageItems | null;
      amountCents: number;
      amountPaidCents: number;
      editable: boolean;
    };

/** Read the member's current storage answers to pre-fill the edit form.
 *  Uses the normal (user-scoped) client — RLS lets a user read their own rows. */
export async function getStorageSurvey(): Promise<GetStorageSurveyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("storage_survey_completed_at")
    .eq("id", user.id)
    .single();
  const completed = !!profile?.storage_survey_completed_at;

  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();

  if (!campYear) {
    return {
      completed,
      hasInvoice: false,
      items: null,
      amountCents: 0,
      amountPaidCents: 0,
      editable: completed,
    };
  }

  const { data: invoice } = await supabase
    .from("invoices")
    .select("amount_cents, amount_paid_cents, status, notes")
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .eq("kind", STORAGE_KIND)
    .maybeSingle();

  const amountCents = invoice?.amount_cents ?? 0;
  const amountPaidCents = invoice?.amount_paid_cents ?? 0;
  const isActive = !!invoice && invoice.status !== "cancelled";
  // Edit is allowed based on money state only (not `completed`), so a member who
  // answered "No" can still add items later. Block once any payment exists.
  const editable = amountPaidCents === 0 && invoice?.status !== "refunded";

  return {
    completed,
    hasInvoice: isActive,
    items: isActive ? parseNotes(invoice?.notes) : null,
    amountCents: isActive ? amountCents : 0,
    amountPaidCents,
    editable,
  };
}

export type UpdateStorageSurveyResult =
  | {
      success: true;
      chargeCents: number;
      action: "inserted" | "updated" | "cancelled" | "noop";
    }
  | { error: string };

/** Edit/re-open an already-completed storage survey. Admin client for writes. */
export async function updateStorageSurvey(
  input: StorageSurveyInput
): Promise<UpdateStorageSurveyResult> {
  const parsed = storageSurveySchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();

  const { data: campYear, error: campYearError } = await admin
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();
  if (campYearError || !campYear) {
    return { error: "No 2026 camp year configured." };
  }

  const items = inputToItems(parsed.data);
  const newTotal = computeChargeCents(items);

  // Read the current storage invoice INCLUDING cancelled rows — the partial
  // unique index covers them, so a re-add must UPDATE-resurrect, not INSERT.
  const readExisting = async () =>
    admin
      .from("invoices")
      .select("id, amount_cents, amount_paid_cents, status, notes")
      .eq("profile_id", user.id)
      .eq("camp_year_id", campYear.id)
      .eq("kind", STORAGE_KIND)
      .maybeSingle();

  const { data: existing } = await readExisting();

  // ---- MONEY GUARD (server-authoritative; UI `editable` is only a hint) ----
  if (existing && (existing.amount_paid_cents ?? 0) > 0) {
    return {
      error:
        "This storage charge already has a payment on it. Contact an admin to change your items.",
    };
  }
  if (existing && existing.status === "refunded") {
    return { error: "This storage charge was refunded. Contact an admin to change it." };
  }

  // Ensure completion stays recorded (covers re-open of a never-completed
  // survey). Never null it — that would re-pop the survey modal.
  const { error: flagError } = await admin
    .from("profiles")
    .update({ storage_survey_completed_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("storage_survey_completed_at", null);
  if (flagError) console.error("[updateStorageSurvey] flag", flagError);

  const submittedAt =
    originalSubmittedAt(existing?.notes) ?? new Date().toISOString();
  const updatedAt = new Date().toISOString();
  const description = buildDescription(items);
  const notes = buildNotes(items, { submittedAt, updatedAt });

  // Branch B: edited down to zero with an existing active row -> CANCEL (keep
  // the row so the unique-index slot stays put for a clean future re-add).
  if (newTotal === 0) {
    if (existing && existing.status !== "cancelled") {
      const { error } = await admin
        .from("invoices")
        .update({
          status: "cancelled",
          amount_cents: 0,
          description,
          notes,
          updated_at: updatedAt,
        })
        .eq("id", existing.id);
      if (error) {
        console.error("[updateStorageSurvey] cancel", error);
        return { error: "Failed to update storage. Please try again." };
      }
      return { success: true, chargeCents: 0, action: "cancelled" };
    }
    // No active charge to remove.
    return { success: true, chargeCents: 0, action: "noop" };
  }

  // newTotal > 0 from here.
  if (existing) {
    // UPDATE (covers both active rows and resurrecting a cancelled one).
    const { error } = await admin
      .from("invoices")
      .update({
        status: "sent",
        amount_cents: newTotal,
        description,
        notes,
        updated_at: updatedAt,
      })
      .eq("id", existing.id);
    if (error) {
      console.error("[updateStorageSurvey] update", error);
      return { error: "Failed to update storage. Please try again." };
    }
    return { success: true, chargeCents: newTotal, action: "updated" };
  }

  // No existing row — first-time charge created during an edit (answered "No",
  // now adding items).
  const { error: insertError } = await admin.from("invoices").insert({
    profile_id: user.id,
    camp_year_id: campYear.id,
    amount_cents: newTotal,
    status: "sent",
    kind: STORAGE_KIND,
    description,
    notes,
  });
  if (insertError) {
    // Lost-ack / concurrent insert race: re-read, re-guard, then UPDATE.
    if (insertError.code === "23505") {
      const { data: raced } = await readExisting();
      if (raced && (raced.amount_paid_cents ?? 0) > 0) {
        return {
          error:
            "This storage charge already has a payment on it. Contact an admin to change your items.",
        };
      }
      if (raced) {
        const { error } = await admin
          .from("invoices")
          .update({
            status: "sent",
            amount_cents: newTotal,
            description,
            notes,
            updated_at: updatedAt,
          })
          .eq("id", raced.id);
        if (error) {
          console.error("[updateStorageSurvey] race-update", error);
          return { error: "Failed to update storage. Please try again." };
        }
        return { success: true, chargeCents: newTotal, action: "updated" };
      }
    }
    console.error("[updateStorageSurvey] insert", insertError);
    return { error: "Failed to record storage charge. Please try again." };
  }
  return { success: true, chargeCents: newTotal, action: "inserted" };
}
