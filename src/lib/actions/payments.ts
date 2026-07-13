"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const DUES_KIND = "dues_2026";
const STORAGE_KIND = "storage_survey_2026";
const EQUIPMENT_KIND = "equipment_2026";
// Dues are due before build week.
const DUES_DUE_DATE = "2026-08-23";

const checkoutSchema = z.object({
  // The member's total dues commitment — sets the obligation on first payment.
  tierDollars: z.number().int().positive().max(100000),
  // One-time amount to charge today, paid down toward the balance. We never
  // store a card or auto-charge; members make as many payments as they like.
  payTodayDollars: z.number().int().positive().max(100000),
});

export type CreateDuesCheckoutInput = z.infer<typeof checkoutSchema>;
export type CreateDuesCheckoutResult =
  | { error: string }
  | { url: string };

type Admin = ReturnType<typeof createAdminClient>;

/** Reuse the member's Stripe customer or create one (race-safe atomic claim). */
async function ensureStripeCustomer(
  admin: Admin,
  userId: string,
  email: string | undefined
): Promise<string> {
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();
  if (profile?.stripe_customer_id) return profile.stripe_customer_id;

  const customer = await getStripe().customers.create({
    email: email || undefined,
    metadata: { profile_id: userId },
  });

  // Only claim if still null; if a concurrent call won, reuse theirs.
  const { data: claimed } = await admin
    .from("profiles")
    .update({ stripe_customer_id: customer.id })
    .eq("id", userId)
    .is("stripe_customer_id", null)
    .select("stripe_customer_id");
  if (claimed && claimed.length > 0) return customer.id;

  const { data: existing } = await admin
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", userId)
    .single();
  return existing?.stripe_customer_id ?? customer.id;
}

export async function createDuesCheckout(
  input: CreateDuesCheckoutInput
): Promise<CreateDuesCheckoutResult> {
  const parsed = checkoutSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { tierDollars, payTodayDollars } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: campYear } = await admin
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();
  if (!campYear) return { error: "No 2026 camp year configured." };

  // Guarantee a profile row exists — invoice.profile_id FKs to profiles, and a
  // login with no approved application can be profile-less (auto-profile trigger
  // was removed in 00028). Without this the invoice insert FK-fails with
  // "Failed to prepare dues invoice." ON CONFLICT DO NOTHING keeps existing data.
  await admin
    .from("profiles")
    .upsert(
      { id: user.id, email: user.email },
      { onConflict: "id", ignoreDuplicates: true }
    );

  // Existing dues invoice, if any. Members pay the balance down over as many
  // one-time payments as they like — we never store a card or auto-charge.
  const { data: existing } = await admin
    .from("invoices")
    .select("id, amount_cents, amount_paid_cents, status")
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .eq("kind", DUES_KIND)
    .maybeSingle();

  if (existing && existing.status === "processing") {
    return {
      error: "A dues payment is already processing — hang tight until it clears.",
    };
  }

  const paidCents = existing?.amount_paid_cents ?? 0;
  // Once any money is down the tier (total obligation) is locked; before that the
  // member is choosing/changing it now.
  const obligationCents =
    existing && paidCents > 0 ? existing.amount_cents : tierDollars * 100;
  const remainingCents = obligationCents - paidCents;
  if (remainingCents <= 0) {
    return { error: "Your dues are already paid in full." };
  }

  const payTodayCents = payTodayDollars * 100;
  if (payTodayCents > remainingCents) {
    return {
      error: `That's more than your $${(remainingCents / 100).toLocaleString("en-US")} remaining balance.`,
    };
  }

  const customerId = await ensureStripeCustomer(admin, user.id, user.email ?? undefined);

  // Prepare the invoice. On a new (or not-yet-paid) invoice we set the obligation
  // from the chosen tier; once partially paid we leave the amounts untouched so a
  // repeat payment only moves amount_paid_cents (via the webhook RPC).
  let invoiceId: string;
  if (existing) {
    if (paidCents === 0) {
      const { error } = await admin
        .from("invoices")
        .update({
          amount_cents: obligationCents,
          total_installments: 1,
          status: "sent",
          stripe_customer_id: customerId,
          description: `NODE 2026 Dues — $${tierDollars.toLocaleString("en-US")}`,
          due_date: DUES_DUE_DATE,
        })
        .eq("id", existing.id);
      if (error) return { error: "Failed to prepare dues invoice." };
    }
    invoiceId = existing.id;
  } else {
    const { data, error } = await admin
      .from("invoices")
      .insert({
        profile_id: user.id,
        camp_year_id: campYear.id,
        kind: DUES_KIND,
        currency: "usd",
        amount_cents: obligationCents,
        amount_paid_cents: 0,
        status: "sent",
        stripe_customer_id: customerId,
        total_installments: 1,
        installment_number: 0,
        description: `NODE 2026 Dues — $${tierDollars.toLocaleString("en-US")}`,
        due_date: DUES_DUE_DATE,
      })
      .select("id")
      .single();
    if (error || !data) {
      // Unique-index race — re-read and reuse.
      const { data: raced } = await admin
        .from("invoices")
        .select("id")
        .eq("profile_id", user.id)
        .eq("camp_year_id", campYear.id)
        .eq("kind", DUES_KIND)
        .maybeSingle();
      if (!raced) return { error: "Failed to prepare dues invoice." };
      invoiceId = raced.id;
    } else {
      invoiceId = data.id;
    }
  }

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://node.family";
  // No payment_method_types — Stripe's dynamic payment methods show whatever is
  // enabled in the Dashboard (card, ACH, stablecoins/crypto, …).
  const meta = { invoice_id: invoiceId, profile_id: user.id, kind: DUES_KIND };

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: payTodayCents,
              product_data: { name: "NODE 2026 Dues" },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: { metadata: meta },
        metadata: meta,
        success_url: `${origin}/dashboard/payments?dues_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/payments?dues_cancel=1`,
      },
      // Unique per attempt — repeat payments of the same amount must each open a
      // fresh session rather than collide on a reused idempotency key.
      { idempotencyKey: `dues-${invoiceId}-${payTodayCents}-${Date.now()}` }
    );
    if (!session.url) return { error: "Failed to start checkout." };
    return { url: session.url };
  } catch (e) {
    console.error("[createDuesCheckout]", e);
    return { error: "Payment setup failed. Please try again." };
  }
}

/** Pay the outstanding balance on the member's storage-survey invoice. The
 *  invoice already exists (created by the storage survey); this just collects
 *  payment for it. The generic webhook credits it by metadata.invoice_id. */
export async function createStoragePaymentCheckout(): Promise<CreateDuesCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: campYear } = await admin
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();
  if (!campYear) return { error: "No 2026 camp year configured." };

  const { data: inv } = await admin
    .from("invoices")
    .select("id, amount_cents, amount_paid_cents, status")
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .eq("kind", STORAGE_KIND)
    .maybeSingle();

  if (!inv || inv.status === "cancelled" || inv.status === "refunded") {
    return {
      error: "No storage balance to pay — add items in the storage check-in first.",
    };
  }
  if (inv.status === "processing") {
    return { error: "A storage payment is already processing." };
  }
  const outstanding = inv.amount_cents - inv.amount_paid_cents;
  if (outstanding <= 0) return { error: "Your storage balance is already paid." };

  const customerId = await ensureStripeCustomer(admin, user.id, user.email ?? undefined);

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://node.family";
  const meta = { invoice_id: inv.id, profile_id: user.id, kind: STORAGE_KIND };

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: outstanding,
              product_data: { name: "NODE 2026 Storage" },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: { metadata: meta },
        metadata: meta,
        success_url: `${origin}/dashboard/payments?storage_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/payments?storage_cancel=1`,
      },
      { idempotencyKey: `storage-${inv.id}-${outstanding}` }
    );
    if (!session.url) return { error: "Failed to start checkout." };
    return { url: session.url };
  } catch (e) {
    console.error("[createStoragePaymentCheckout]", e);
    return { error: "Payment setup failed. Please try again." };
  }
}

/** Pay the outstanding balance on the member's equipment-rental invoice. The
 *  invoice already exists (created by reserveEquipment); this just collects
 *  payment for it. The generic webhook credits it by metadata.invoice_id. */
export async function createEquipmentPaymentCheckout(): Promise<CreateDuesCheckoutResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const admin = createAdminClient();
  const { data: campYear } = await admin
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();
  if (!campYear) return { error: "No 2026 camp year configured." };

  const { data: inv } = await admin
    .from("invoices")
    .select("id, amount_cents, amount_paid_cents, status")
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .eq("kind", EQUIPMENT_KIND)
    .maybeSingle();

  if (!inv || inv.status === "cancelled" || inv.status === "refunded") {
    return {
      error: "No equipment balance to pay — reserve items in Rent Equipment first.",
    };
  }
  if (inv.status === "processing") {
    return { error: "An equipment payment is already processing." };
  }
  const outstanding = inv.amount_cents - inv.amount_paid_cents;
  if (outstanding <= 0) return { error: "Your equipment balance is already paid." };

  const customerId = await ensureStripeCustomer(admin, user.id, user.email ?? undefined);

  const hdrs = await headers();
  const origin =
    hdrs.get("origin") ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://node.family";
  const meta = { invoice_id: inv.id, profile_id: user.id, kind: EQUIPMENT_KIND };

  try {
    const session = await getStripe().checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: outstanding,
              product_data: { name: "NODE 2026 Equipment Rental" },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: { metadata: meta },
        metadata: meta,
        success_url: `${origin}/dashboard/payments?equipment_session={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/dashboard/payments?equipment_cancel=1`,
      },
      { idempotencyKey: `equipment-${inv.id}-${outstanding}` }
    );
    if (!session.url) return { error: "Failed to start checkout." };
    return { url: session.url };
  } catch (e) {
    console.error("[createEquipmentPaymentCheckout]", e);
    return { error: "Payment setup failed. Please try again." };
  }
}

export type DuesStatusResult =
  | { error: string }
  | {
      exists: boolean;
      status: string | null;
      amountCents: number;
      amountPaidCents: number;
      totalInstallments: number;
      installmentNumber: number;
      /** True once a Stripe subscription (payment plan) is attached. */
      hasSubscription: boolean;
    };

/** Read the member's dues invoice for the success/pending screen. */
export async function getDuesStatus(): Promise<DuesStatusResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();
  const empty = {
    exists: false,
    status: null,
    amountCents: 0,
    amountPaidCents: 0,
    totalInstallments: 0,
    installmentNumber: 0,
    hasSubscription: false,
  };
  if (!campYear) return empty;

  const { data: inv } = await supabase
    .from("invoices")
    .select(
      "status, amount_cents, amount_paid_cents, total_installments, installment_number, stripe_subscription_id"
    )
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .eq("kind", DUES_KIND)
    .maybeSingle();
  if (!inv) return empty;

  return {
    exists: true,
    status: inv.status,
    amountCents: inv.amount_cents,
    amountPaidCents: inv.amount_paid_cents,
    totalInstallments: inv.total_installments,
    installmentNumber: inv.installment_number,
    hasSubscription: !!inv.stripe_subscription_id,
  };
}
