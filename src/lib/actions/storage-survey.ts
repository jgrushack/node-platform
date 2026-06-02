"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Per-item pricing for the 2026 storage survey.
export const STORAGE_PRICES_CENTS = {
  bike: 10000,
  bin: 6000,
  ac: 12000,
} as const;

const itemSchema = z.object({
  quantity: z.number().int().min(0).max(50),
  description: z.string().max(500).optional().default(""),
});

const storageSurveySchema = z
  .object({
    hasItems: z.boolean(),
    bikes: itemSchema,
    bins: itemSchema,
    acs: itemSchema,
  })
  .refine(
    (d) =>
      !d.hasItems ||
      d.bikes.quantity > 0 ||
      d.bins.quantity > 0 ||
      d.acs.quantity > 0,
    {
      message: "Pick at least one item, or answer No.",
    }
  );

export type StorageSurveyInput = z.infer<typeof storageSurveySchema>;

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

  const data = parsed.data;
  const bikes = data.hasItems ? data.bikes.quantity : 0;
  const bins = data.hasItems ? data.bins.quantity : 0;
  const acs = data.hasItems ? data.acs.quantity : 0;

  const chargeCents =
    bikes * STORAGE_PRICES_CENTS.bike +
    bins * STORAGE_PRICES_CENTS.bin +
    acs * STORAGE_PRICES_CENTS.ac;

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

    const summaryParts: string[] = [];
    if (bikes > 0) summaryParts.push(`${bikes} bike${bikes === 1 ? "" : "s"}`);
    if (bins > 0) summaryParts.push(`${bins} bin${bins === 1 ? "" : "s"}`);
    if (acs > 0) summaryParts.push(`${acs} AC${acs === 1 ? "" : "s"}`);

    const notesPayload = {
      kind: "storage_survey_2026",
      items: {
        bike: { quantity: bikes, description: data.bikes.description ?? "" },
        bin: { quantity: bins, description: data.bins.description ?? "" },
        ac: { quantity: acs, description: data.acs.description ?? "" },
      },
      submitted_at: new Date().toISOString(),
    };

    const { error: invoiceError } = await admin.from("invoices").insert({
      profile_id: user.id,
      camp_year_id: campYear.id,
      amount_cents: chargeCents,
      status: "sent",
      kind: "storage_survey_2026",
      description: `Storage 2026: ${summaryParts.join(", ")}`,
      notes: JSON.stringify(notesPayload),
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
