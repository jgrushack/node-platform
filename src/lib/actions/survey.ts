"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  ALL_QUESTIONS,
  SENSITIVE_KEYS,
  SENSITIVE_MIN_RESPONSES,
  SURVEY_YEAR,
  isQuestionVisible,
  type SurveyAnswers,
} from "@/lib/survey/questions";

const PLAYA_TZ = "America/Los_Angeles";
const TEXT_MAX = 3000;

// ── Validation ────────────────────────────────────────────────────────
// Schema is derived from the question definitions so the wizard, the
// validator, and the results page can't drift apart.
function buildAnswersSchema() {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const q of ALL_QUESTIONS) {
    switch (q.kind) {
      case "scale":
        shape[q.key] = z.number().int().min(1).max(5).nullish();
        break;
      case "choice":
        shape[q.key] = z
          .enum(q.options.map((o) => o.value) as [string, ...string[]])
          .nullish();
        break;
      case "multi":
        shape[q.key] = z
          .array(z.enum(q.options.map((o) => o.value) as [string, ...string[]]))
          .max(q.options.length)
          .nullish();
        break;
      case "text":
        shape[q.key] = z.string().max(TEXT_MAX).nullish();
        break;
    }
  }
  return z.object(shape).strict();
}

const submitSchema = z.object({
  answers: buildAnswersSchema(),
  anonymous: z.boolean().default(false),
});

export type SubmitSurveyInput = z.input<typeof submitSchema>;

/** Trim text, drop empty strings, drop answers to hidden conditional questions. */
function cleanAnswers(raw: SurveyAnswers): SurveyAnswers {
  const out: SurveyAnswers = {};
  for (const q of ALL_QUESTIONS) {
    const v = raw[q.key];
    if (v === undefined || v === null) continue;
    if (q.kind === "text") {
      const t = String(v).trim();
      if (t) out[q.key] = t;
    } else if (q.kind === "multi") {
      const arr = Array.from(new Set(Array.isArray(v) ? v : []));
      if (arr.length) out[q.key] = arr;
    } else {
      out[q.key] = v;
    }
  }
  // Second pass: conditional questions depend on cleaned parent answers.
  for (const q of ALL_QUESTIONS) {
    if (q.key in out && !isQuestionVisible(q, out)) delete out[q.key];
  }
  return out;
}

/** Required questions missing → first human-readable error, else null. */
function missingRequired(answers: SurveyAnswers): string | null {
  for (const q of ALL_QUESTIONS) {
    if (!q.required) continue;
    const v = answers[q.key];
    if (v === undefined || v === null || v === "")
      return `Please answer: ${q.label}`;
  }
  return null;
}

// ── Context ───────────────────────────────────────────────────────────
function playaToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PLAYA_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function loadContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const [{ data: campYear }, { data: me }] = await Promise.all([
    admin
      .from("camp_years")
      .select("id, start_date, end_date")
      .eq("year", SURVEY_YEAR)
      .single(),
    admin.from("profiles").select("role").eq("id", user.id).single(),
  ]);
  if (!campYear) return null;

  const { data: reg } = await admin
    .from("registrations")
    .select("status")
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .maybeSingle();

  const role = me?.role ?? "member";
  return {
    supabase,
    admin,
    user,
    campYear,
    isAdmin: ["admin", "super_admin"].includes(role),
    isConfirmed: reg?.status === "confirmed",
  };
}

/** Survey opens on gate day and stays open — campers fill it in from playa or after. */
function surveyIsOpen(startDate: string | null): boolean {
  if (!startDate) return true;
  return playaToday() >= startDate;
}

// ── Reads ─────────────────────────────────────────────────────────────
export interface MySurvey {
  /** Confirmed 2026 camper (the survey is for them). */
  eligible: boolean;
  /** Past gate day — the survey accepts responses. */
  open: boolean;
  isAdmin: boolean;
  submitted: boolean;
  submittedAt: string | null;
  updatedAt: string | null;
  anonymous: boolean;
  answers: SurveyAnswers;
  /** Camp-wide progress for the nudge on the dashboard. */
  responded: number;
  confirmed: number;
}

export async function getMySurvey(): Promise<MySurvey | { error: string }> {
  const ctx = await loadContext();
  if (!ctx) return { error: "Not signed in" };
  const { supabase, admin, user, campYear, isAdmin, isConfirmed } = ctx;

  const [{ data: mine }, { count: responded }, { count: confirmed }] =
    await Promise.all([
      supabase
        .from("burn_surveys")
        .select("answers, anonymous, submitted_at, updated_at")
        .eq("profile_id", user.id)
        .eq("camp_year_id", campYear.id)
        .maybeSingle(),
      admin
        .from("burn_surveys")
        .select("id", { count: "exact", head: true })
        .eq("camp_year_id", campYear.id),
      admin
        .from("registrations")
        .select("id", { count: "exact", head: true })
        .eq("camp_year_id", campYear.id)
        .eq("status", "confirmed"),
    ]);

  return {
    eligible: isConfirmed,
    open: surveyIsOpen(campYear.start_date),
    isAdmin,
    submitted: !!mine,
    submittedAt: mine?.submitted_at ?? null,
    updatedAt: mine?.updated_at ?? null,
    anonymous: mine?.anonymous ?? false,
    answers: (mine?.answers as SurveyAnswers | null) ?? {},
    responded: responded ?? 0,
    confirmed: confirmed ?? 0,
  };
}

// ── Write ─────────────────────────────────────────────────────────────
export type SubmitSurveyResult =
  | { success: true; firstTime: boolean }
  | { error: string };

export async function submitSurvey(
  input: SubmitSurveyInput
): Promise<SubmitSurveyResult> {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid input" };
  }

  const answers = cleanAnswers(parsed.data.answers as SurveyAnswers);
  const missing = missingRequired(answers);
  if (missing) return { error: missing };

  const ctx = await loadContext();
  if (!ctx) return { error: "Not signed in" };
  const { supabase, user, campYear, isConfirmed } = ctx;
  if (!isConfirmed)
    return { error: "The survey is for confirmed NODE 2026 campers." };
  if (!surveyIsOpen(campYear.start_date))
    return { error: "The survey opens once the burn starts." };

  // RLS-scoped client: users may only touch their own row.
  const { data: existing } = await supabase
    .from("burn_surveys")
    .select("id")
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .maybeSingle();

  const now = new Date().toISOString();
  if (existing) {
    const { error } = await supabase
      .from("burn_surveys")
      .update({ answers, anonymous: parsed.data.anonymous, updated_at: now })
      .eq("id", existing.id);
    if (error) {
      console.error("[submitSurvey] update", error);
      return { error: "Couldn't save your answers. Please try again." };
    }
    revalidatePath("/dashboard/survey");
    return { success: true, firstTime: false };
  }

  const { error } = await supabase.from("burn_surveys").insert({
    profile_id: user.id,
    camp_year_id: campYear.id,
    answers,
    anonymous: parsed.data.anonymous,
    submitted_at: now,
    updated_at: now,
  });
  if (error) {
    // Double-submit race: the unique index caught it — fall through to update.
    if (error.code === "23505") {
      const { error: updErr } = await supabase
        .from("burn_surveys")
        .update({ answers, anonymous: parsed.data.anonymous, updated_at: now })
        .eq("profile_id", user.id)
        .eq("camp_year_id", campYear.id);
      if (!updErr) {
        revalidatePath("/dashboard/survey");
        return { success: true, firstTime: false };
      }
    }
    console.error("[submitSurvey] insert", error);
    return { error: "Couldn't save your answers. Please try again." };
  }
  revalidatePath("/dashboard/survey");
  revalidatePath("/dashboard");
  return { success: true, firstTime: true };
}

// ── Admin results ─────────────────────────────────────────────────────
export interface SurveyResponse {
  id: string;
  /** null when the camper asked to stay anonymous. */
  name: string | null;
  playaName: string | null;
  anonymous: boolean;
  submittedAt: string;
  updatedAt: string;
  answers: SurveyAnswers;
}

export interface SurveyResults {
  confirmed: number;
  /** Per-camper responses with sensitive (person-naming) answers removed. */
  responses: SurveyResponse[];
  /**
   * Sensitive answers pooled per question, unattributed and shuffled. Empty
   * until SENSITIVE_MIN_RESPONSES campers have responded.
   */
  sensitive: Record<string, string[]>;
  sensitiveUnlocked: boolean;
  sensitiveMin: number;
}

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function getSurveyResults(): Promise<
  SurveyResults | { error: string }
> {
  const ctx = await loadContext();
  if (!ctx) return { error: "Not signed in" };
  if (!ctx.isAdmin) return { error: "Not authorized" };
  const { admin, campYear } = ctx;

  const [{ data: rows, error }, { count: confirmed }] = await Promise.all([
    admin
      .from("burn_surveys")
      .select(
        "id, answers, anonymous, submitted_at, updated_at, profile:profiles!inner(first_name, last_name, playa_name)"
      )
      .eq("camp_year_id", campYear.id)
      .order("submitted_at", { ascending: true }),
    admin
      .from("registrations")
      .select("id", { count: "exact", head: true })
      .eq("camp_year_id", campYear.id)
      .eq("status", "confirmed"),
  ]);
  if (error) {
    console.error("[getSurveyResults]", error);
    return { error: "Couldn't load survey results." };
  }

  type Row = {
    id: string;
    answers: SurveyAnswers;
    anonymous: boolean;
    submitted_at: string;
    updated_at: string;
    profile: {
      first_name: string | null;
      last_name: string | null;
      playa_name: string | null;
    } | null;
  };

  const all = (rows ?? []) as unknown as Row[];

  // Person-naming answers never travel with the respondent: strip them from
  // the per-camper rows and pool them separately, unlocked only past the
  // threshold so a fresh submission can't be matched to the newest row.
  const sensitiveUnlocked = all.length >= SENSITIVE_MIN_RESPONSES;
  const sensitive: Record<string, string[]> = {};
  for (const key of SENSITIVE_KEYS) {
    const pool = all
      .map((r) => r.answers?.[key])
      .filter((v): v is string => typeof v === "string" && v.trim() !== "");
    sensitive[key] = sensitiveUnlocked ? shuffle(pool) : [];
  }

  const responses: SurveyResponse[] = all.map((r) => {
    const answers: SurveyAnswers = { ...(r.answers ?? {}) };
    for (const key of SENSITIVE_KEYS) delete answers[key];
    return {
      id: r.id,
      name: r.anonymous
        ? null
        : [r.profile?.first_name, r.profile?.last_name]
            .filter(Boolean)
            .join(" ") || "Unknown",
      playaName: r.anonymous ? null : r.profile?.playa_name ?? null,
      anonymous: r.anonymous,
      submittedAt: r.submitted_at,
      updatedAt: r.updated_at,
      answers,
    };
  });

  return {
    confirmed: confirmed ?? 0,
    responses,
    sensitive,
    sensitiveUnlocked,
    sensitiveMin: SENSITIVE_MIN_RESPONSES,
  };
}
