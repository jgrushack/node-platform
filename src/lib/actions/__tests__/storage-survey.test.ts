import { describe, it, expect, vi, beforeEach } from "vitest";
import { updateStorageSurvey, STORAGE_PRICES_CENTS } from "../storage-survey";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

// A Supabase query-builder stub: every chainable method returns the builder,
// terminal reads resolve configured data, and awaiting the builder itself
// (the update/eq terminal) resolves `thenResult`.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBuilder(results: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = {};
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.is = vi.fn(() => b);
  b.update = vi.fn(() => b);
  b.insert = vi.fn(() => Promise.resolve(results.insertResult ?? { error: null }));
  b.single = vi.fn(() => Promise.resolve(results.single ?? { data: null }));
  b.maybeSingle = vi.fn(() => Promise.resolve(results.maybeSingle ?? { data: null }));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b.then = (resolve: any) => resolve(results.thenResult ?? { error: null });
  return b;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setupAdmin(existing: any, insertResult: any = { error: null }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cache: any = {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin: any = {
    from: vi.fn((t: string) => (cache[t] ??= makeBuilder({
      camp_years: { single: { data: { id: "cy1" } } },
      invoices: { maybeSingle: { data: existing }, insertResult },
      profiles: {},
    }[t] ?? {}))),
    _b: cache,
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (createAdminClient as any).mockReturnValue(admin);
  return admin;
}

const item = (q: number, d = "") => ({ quantity: q, description: d });
function input(
  over: Partial<{
    hasItems: boolean;
    bikes: { quantity: number; description: string };
    bins: { quantity: number; description: string };
    acs: { quantity: number; description: string };
    shiftpods: { quantity: number; description: string };
  }> = {}
) {
  return {
    hasItems: true,
    bikes: item(0),
    bins: item(0),
    acs: item(0),
    shiftpods: item(0),
    ...over,
  };
}

describe("updateStorageSurvey", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (createClient as any).mockResolvedValue({
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } }) },
    });
  });

  it("blocks edits once a payment exists (no writes)", async () => {
    const admin = setupAdmin({
      id: "inv1",
      amount_cents: 20000,
      amount_paid_cents: 5000,
      status: "partial",
      notes: null,
    });
    const res = await updateStorageSurvey(input({ bikes: item(1) }));
    expect("error" in res).toBe(true);
    expect(admin._b.invoices.update).not.toHaveBeenCalled();
    expect(admin._b.invoices.insert).not.toHaveBeenCalled();
  });

  it("cancels (not deletes) when edited down to zero", async () => {
    const admin = setupAdmin({
      id: "inv1",
      amount_cents: 20000,
      amount_paid_cents: 0,
      status: "sent",
      notes: null,
    });
    const res = await updateStorageSurvey(input({ hasItems: false }));
    expect(res).toMatchObject({ success: true, chargeCents: 0, action: "cancelled" });
    expect(admin._b.invoices.update).toHaveBeenCalledTimes(1);
    expect(admin._b.invoices.update.mock.calls[0][0]).toMatchObject({
      status: "cancelled",
      amount_cents: 0,
    });
    expect(admin._b.invoices.insert).not.toHaveBeenCalled();
  });

  it("inserts a new charge (incl. shiftpod) when none exists", async () => {
    const admin = setupAdmin(null);
    const res = await updateStorageSurvey(
      input({ bikes: item(1), bins: item(1), acs: item(1), shiftpods: item(1) })
    );
    const total =
      STORAGE_PRICES_CENTS.bike +
      STORAGE_PRICES_CENTS.bin +
      STORAGE_PRICES_CENTS.ac +
      STORAGE_PRICES_CENTS.shiftpod;
    expect(res).toMatchObject({ success: true, chargeCents: total, action: "inserted" });
    expect(admin._b.invoices.insert).toHaveBeenCalledTimes(1);
    expect(admin._b.invoices.insert.mock.calls[0][0]).toMatchObject({
      amount_cents: total,
      kind: "storage_survey_2026",
    });
  });

  it("updates an existing active charge", async () => {
    const admin = setupAdmin({
      id: "inv1",
      amount_cents: 10000,
      amount_paid_cents: 0,
      status: "sent",
      notes: null,
    });
    const res = await updateStorageSurvey(input({ bikes: item(2) }));
    expect(res).toMatchObject({
      success: true,
      chargeCents: STORAGE_PRICES_CENTS.bike * 2,
      action: "updated",
    });
    expect(admin._b.invoices.update.mock.calls[0][0]).toMatchObject({
      status: "sent",
      amount_cents: STORAGE_PRICES_CENTS.bike * 2,
    });
    expect(admin._b.invoices.insert).not.toHaveBeenCalled();
  });

  it("resurrects a cancelled row via update, not insert", async () => {
    const admin = setupAdmin({
      id: "inv1",
      amount_cents: 0,
      amount_paid_cents: 0,
      status: "cancelled",
      notes: null,
    });
    const res = await updateStorageSurvey(input({ shiftpods: item(1) }));
    expect(res).toMatchObject({
      success: true,
      chargeCents: STORAGE_PRICES_CENTS.shiftpod,
      action: "updated",
    });
    expect(admin._b.invoices.update).toHaveBeenCalledTimes(1);
    expect(admin._b.invoices.update.mock.calls[0][0]).toMatchObject({ status: "sent" });
    expect(admin._b.invoices.insert).not.toHaveBeenCalled();
  });

  it("never nulls the completion flag on edit", async () => {
    const admin = setupAdmin({
      id: "inv1",
      amount_cents: 10000,
      amount_paid_cents: 0,
      status: "sent",
      notes: null,
    });
    await updateStorageSurvey(input({ bikes: item(1) }));
    const flagArg = admin._b.profiles.update.mock.calls[0][0];
    expect(flagArg.storage_survey_completed_at).toEqual(expect.any(String));
  });
});
