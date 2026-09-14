"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Flame,
  Tent,
  Briefcase,
  CalendarDays,
  Sparkles,
  MessageSquare,
  Loader2,
  CheckCircle2,
  EyeOff,
  BarChart3,
  Pencil,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import {
  SURVEY_SECTIONS,
  SURVEY_YEAR,
  isQuestionVisible,
  type ChoiceQuestion,
  type MultiQuestion,
  type ScaleQuestion,
  type SurveyAnswers,
  type SurveyQuestion,
  type TextQuestion,
} from "@/lib/survey/questions";
import { getMySurvey, submitSurvey, type MySurvey } from "@/lib/actions/survey";

const DRAFT_KEY = `node:survey:${SURVEY_YEAR}:draft`;

const SECTION_ICONS = [Flame, Tent, Briefcase, CalendarDays, Sparkles, MessageSquare];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 40 : -40, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -40 : 40, opacity: 0 }),
};

// ── Inputs ────────────────────────────────────────────────────────────
const pill = (active: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm transition-colors ${
    active
      ? "border-pink-500/60 bg-pink-500/20 text-pink-200"
      : "border-white/10 bg-white/[0.03] text-sand-300 hover:border-pink-500/30 hover:bg-white/5"
  }`;

function ScaleInput({
  q,
  value,
  onChange,
}: {
  q: ScaleQuestion;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(active ? null : n)}
              className={`h-11 rounded-xl border text-base font-semibold tabular-nums transition-all ${
                active
                  ? "border-pink-500/60 bg-pink-500/20 text-pink-100 shadow-[0_0_18px_rgba(249,0,119,0.25)]"
                  : "border-white/10 bg-white/[0.03] text-sand-300 hover:border-pink-500/30 hover:bg-white/5"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-sand-500">
        <span>{q.low}</span>
        <span>{q.high}</span>
      </div>
    </div>
  );
}

function MultiInput({
  q,
  value,
  onChange,
}: {
  q: MultiQuestion;
  value: string[];
  onChange: (v: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {q.options.map((o) => {
        const active = value.includes(o.value);
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() =>
              onChange(
                active ? value.filter((v) => v !== o.value) : [...value, o.value]
              )
            }
            className={pill(active)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function ChoiceInput({
  q,
  value,
  onChange,
}: {
  q: ChoiceQuestion;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {q.options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : o.value)}
            className={pill(active)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function TextInput({
  q,
  value,
  onChange,
}: {
  q: TextQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={q.placeholder}
      maxLength={3000}
      rows={3}
      className="min-h-20 border-white/10 bg-white/[0.03] text-sand-100 placeholder:text-sand-600 focus-visible:border-pink-500/50 focus-visible:ring-pink-500/20"
    />
  );
}

function QuestionBlock({
  q,
  answers,
  setAnswer,
}: {
  q: SurveyQuestion;
  answers: SurveyAnswers;
  setAnswer: (key: string, v: number | string | string[] | null) => void;
}) {
  const v = answers[q.key];
  return (
    <div className="space-y-2.5">
      <div>
        <p className="text-sm font-medium text-sand-100">
          {q.label}
          {q.required && <span className="ml-1 text-pink-400">*</span>}
        </p>
        {q.hint && (
          <p
            className={`mt-0.5 flex items-start gap-1 text-xs ${
              q.kind === "text" && q.sensitive ? "text-amber-300/90" : "text-sand-500"
            }`}
          >
            {q.kind === "text" && q.sensitive && (
              <EyeOff className="mt-0.5 h-3 w-3 flex-shrink-0" />
            )}
            {q.hint}
          </p>
        )}
      </div>
      {q.kind === "scale" && (
        <ScaleInput
          q={q}
          value={typeof v === "number" ? v : null}
          onChange={(n) => setAnswer(q.key, n)}
        />
      )}
      {q.kind === "multi" && (
        <MultiInput
          q={q}
          value={Array.isArray(v) ? v : []}
          onChange={(arr) => setAnswer(q.key, arr)}
        />
      )}
      {q.kind === "choice" && (
        <ChoiceInput
          q={q}
          value={typeof v === "string" ? v : null}
          onChange={(s) => setAnswer(q.key, s)}
        />
      )}
      {q.kind === "text" && (
        <TextInput
          q={q}
          value={typeof v === "string" ? v : ""}
          onChange={(s) => setAnswer(q.key, s)}
        />
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────
export default function SurveyClient() {
  const [info, setInfo] = useState<MySurvey | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [anonymous, setAnonymous] = useState(false);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [editing, setEditing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSubmitted, setJustSubmitted] = useState(false);

  // Load my survey + restore a local draft (draft only when nothing submitted yet).
  useEffect(() => {
    getMySurvey().then((res) => {
      if ("error" in res) {
        setLoadError(res.error);
        return;
      }
      setInfo(res);
      setAnonymous(res.anonymous);
      if (res.submitted) {
        setAnswers(res.answers);
        return;
      }
      try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const draft = JSON.parse(raw) as {
            answers?: SurveyAnswers;
            anonymous?: boolean;
            step?: number;
          };
          if (draft.answers) setAnswers(draft.answers);
          if (typeof draft.anonymous === "boolean") setAnonymous(draft.anonymous);
          if (typeof draft.step === "number") setStep(draft.step);
        }
      } catch {
        /* ignore */
      }
    });
  }, []);

  // Autosave the draft so a closed tab doesn't lose ten minutes of typing.
  useEffect(() => {
    if (!info || info.submitted) return;
    try {
      localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({ answers, anonymous, step })
      );
    } catch {
      /* ignore */
    }
  }, [answers, anonymous, step, info]);

  const setAnswer = useCallback((key: string, v: number | string | string[] | null) => {
    setAnswers((prev) => ({ ...prev, [key]: v }));
    setError(null);
  }, []);

  const sections = SURVEY_SECTIONS;
  const section = sections[step];
  const last = step === sections.length - 1;
  const progress = ((step + 1) / sections.length) * 100;

  const missingInStep = useMemo(() => {
    return section.questions.find((q) => {
      if (!q.required) return false;
      const v = answers[q.key];
      return v === undefined || v === null || v === "";
    });
  }, [section, answers]);

  function next() {
    if (missingInStep) {
      setError(`Please answer: ${missingInStep.label}`);
      return;
    }
    setError(null);
    setDirection(1);
    setStep((s) => Math.min(s + 1, sections.length - 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function prev() {
    setError(null);
    setDirection(-1);
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    if (missingInStep) {
      setError(`Please answer: ${missingInStep.label}`);
      return;
    }
    setSubmitting(true);
    setError(null);
    // Normalise empty strings to null so the server sees a clean payload.
    const payload: SurveyAnswers = {};
    for (const [k, v] of Object.entries(answers)) {
      payload[k] = v === "" ? null : v;
    }
    const res = await submitSurvey({ answers: payload, anonymous });
    setSubmitting(false);
    if ("error" in res) {
      setError(res.error);
      return;
    }
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
    setJustSubmitted(true);
    setEditing(false);
    toast.success(res.firstTime ? "Survey submitted. Thank you!" : "Answers updated.");
    const fresh = await getMySurvey();
    if (!("error" in fresh)) setInfo(fresh);
  }

  // ── States ──────────────────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="mx-auto max-w-xl">
        <Card className="glass-card border-0">
          <CardContent className="py-10 text-center text-sand-400">
            {loadError}
          </CardContent>
        </Card>
      </div>
    );
  }
  if (!info) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-pink-400" />
      </div>
    );
  }

  const header = (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6"
    >
      <h1 className="text-3xl font-bold text-sand-100">
        NODE {SURVEY_YEAR} Post-Burn Survey
      </h1>
      <p className="mt-1 text-sand-400">
        Five minutes. Every answer shapes 2027.
      </p>
    </motion.div>
  );

  if (!info.eligible) {
    return (
      <div className="mx-auto max-w-xl">
        {header}
        <Card className="glass-card border-0">
          <CardContent className="flex items-start gap-3 py-8 text-sand-300">
            <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-sand-500" />
            <p>
              This survey is for confirmed NODE {SURVEY_YEAR} campers. If you
              camped with us and are seeing this, ping an admin.
            </p>
          </CardContent>
        </Card>
        {info.isAdmin && <ResultsLink />}
      </div>
    );
  }

  if (!info.open) {
    return (
      <div className="mx-auto max-w-xl">
        {header}
        <Card className="glass-card border-0">
          <CardContent className="py-8 text-sand-300">
            The survey opens once the burn starts. Go pack.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Submitted + not editing → thank-you / summary state.
  if (info.submitted && !editing) {
    return (
      <div className="mx-auto max-w-xl">
        {header}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <Card className="glass-card border-0">
            <CardContent className="space-y-5 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-green-500/15 ring-1 ring-green-500/40">
                  <CheckCircle2 className="h-6 w-6 text-green-400" />
                </span>
                <div>
                  <p className="text-lg font-semibold text-sand-100">
                    {justSubmitted ? "Thank you. Seriously." : "You're done."}
                  </p>
                  <p className="text-sm text-sand-400">
                    Submitted{" "}
                    {info.submittedAt
                      ? new Date(info.submittedAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })
                      : ""}
                    {info.anonymous ? " · anonymous" : ""}
                  </p>
                </div>
              </div>
              <ProgressPulse responded={info.responded} confirmed={info.confirmed} />
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setEditing(true);
                    setStep(0);
                    setJustSubmitted(false);
                  }}
                  className="text-sand-300 hover:text-sand-100"
                >
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit my answers
                </Button>
                <Button asChild variant="ghost" className="text-sand-300 hover:text-sand-100">
                  <Link href="/dashboard">Back to dashboard</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        {info.isAdmin && <ResultsLink />}
      </div>
    );
  }

  const Icon = SECTION_ICONS[step] ?? Sparkles;

  return (
    <div className="mx-auto max-w-xl">
      {header}

      {/* Progress */}
      <div className="glass-card mb-6 rounded-2xl p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between text-sm">
          <span className="text-sand-400">
            Step {step + 1} of {sections.length}
          </span>
          <span className="text-pink-400">{section.title}</span>
        </div>
        <Progress value={progress} className="h-2 bg-blue-900/50" />
        <div className="mt-4 flex justify-between">
          {sections.map((s, i) => {
            const SIcon = SECTION_ICONS[i] ?? Sparkles;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => {
                  if (i < step) {
                    setDirection(-1);
                    setStep(i);
                  }
                }}
                aria-label={s.title}
                className={`flex h-7 w-7 items-center justify-center rounded-full text-xs transition-colors sm:h-8 sm:w-8 ${
                  i <= step
                    ? "bg-pink-500/20 text-pink-400"
                    : "bg-blue-900/30 text-sand-500"
                }`}
              >
                <SIcon className="h-3.5 w-3.5" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Section */}
      <div className="glass-card relative overflow-hidden rounded-2xl p-5 sm:p-8">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={section.key}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="space-y-7"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-pink-500/15 ring-1 ring-pink-500/30">
                <Icon className="h-5 w-5 text-pink-400" />
              </span>
              <div>
                <h2 className="text-xl font-semibold text-sand-100">
                  {section.title}
                </h2>
                <p className="text-sm text-sand-400">{section.blurb}</p>
              </div>
            </div>

            {section.questions
              .filter((q) => isQuestionVisible(q, answers))
              .map((q) => (
                <QuestionBlock
                  key={q.key}
                  q={q}
                  answers={answers}
                  setAnswer={setAnswer}
                />
              ))}

            {last && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <Switch
                    checked={anonymous}
                    onCheckedChange={setAnonymous}
                    className="mt-0.5 data-[state=checked]:bg-pink-500"
                  />
                  <span>
                    <span className="flex items-center gap-1.5 text-sm font-medium text-sand-100">
                      <EyeOff className="h-4 w-4 text-sand-400" />
                      Submit anonymously
                    </span>
                    <span className="block text-xs text-sand-500">
                      Your name won&apos;t be shown with your answers in the
                      results admins see.
                    </span>
                  </span>
                </label>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="mt-6 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={editing && step === 0 ? () => setEditing(false) : prev}
          disabled={(!editing && step === 0) || submitting}
          className="text-sand-300 hover:text-sand-100"
        >
          {editing && step === 0 ? "Cancel" : "Back"}
        </Button>
        <Button
          onClick={last ? handleSubmit : next}
          disabled={submitting}
          className="rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink"
        >
          {submitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : last ? (
            info.submitted ? "Save changes" : "Submit survey"
          ) : (
            "Continue"
          )}
        </Button>
      </div>

      <p className="mt-6 text-center text-xs text-sand-600">
        Answers save as a draft on this device until you submit.
      </p>
    </div>
  );
}

function ProgressPulse({
  responded,
  confirmed,
}: {
  responded: number;
  confirmed: number;
}) {
  const pct = confirmed > 0 ? Math.round((responded / confirmed) * 100) : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-sand-400">
        <span>Camp pulse</span>
        <span className="tabular-nums">
          {responded} of {confirmed} campers answered
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-blue-900/50">
        <div
          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-amber transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function ResultsLink() {
  return (
    <div className="mt-4">
      <Button asChild variant="ghost" className="text-amber hover:text-amber-200">
        <Link href="/dashboard/survey/results">
          <BarChart3 className="mr-2 h-4 w-4" />
          View survey results
        </Link>
      </Button>
    </div>
  );
}
