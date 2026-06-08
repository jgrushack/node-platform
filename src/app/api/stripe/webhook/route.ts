import { type NextRequest, NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Stripe SDK needs Node (not Edge); always run fresh (no caching).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

type Admin = ReturnType<typeof createAdminClient>;

/** Stripe's Invoice→subscription field moved across API versions; read both the
 *  classic `invoice.subscription` and the newer `parent.subscription_details`. */
function invoiceSubscriptionId(inv: Stripe.Invoice): string | null {
  const anyInv = inv as unknown as {
    subscription?: string | { id: string } | null;
    parent?: {
      subscription_details?: { subscription?: string | { id: string } | null } | null;
    } | null;
  };
  const raw =
    anyInv.subscription ?? anyInv.parent?.subscription_details?.subscription ?? null;
  if (!raw) return null;
  return typeof raw === "string" ? raw : raw.id;
}

async function applyPayment(
  admin: Admin,
  invoiceId: string,
  deltaCents: number,
  pi: string | null
): Promise<{ installment_number: number; total_installments: number; status: string } | null> {
  const { data, error } = await admin.rpc("apply_invoice_payment", {
    p_invoice_id: invoiceId,
    p_delta_cents: deltaCents,
    p_pi: pi,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ?? null;
}

async function handleEvent(event: Stripe.Event, admin: Admin): Promise<void> {
  const stripe = getStripe();

  switch (event.type) {
    case "checkout.session.completed": {
      const s = event.data.object as Stripe.Checkout.Session;
      const invoiceId = s.metadata?.invoice_id;
      if (!invoiceId) return;
      if (s.mode === "subscription" && s.subscription) {
        await admin
          .from("invoices")
          .update({ stripe_subscription_id: String(s.subscription) })
          .eq("id", invoiceId);
      }
      if (s.mode === "payment" && s.payment_intent) {
        await admin
          .from("invoices")
          .update({ stripe_payment_intent_id: String(s.payment_intent) })
          .eq("id", invoiceId);
        // ACH: funds not captured yet — show pending, credit later on success.
        if (s.payment_status !== "paid") {
          await admin
            .from("invoices")
            .update({ status: "processing" })
            .eq("id", invoiceId);
        }
      }
      return;
    }

    case "payment_intent.succeeded": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;
      if (!invoiceId) return; // subscription PIs settle via invoice.paid
      await applyPayment(admin, invoiceId, pi.amount_received ?? pi.amount, pi.id);
      return;
    }

    case "payment_intent.processing": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;
      if (!invoiceId) return;
      await admin
        .from("invoices")
        .update({ status: "processing", stripe_payment_intent_id: pi.id })
        .eq("id", invoiceId);
      return;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object as Stripe.PaymentIntent;
      const invoiceId = pi.metadata?.invoice_id;
      if (!invoiceId) return;
      // Revert a pending row to owed; never credit on failure.
      await admin
        .from("invoices")
        .update({ status: "sent" })
        .eq("id", invoiceId)
        .eq("status", "processing");
      return;
    }

    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = invoiceSubscriptionId(inv);
      if (!subId) return; // only subscription installments
      const sub = await stripe.subscriptions.retrieve(subId);
      const ourInvoiceId = sub.metadata?.invoice_id;
      if (!ourInvoiceId) return;
      // Link (ordering-independent with checkout.session.completed).
      await admin
        .from("invoices")
        .update({ stripe_subscription_id: subId })
        .eq("id", ourInvoiceId)
        .is("stripe_subscription_id", null);
      const amount = inv.amount_paid ?? 0;
      const res = await applyPayment(admin, ourInvoiceId, amount, null);
      // Cap: cancel the subscription once N successful installments have landed.
      if (res && res.installment_number >= res.total_installments) {
        try {
          await stripe.subscriptions.cancel(subId);
        } catch (e) {
          console.error("[stripe webhook] cancel sub", e);
        }
      }
      return;
    }

    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const subId = invoiceSubscriptionId(inv);
      if (!subId) return;
      const sub = await stripe.subscriptions.retrieve(subId);
      const ourInvoiceId = sub.metadata?.invoice_id;
      if (!ourInvoiceId) return;
      // Stripe dunning will retry; surface as overdue, don't credit.
      await admin
        .from("invoices")
        .update({ status: "overdue" })
        .eq("id", ourInvoiceId);
      return;
    }

    case "charge.refunded": {
      const charge = event.data.object as Stripe.Charge;
      const piId =
        typeof charge.payment_intent === "string"
          ? charge.payment_intent
          : charge.payment_intent?.id;
      if (!piId) return;
      const { data: inv } = await admin
        .from("invoices")
        .select("id")
        .eq("stripe_payment_intent_id", piId)
        .maybeSingle();
      if (!inv) return;
      await admin.rpc("apply_invoice_refund", {
        p_invoice_id: inv.id,
        p_delta_cents: charge.amount_refunded,
      });
      return;
    }

    default:
      return;
  }
}

export async function POST(request: NextRequest) {
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new NextResponse("missing signature", { status: 400 });

  const body = await request.text(); // RAW body — required for signature check
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      sig,
      getEnv("STRIPE_WEBHOOK_SECRET")
    );
  } catch (e) {
    console.error("[stripe webhook] bad signature", e);
    return new NextResponse("bad signature", { status: 400 });
  }

  const admin = createAdminClient();

  // Idempotency: claim the event id once. Duplicate redelivery => no-op.
  const { error: claimError } = await admin
    .from("stripe_events")
    .insert({ id: event.id, type: event.type });
  if (claimError) {
    if (claimError.code === "23505")
      return NextResponse.json({ received: true, duplicate: true });
    console.error("[stripe webhook] claim", claimError);
    return new NextResponse("db error", { status: 500 }); // let Stripe retry
  }

  try {
    await handleEvent(event, admin);
    await admin
      .from("stripe_events")
      .update({ processed_at: new Date().toISOString() })
      .eq("id", event.id);
  } catch (e) {
    console.error("[stripe webhook] handler", event.type, e);
    // Release the claim so Stripe's retry can reprocess.
    await admin.from("stripe_events").delete().eq("id", event.id);
    return new NextResponse("handler error", { status: 500 });
  }

  return NextResponse.json({ received: true });
}
