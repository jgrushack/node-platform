import { describe, it, expect, vi, beforeEach } from "vitest";
import { submitSurvey, getMySurvey, getSurveyResults } from "../survey";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

// Chainable query-builder stub. Terminal reads resolve configured data;
// `insert`/`update` record their payloads so tests can assert on them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeBuilder(cfg: any = {}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const b: any = { calls: { insert: [] as unknown[], update: [] as unknown[] } };
  b.select = vi.fn(() => b);
  b.eq = vi.fn(() => b);
  b.order = vi.fn(() => b);
  b.single = vi.fn(() => Promise.resolve(cfg.single ?? { data: null }));
  b.maybeSingle = vi.fn(() => Promise.resolve(cfg.maybeSingle ?? { data: null }));
  b.insert = vi.fn((payload: unknown) => {
    b.calls.insert.push(payload);
    return Promise.resolve(cfg.insertResult ?? { error: null });
  });
  b.update = vi.fn((payload: unknown) => {
    b.calls.update.push(payload);
    return b;
  });
  // Awaiting the builder (update().eq() terminal, or a head count) resolves this.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  b.then = (resolve: any) => resolve(cfg.thenResult ?? { error: null, count: cfg.count ?? 0 });
  return b;
}

function setup(opts: {
  user?: { id: string } | null;
  role?: string;
  regStatus?: string | null;
  startDate?: string | null;
  existing?: { id: string } | null;
  insertResult?: unknown;
} = {}) {
  const {
    user = { id: "u1" },
    role = "member",
    regStatus = "confirmed",
    startDate = "2000-01-01",
    existing = null,
    insertResult,
  } = opts;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userBuilders: Record<string, any> = {};
  const userClient = {
    auth: { getUser: vi.fn(() => Promise.resolve({ data: { user } })) },
    from: vi.fn((t: string) =>
      (userBuilders[t] ??= makeBuilder(
        t === "burn_surveys" ? { maybeSingle: { data: existing }, insertResult } : {}
      ))
    ),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminBuilders: Record<string, any> = {};
  const adminClient = {
    from: vi.fn((t: string) =>
      (adminBuilders[t] ??= makeBuilder(
        {
          camp_years: { single: { data: { id: "cy1", start_date: startDate, end_date: null } } },
          profiles: { single: { data: { role } } },
          registrations: {
            maybeSingle: { data: regStatus ? { status: regStatus } : null },
            count: 42,
          },
          burn_surveys: { count: 7 },
        }[t] ?? {}
      ))
    ),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (createClient as any).mockResolvedValue(userClient);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (createAdminClient as any).mockReturnValue(adminClient);
  return { userBuilders, adminBuilders };
}

const good = {
  answers: {
    overall: 5,
    returning: "hell_yes",
    highlight: "  Martini Therapy  ",
    lead_interest: "no",
    lead_area: "should be dropped — parent says no",
    kitchen: null,
    commit_2027: ["lead", "build", "lead"],
    no_show_consequence: [],
  },
  anonymous: false,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("submitSurvey", () => {
  it("rejects when a required question is missing", async () => {
    setup();
    const res = await submitSurvey({ answers: { overall: 4 }, anonymous: false });
    expect(res).toEqual({ error: expect.stringContaining("Are you coming back") });
  });

  it("rejects out-of-range scale and unknown keys", async () => {
    setup();
    expect(
      await submitSurvey({ answers: { overall: 9, returning: "hell_yes" }, anonymous: false })
    ).toHaveProperty("error");
    expect(
      await submitSurvey({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        answers: { overall: 4, returning: "hell_yes", bogus: "x" } as any,
        anonymous: false,
      })
    ).toHaveProperty("error");
    expect(
      await submitSurvey({ answers: { overall: 4, returning: "nope" }, anonymous: false })
    ).toHaveProperty("error");
  });

  it("rejects unknown multi-select values", async () => {
    setup();
    expect(
      await submitSurvey({
        answers: { overall: 4, returning: "hell_yes", commit_2027: ["lead", "nope"] },
        anonymous: false,
      })
    ).toHaveProperty("error");
  });

  it("requires a signed-in, confirmed camper", async () => {
    setup({ user: null });
    expect(await submitSurvey(good)).toEqual({ error: "Not signed in" });

    setup({ regStatus: "cancelled" });
    expect(await submitSurvey(good)).toEqual({
      error: "The survey is for confirmed NODE 2026 campers.",
    });
  });

  it("refuses submissions before gate day", async () => {
    setup({ startDate: "2999-01-01" });
    expect(await submitSurvey(good)).toEqual({
      error: "The survey opens once the burn starts.",
    });
  });

  it("inserts a cleaned row on first submit", async () => {
    const { userBuilders } = setup();
    const res = await submitSurvey(good);
    expect(res).toEqual({ success: true, firstTime: true });
    const [payload] = userBuilders.burn_surveys.calls.insert as {
      profile_id: string;
      camp_year_id: string;
      answers: Record<string, unknown>;
      anonymous: boolean;
    }[];
    expect(payload.profile_id).toBe("u1");
    expect(payload.camp_year_id).toBe("cy1");
    expect(payload.anonymous).toBe(false);
    // Trimmed text, nulls dropped, hidden conditional dropped.
    expect(payload.answers).toEqual({
      overall: 5,
      returning: "hell_yes",
      highlight: "Martini Therapy",
      lead_interest: "no",
      commit_2027: ["lead", "build"],
    });
  });

  it("keeps lead_area when lead_interest is yes/maybe", async () => {
    const { userBuilders } = setup();
    await submitSurvey({
      answers: { overall: 3, returning: "probably", lead_interest: "maybe", lead_area: "Bar" },
      anonymous: true,
    });
    const [payload] = userBuilders.burn_surveys.calls.insert as {
      answers: Record<string, unknown>;
      anonymous: boolean;
    }[];
    expect(payload.answers.lead_area).toBe("Bar");
    expect(payload.anonymous).toBe(true);
  });

  it("updates in place when a row already exists", async () => {
    const { userBuilders } = setup({ existing: { id: "s1" } });
    const res = await submitSurvey({ ...good, anonymous: true });
    expect(res).toEqual({ success: true, firstTime: false });
    expect(userBuilders.burn_surveys.calls.insert).toHaveLength(0);
    const [payload] = userBuilders.burn_surveys.calls.update as { anonymous: boolean }[];
    expect(payload.anonymous).toBe(true);
    expect(userBuilders.burn_surveys.eq).toHaveBeenCalledWith("id", "s1");
  });

  it("falls back to update on a unique-violation race", async () => {
    const { userBuilders } = setup({ insertResult: { error: { code: "23505" } } });
    const res = await submitSurvey(good);
    expect(res).toEqual({ success: true, firstTime: false });
    expect(userBuilders.burn_surveys.calls.update).toHaveLength(1);
  });
});

describe("getSurveyResults", () => {
  function rows(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      id: `s${i}`,
      answers: {
        overall: 4,
        person_highlight: `hero ${i}`,
        person_lowlight: i === 0 ? "villain" : null,
      },
      anonymous: i % 2 === 0,
      submitted_at: "2026-09-10T00:00:00Z",
      updated_at: "2026-09-10T00:00:00Z",
      profile: { first_name: "Camper", last_name: String(i), playa_name: null },
    }));
  }

  it("refuses non-admins", async () => {
    setup({ role: "member" });
    expect(await getSurveyResults()).toEqual({ error: "Not authorized" });
  });

  it("strips person-naming answers and keeps the pool locked under the threshold", async () => {
    const { adminBuilders } = setup({ role: "admin" });
    // Pre-create the burn_surveys builder so the ordered select resolves rows.
    adminBuilders.burn_surveys = makeBuilder({ thenResult: { data: rows(3), error: null }, count: 3 });
    const res = await getSurveyResults();
    if ("error" in res) throw new Error(res.error);
    expect(res.responses).toHaveLength(3);
    expect(res.sensitiveUnlocked).toBe(false);
    expect(res.sensitive.person_highlight).toEqual([]);
    for (const r of res.responses) {
      expect(r.answers).not.toHaveProperty("person_highlight");
      expect(r.answers).not.toHaveProperty("person_lowlight");
      expect(r.answers.overall).toBe(4);
    }
    // Anonymous rows carry no name; others do.
    expect(res.responses[0].name).toBeNull();
    expect(res.responses[1].name).toBe("Camper 1");
  });

  it("unlocks the unattributed pool once enough campers responded", async () => {
    const { adminBuilders } = setup({ role: "admin" });
    adminBuilders.burn_surveys = makeBuilder({ thenResult: { data: rows(10), error: null }, count: 10 });
    const res = await getSurveyResults();
    if ("error" in res) throw new Error(res.error);
    expect(res.sensitiveUnlocked).toBe(true);
    expect([...res.sensitive.person_highlight].sort()).toEqual(
      Array.from({ length: 10 }, (_, i) => `hero ${i}`).sort()
    );
    expect(res.sensitive.person_lowlight).toEqual(["villain"]);
  });
});

describe("getMySurvey", () => {
  it("reports eligibility, open state, and camp-wide counts", async () => {
    setup({ role: "admin" });
    const res = await getMySurvey();
    expect(res).toMatchObject({
      eligible: true,
      open: true,
      isAdmin: true,
      submitted: false,
      responded: 7,
      confirmed: 42,
    });
  });

  it("is closed before gate and ineligible without a confirmed registration", async () => {
    setup({ startDate: "2999-01-01", regStatus: null });
    const res = await getMySurvey();
    expect(res).toMatchObject({ eligible: false, open: false });
  });
});
