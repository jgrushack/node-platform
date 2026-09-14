"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Users,
  Star,
  Repeat,
  HandCoins,
  Lock,
  Loader2,
  Download,
  ArrowLeft,
  EyeOff,
  ChevronDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  SURVEY_SECTIONS,
  SURVEY_YEAR,
  ALL_QUESTIONS,
  type ChoiceQuestion,
  type MultiQuestion,
  type ScaleQuestion,
  type SurveyAnswers,
  type SurveyQuestion,
  type TextQuestion,
} from "@/lib/survey/questions";
import {
  getSurveyResults,
  type SurveyResponse,
  type SurveyResults,
} from "@/lib/actions/survey";

// ── Aggregation helpers ───────────────────────────────────────────────
function numbers(responses: SurveyResponse[], key: string): number[] {
  return responses
    .map((r) => r.answers[key])
    .filter((v): v is number => typeof v === "number");
}
function strings(responses: SurveyResponse[], key: string): string[] {
  return responses
    .map((r) => r.answers[key])
    .filter((v): v is string => typeof v === "string" && v.trim() !== "");
}
function lists(responses: SurveyResponse[], key: string): string[][] {
  return responses
    .map((r) => r.answers[key])
    .filter((v): v is string[] => Array.isArray(v) && v.length > 0);
}
function avg(xs: number[]): number | null {
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
const fmt1 = (n: number | null) => (n === null ? "—" : n.toFixed(1));

function displayName(r: SurveyResponse): string {
  if (r.anonymous || !r.name) return "Anonymous";
  return r.playaName ? `${r.name} (${r.playaName})` : r.name;
}

// ── Bars (single hue; the value is the identity, no legend needed) ────
function DistBar({
  rows,
  total,
}: {
  rows: { label: string; count: number }[];
  total: number;
}) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <div className="space-y-1.5">
      {rows.map((r) => {
        const pct = total ? Math.round((r.count / total) * 100) : 0;
        return (
          <div
            key={r.label}
            className="grid grid-cols-[minmax(0,7rem)_1fr_3.5rem] items-center gap-2 text-xs"
            title={`${r.label}: ${r.count} (${pct}%)`}
          >
            <span className="truncate text-sand-300">{r.label}</span>
            <div className="h-2.5 rounded-sm bg-white/[0.04]">
              <div
                className="h-full rounded-sm bg-pink-500/70"
                style={{ width: `${(r.count / max) * 100}%` }}
              />
            </div>
            <span className="text-right tabular-nums text-sand-400">
              {r.count}
              <span className="text-sand-600"> · {pct}%</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ScaleResult({
  q,
  responses,
}: {
  q: ScaleQuestion;
  responses: SurveyResponse[];
}) {
  const xs = numbers(responses, q.key);
  const rows = [5, 4, 3, 2, 1].map((n) => ({
    label: n === 5 ? `5 · ${q.high}` : n === 1 ? `1 · ${q.low}` : String(n),
    count: xs.filter((x) => x === n).length,
  }));
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-sand-100">{q.label}</p>
        <p className="flex-shrink-0 text-sm text-sand-300">
          <span className="text-lg font-bold tabular-nums text-sand-100">
            {fmt1(avg(xs))}
          </span>
          <span className="text-sand-500"> / 5 · {xs.length} answered</span>
        </p>
      </div>
      <DistBar rows={rows} total={xs.length} />
    </div>
  );
}

function MultiResult({
  q,
  responses,
}: {
  q: MultiQuestion;
  responses: SurveyResponse[];
}) {
  const xs = lists(responses, q.key);
  const rows = q.options.map((o) => ({
    label: o.label,
    count: xs.filter((arr) => arr.includes(o.value)).length,
  }));
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-sand-100">{q.label}</p>
        <p className="flex-shrink-0 text-xs text-sand-500">
          {xs.length} answered · pick-many
        </p>
      </div>
      <DistBar rows={rows} total={xs.length} />
    </div>
  );
}

function ChoiceResult({
  q,
  responses,
}: {
  q: ChoiceQuestion;
  responses: SurveyResponse[];
}) {
  const xs = strings(responses, q.key);
  const rows = q.options.map((o) => ({
    label: o.label,
    count: xs.filter((x) => x === o.value).length,
  }));
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm font-medium text-sand-100">{q.label}</p>
        <p className="flex-shrink-0 text-xs text-sand-500">{xs.length} answered</p>
      </div>
      <DistBar rows={rows} total={xs.length} />
    </div>
  );
}

function TextResult({
  q,
  responses,
}: {
  q: TextQuestion;
  responses: SurveyResponse[];
}) {
  const [open, setOpen] = useState(true);
  const items = responses
    .filter((r) => typeof r.answers[q.key] === "string" && String(r.answers[q.key]).trim())
    .map((r) => ({ id: r.id, who: displayName(r), text: String(r.answers[q.key]) }));
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 text-left"
      >
        <p className="text-sm font-medium text-sand-100">{q.label}</p>
        <span className="flex flex-shrink-0 items-center gap-1 text-xs text-sand-500">
          {items.length} {items.length === 1 ? "answer" : "answers"}
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>
      {open && items.length > 0 && (
        <ul className="space-y-2">
          {items.map((it) => (
            <li
              key={it.id}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-sand-200">{it.text}</p>
              <p className="mt-1.5 text-[11px] text-sand-500">— {it.who}</p>
            </li>
          ))}
        </ul>
      )}
      {open && items.length === 0 && (
        <p className="text-xs text-sand-600">No answers yet.</p>
      )}
    </div>
  );
}

function SensitiveResult({
  q,
  pool,
  unlocked,
  responded,
  min,
}: {
  q: TextQuestion;
  pool: string[];
  unlocked: boolean;
  responded: number;
  min: number;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="flex items-center gap-1.5 text-sm font-medium text-sand-100">
          <EyeOff className="h-3.5 w-3.5 text-amber-300/90" />
          {q.label}
        </p>
        <span className="flex-shrink-0 text-xs text-sand-500">
          {unlocked ? `${pool.length} answers · unattributed` : "locked"}
        </span>
      </div>
      {!unlocked && (
        <p className="flex items-center gap-2 rounded-lg border border-amber/20 bg-amber/5 p-3 text-xs text-amber-200/90">
          <Lock className="h-3.5 w-3.5 flex-shrink-0" />
          Unlocks at {min} responses ({responded} so far) so nobody can be
          matched to a fresh submission.
        </p>
      )}
      {unlocked && pool.length === 0 && (
        <p className="text-xs text-sand-600">No answers yet.</p>
      )}
      {unlocked && pool.length > 0 && (
        <ul className="space-y-2">
          {pool.map((text, i) => (
            <li
              key={i}
              className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3"
            >
              <p className="whitespace-pre-wrap text-sm text-sand-200">{text}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionResult({
  q,
  responses,
}: {
  q: SurveyQuestion;
  responses: SurveyResponse[];
}) {
  switch (q.kind) {
    case "scale":
      return <ScaleResult q={q} responses={responses} />;
    case "multi":
      return <MultiResult q={q} responses={responses} />;
    case "choice":
      return <ChoiceResult q={q} responses={responses} />;
    case "text":
      return <TextResult q={q} responses={responses} />;
  }
}

// ── CSV ───────────────────────────────────────────────────────────────
function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
const CSV_QUESTIONS = ALL_QUESTIONS.filter((q) => !(q.kind === "text" && q.sensitive));
function buildCsv(responses: SurveyResponse[]): string {
  const head = ["name", "playa_name", "anonymous", "submitted_at", "updated_at", ...CSV_QUESTIONS.map((q) => q.key)];
  const lines = responses.map((r) =>
    [
      r.anonymous ? "" : r.name ?? "",
      r.anonymous ? "" : r.playaName ?? "",
      r.anonymous ? "yes" : "no",
      r.submittedAt,
      r.updatedAt,
      ...CSV_QUESTIONS.map((q) => {
        const v = r.answers[q.key];
        return Array.isArray(v) ? v.join("; ") : v;
      }),
    ]
      .map(csvCell)
      .join(",")
  );
  return [head.join(","), ...lines].join("\n");
}

// ── Per-respondent view ───────────────────────────────────────────────
function answerLabel(q: SurveyQuestion, v: SurveyAnswers[string]): string {
  if (v === null || v === undefined || v === "") return "—";
  if (q.kind === "choice")
    return q.options.find((o) => o.value === v)?.label ?? String(v);
  if (q.kind === "multi" && Array.isArray(v))
    return v
      .map((x) => q.options.find((o) => o.value === x)?.label ?? x)
      .join(", ");
  if (q.kind === "scale") return `${v} / 5`;
  return String(v);
}

function ResponseCard({ r }: { r: SurveyResponse }) {
  const [open, setOpen] = useState(false);
  const overall = r.answers.overall;
  return (
    <Card className="glass-card border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 p-4 text-left"
      >
        <div className="min-w-0">
          <p className="flex items-center gap-2 truncate font-medium text-sand-100">
            {r.anonymous && <EyeOff className="h-4 w-4 text-sand-500" />}
            {displayName(r)}
          </p>
          <p className="text-xs text-sand-500">
            {new Date(r.submittedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
            {typeof overall === "number" ? ` · overall ${overall}/5` : ""}
          </p>
        </div>
        <ChevronDown
          className={`h-4 w-4 flex-shrink-0 text-sand-500 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <CardContent className="space-y-5 border-t border-white/[0.06] pt-4">
          {SURVEY_SECTIONS.map((s) => (
            <div key={s.key}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-pink-400/80">
                {s.title}
              </p>
              <dl className="space-y-2">
                {s.questions
                  .filter((q) => !(q.kind === "text" && q.sensitive))
                  .map((q) => (
                  <div key={q.key} className="grid gap-0.5 sm:grid-cols-[1fr_1fr]">
                    <dt className="text-xs text-sand-500">{q.label}</dt>
                    <dd className="whitespace-pre-wrap text-sm text-sand-200">
                      {answerLabel(q, r.answers[q.key])}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────
export default function SurveyResultsClient() {
  const [data, setData] = useState<SurveyResults | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSurveyResults().then((res) => {
      if ("error" in res) setError(res.error);
      else setData(res);
    });
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const rs = data.responses;
    const overall = avg(numbers(rs, "overall"));
    const returning = strings(rs, "returning");
    const back = returning.filter((v) => v === "hell_yes" || v === "probably").length;
    const deposit = strings(rs, "deposit");
    const depositYes = deposit.filter(
      (v) => v === "strongly_support" || v === "support"
    ).length;
    return {
      responded: rs.length,
      pct: data.confirmed ? Math.round((rs.length / data.confirmed) * 100) : 0,
      overall,
      backPct: returning.length ? Math.round((back / returning.length) * 100) : null,
      backN: returning.length,
      depositPct: deposit.length ? Math.round((depositYes / deposit.length) * 100) : null,
      depositN: deposit.length,
      anon: rs.filter((r) => r.anonymous).length,
    };
  }, [data]);

  function download() {
    if (!data) return;
    const blob = new Blob([buildCsv(data.responses)], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `node-${SURVEY_YEAR}-survey.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error) {
    return (
      <Card className="glass-card border-0">
        <CardContent className="py-10 text-center text-sand-400">{error}</CardContent>
      </Card>
    );
  }
  if (!data || !stats) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
      </div>
    );
  }

  const tiles = [
    {
      label: "Responses",
      value: `${stats.responded}/${data.confirmed}`,
      detail: `${stats.pct}% of confirmed campers · ${stats.anon} anonymous`,
      icon: Users,
      color: "text-pink-400",
    },
    {
      label: "Overall",
      value: fmt1(stats.overall),
      detail: "average out of 5",
      icon: Star,
      color: "text-golden",
    },
    {
      label: "Coming back",
      value: stats.backPct === null ? "—" : `${stats.backPct}%`,
      detail: `"hell yes" or "probably" · ${stats.backN} answered`,
      icon: Repeat,
      color: "text-emerald-400",
    },
    {
      label: "Work deposit",
      value: stats.depositPct === null ? "—" : `${stats.depositPct}%`,
      detail: `support or strongly support · ${stats.depositN} answered`,
      icon: HandCoins,
      color: "text-coral",
    },
  ];

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-wrap items-end justify-between gap-3"
      >
        <div>
          <Link
            href="/dashboard/survey"
            className="mb-2 inline-flex items-center gap-1 text-xs text-sand-500 hover:text-sand-300"
          >
            <ArrowLeft className="h-3 w-3" /> Survey
          </Link>
          <h1 className="text-3xl font-bold text-sand-100">
            {SURVEY_YEAR} Survey Results
          </h1>
          <p className="mt-1 text-sand-400">
            What the camp said. Admins only.
          </p>
        </div>
        <Button
          variant="ghost"
          onClick={download}
          disabled={!data.responses.length}
          className="text-sand-300 hover:text-sand-100"
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </motion.div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((t, i) => (
          <motion.div
            key={t.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="glass-card border-0">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-sand-400">
                  {t.label}
                </CardTitle>
                <t.icon className={`h-4 w-4 ${t.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold tabular-nums text-sand-100">
                  {t.value}
                </div>
                <p className="mt-1 text-xs text-sand-500">{t.detail}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <Tabs defaultValue="summary">
        <TabsList className="bg-blue-950/50 border border-amber/10">
          <TabsTrigger
            value="summary"
            className="data-[state=active]:bg-amber/15 data-[state=active]:text-amber text-sand-400"
          >
            Summary
          </TabsTrigger>
          <TabsTrigger
            value="responses"
            className="data-[state=active]:bg-amber/15 data-[state=active]:text-amber text-sand-400"
          >
            Responses
          </TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6 space-y-6">
          {data.responses.length === 0 && (
            <Card className="glass-card border-0">
              <CardContent className="py-10 text-center text-sand-400">
                No responses yet. Send the camp to /dashboard/survey.
              </CardContent>
            </Card>
          )}
          {data.responses.length > 0 &&
            SURVEY_SECTIONS.map((s) => (
              <Card key={s.key} className="glass-card border-0">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sand-200">{s.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-7">
                  {s.questions.map((q) =>
                    q.kind === "text" && q.sensitive ? (
                      <SensitiveResult
                        key={q.key}
                        q={q}
                        pool={data.sensitive[q.key] ?? []}
                        unlocked={data.sensitiveUnlocked}
                        responded={data.responses.length}
                        min={data.sensitiveMin}
                      />
                    ) : (
                      <QuestionResult key={q.key} q={q} responses={data.responses} />
                    )
                  )}
                </CardContent>
              </Card>
            ))}
        </TabsContent>

        <TabsContent value="responses" className="mt-6 space-y-3">
          {data.responses.length === 0 && (
            <p className="py-10 text-center text-sand-400">No responses yet.</p>
          )}
          {[...data.responses].reverse().map((r) => (
            <ResponseCard key={r.id} r={r} />
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
