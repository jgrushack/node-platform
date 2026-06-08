"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";

const DUES_KIND = "dues_2026";
const DEPOSIT_CENTS = 50000; // $500
// Installments finish before build week.
const PLAN_CUTOFF = new Date("2026-08-23T00:00:00-07:00");

const checkoutSchema = z.object({
  tierDollars: z.number().int().positive().max(100000),
  paymentType: z.enum(["full", "deposit", "plan"]),
  frequency: z.enum(["weekly", "biweekly", "monthly"]).optional(),
  method: z.enum(["card", "bank"]),
});

export type CreateDuesCheckoutInput = z.infer<typeof checkoutSchema>;
export type CreateDuesCheckoutResult =
  | { error: string }
  | { url: string };

/** Number of installments from now until the Aug 23 2026 cutoff. */
function installmentCount(frequency: "weekly" | "biweekly" | "monthly"): number {
  const ms = PLAN_CUTOFF.getTime() - Date.now();
  const weeks = Math.max(1, Math.floor(ms / (7 * 24 * 60 * 60 * 1000)));
  if (frequency === "weekly") return weeks;
  if (frequency === "biweekly") return Math.max(1, Math.floor(weeks / 2));
  return Math.max(1, Math.floor(weeks / 4.33)); // monthly
}

function stripeRecurring(
  frequency: "weekly" | "biweekly" | "monthly"
): { interval: "week" | "month"; interval_count: number } {
  if (frequency === "weekly") return { interval: "week", interval_count: 1 };
  if (frequency === "biweekly") return { interval: "week", interval_count: 2 };
  return { interval: "month", interval_count: 1 };
}

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
  const { tierDollars, paymentType, frequency, method } = parsed.data;
  if (paymentType === "plan" && !frequency)
    return { error: "Pick a payment frequency." };

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

  // The invoice obligation is always the FULL tier (deposit/plan pay it down).
  const amountCents = tierDollars * 100;
  const n = paymentType === "plan" ? installmentCount(frequency!) : 1;

  const customerId = await ensureStripeCustomer(admin, user.id, user.email ?? undefined);

  // Money guard: refuse to replace a dues invoice that already has a payment.
  const { data: existing } = await admin
    .from("invoices")
    .select("id, amount_paid_cents")
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .eq("kind", DUES_KIND)
    .maybeSingle();
  if (existing && (existing.amount_paid_cents ?? 0) > 0) {
    return {
      error:
        "You've already made a dues payment. Contact an admin to change your plan.",
    };
  }

  const invoiceFields = {
    profile_id: user.id,
    camp_year_id: campYear.id,
    kind: DUES_KIND,
    currency: "usd",
    amount_cents: amountCents,
    amount_paid_cents: 0,
    status: "sent",
    stripe_customer_id: customerId,
    total_installments: n,
    installment_number: 0,
    description: `NODE 2026 Dues — $${tierDollars.toLocaleString("en-US")} (${paymentType})`,
    due_date: "2026-08-23",
  };

  let invoiceId: string;
  if (existing) {
    const { data, error } = await admin
      .from("invoices")
      .update(invoiceFields)
      .eq("id", existing.id)
      .select("id")
      .single();
    if (error || !data) return { error: "Failed to prepare dues invoice." };
    invoiceId = data.id;
  } else {
    const { data, error } = await admin
      .from("invoices")
      .insert(invoiceFields)
      .select("id")
      .single();
    if (error || !data) {
      // Unique-index race — re-read and reuse.
      const { data: raced } = await admin
        .from("invoices")
        .select("id, amount_paid_cents")
        .eq("profile_id", user.id)
        .eq("camp_year_id", campYear.id)
        .eq("kind", DUES_KIND)
        .maybeSingle();
      if (!raced) return { error: "Failed to prepare dues invoice." };
      if ((raced.amount_paid_cents ?? 0) > 0)
        return { error: "You've already made a dues payment. Contact an admin." };
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
  const methodTypes =
    method === "bank"
      ? (["us_bank_account"] as const)
      : (["card"] as const);
  const successUrl = `${origin}/dashboard/payments?dues_session={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/dashboard/payments?dues_cancel=1`;
  const sharedMeta = {
    invoice_id: invoiceId,
    profile_id: user.id,
    kind: DUES_KIND,
  };

  try {
    const stripe = getStripe();
    if (paymentType === "plan") {
      const perInstallment = Math.ceil(amountCents / n);
      const session = await stripe.checkout.sessions.create(
        {
          mode: "subscription",
          customer: customerId,
          payment_method_types: [...methodTypes],
          line_items: [
            {
              price_data: {
                currency: "usd",
                unit_amount: perInstallment,
                recurring: stripeRecurring(frequency!),
                product_data: { name: `NODE 2026 Dues (1 of ${n})` },
              },
              quantity: 1,
            },
          ],
          subscription_data: { metadata: { ...sharedMeta, n: String(n) } },
          metadata: sharedMeta,
          success_url: successUrl,
          cancel_url: cancelUrl,
        },
        { idempotencyKey: `dues-sub-${invoiceId}` }
      );
      if (!session.url) return { error: "Failed to start checkout." };
      return { url: session.url };
    }

    const chargeCents = paymentType === "deposit" ? DEPOSIT_CENTS : amountCents;
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer: customerId,
        payment_method_types: [...methodTypes],
        line_items: [
          {
            price_data: {
              currency: "usd",
              unit_amount: chargeCents,
              product_data: {
                name: `NODE 2026 Dues${paymentType === "deposit" ? " — deposit" : ""}`,
              },
            },
            quantity: 1,
          },
        ],
        payment_intent_data: { metadata: sharedMeta },
        metadata: sharedMeta,
        success_url: successUrl,
        cancel_url: cancelUrl,
      },
      { idempotencyKey: `dues-${paymentType}-${invoiceId}-${chargeCents}` }
    );
    if (!session.url) return { error: "Failed to start checkout." };
    return { url: session.url };
  } catch (e) {
    console.error("[createDuesCheckout]", e);
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
  };
  if (!campYear) return empty;

  const { data: inv } = await supabase
    .from("invoices")
    .select(
      "status, amount_cents, amount_paid_cents, total_installments, installment_number"
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
  };
}
