import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("[Stripe] STRIPE_SECRET_KEY is not set — payments will fail");
}

let _stripe: Stripe | null = null;

/**
 * Lazily construct the Stripe client. Mirrors the Resend pattern: never build it
 * at module load, so a bare import (or `next build` without keys) never depends
 * on STRIPE_SECRET_KEY. The constructor doesn't hit the network — that only
 * happens on the first API call, which is always request-time.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
  }
  return _stripe;
}
