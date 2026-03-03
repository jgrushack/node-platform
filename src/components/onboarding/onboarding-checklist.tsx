"use client";

import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Circle, ChevronRight, Loader2, MapPin, User, CalendarDays } from "lucide-react";
import { getOnboardingStatus, completeOnboarding } from "@/lib/actions/onboarding";
import type { OnboardingStatus } from "@/lib/actions/onboarding";
import { respondToNodeYearExtended, respondToPrebuild } from "@/lib/actions/registrations";
import Link from "next/link";

interface OnboardingChecklistProps {
  onStatusChange?: () => void;
  onComplete?: () => void;
}

type Step1Phase = "initial" | "followup";

export function OnboardingChecklist({ onStatusChange, onComplete }: OnboardingChecklistProps) {
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [step1Phase, setStep1Phase] = useState<Step1Phase>("initial");
  const [dismissed, setDismissed] = useState(false);

  const fetchStatus = useCallback(async () => {
    const result = await getOnboardingStatus();
    if ("data" in result) {
      setStatus(result.data);

      // If all complete and not yet marked, mark it
      if (result.data.allComplete && !result.data.onboardingCompletedAt) {
        await completeOnboarding();
        onComplete?.();
      }
    }
    setLoading(false);
  }, [onComplete]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  if (loading) {
    return (
      <Card className="glass-card border-0">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-sand-400" />
        </CardContent>
      </Card>
    );
  }

  if (!status || status.onboardingCompletedAt || dismissed) {
    return null;
  }

  // If everything just completed, dismiss
  if (status.allComplete) {
    return null;
  }

  const completedCount = [
    status.step1.complete,
    status.step2.complete,
    status.step3.visible ? status.step3.complete : null,
  ].filter((v) => v === true).length;

  const totalSteps = status.step3.visible || !status.step1.complete ? 3 : 2;

  // Determine which step is active
  const activeStep = !status.step1.complete ? 1 : !status.step2.complete ? 2 : 3;

  async function handleStep1Yes() {
    setActionLoading("step1-yes");
    const result = await respondToNodeYearExtended("yes");
    setActionLoading(null);
    if ("success" in result) {
      onStatusChange?.();
      await fetchStatus();
    }
  }

  async function handleStep1No() {
    // Show follow-up question
    setStep1Phase("followup");
  }

  async function handleStayActive(stayActive: boolean) {
    setActionLoading(stayActive ? "stay-active" : "deactivate");
    const result = await respondToNodeYearExtended("no", stayActive);
    setActionLoading(null);
    if ("success" in result) {
      onStatusChange?.();
      await fetchStatus();
    }
  }

  async function handlePrebuild(response: "yes" | "no" | "maybe") {
    setActionLoading(`prebuild-${response}`);
    const result = await respondToPrebuild(response);
    setActionLoading(null);
    if ("success" in result) {
      onStatusChange?.();
      await fetchStatus();
    }
  }

  const fieldLabels: Record<string, string> = {
    first_name: "First Name",
    last_name: "Last Name",
    phone: "Phone",
    dietary_restrictions: "Dietary Restrictions",
    emergency_contact: "Emergency Contact",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
    >
      <Card className="glass-card border-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-amber/5 to-pink-500/5" />
        <CardContent className="relative py-6 px-6 sm:px-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-sand-100">
                Getting Started
              </h2>
              <p className="text-sm text-sand-400 mt-0.5">
                {completedCount} of {totalSteps} complete
              </p>
            </div>
            {/* Progress dots */}
            <div className="flex gap-1.5">
              {Array.from({ length: totalSteps }).map((_, i) => {
                const stepNum = i + 1;
                const isComplete =
                  stepNum === 1
                    ? status.step1.complete
                    : stepNum === 2
                      ? status.step2.complete
                      : status.step3.complete;
                return (
                  <div
                    key={i}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      isComplete
                        ? "bg-green-400"
                        : stepNum === activeStep
                          ? "bg-pink-400"
                          : "bg-sand-700"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Steps */}
          <div className="space-y-3">
            {/* Step 1: Are you attending NODE 2026? */}
            <StepRow
              stepNumber={1}
              title="Are you attending NODE 2026?"
              complete={status.step1.complete}
              active={activeStep === 1}
              completeSummary={
                status.step1.attending
                  ? "Attending NODE 2026"
                  : status.step1.isActive
                    ? "Not attending — staying active"
                    : "Not attending — deactivated"
              }
              icon={<MapPin className="h-4 w-4" />}
            >
              <AnimatePresence mode="wait">
                {step1Phase === "initial" ? (
                  <motion.div
                    key="initial"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-wrap gap-3"
                  >
                    <Button
                      onClick={handleStep1Yes}
                      disabled={actionLoading !== null}
                      className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/20 hover:border-green-500/30"
                    >
                      {actionLoading === "step1-yes" ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : null}
                      {actionLoading === "step1-yes" ? "Saving..." : "Yes, I'm in!"}
                    </Button>
                    <Button
                      onClick={handleStep1No}
                      disabled={actionLoading !== null}
                      variant="ghost"
                      className="text-sand-400 hover:text-sand-200 hover:bg-sand-700/20"
                    >
                      No, not this year
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="followup"
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="space-y-3"
                  >
                    <p className="text-sm text-sand-300">
                      Do you want to stay as an Active Member?
                    </p>
                    <p className="text-xs text-sand-500">
                      Active members stay in the directory, receive updates, and won&apos;t need to re-apply.
                    </p>
                    <div className="flex flex-wrap gap-3">
                      <Button
                        onClick={() => handleStayActive(true)}
                        disabled={actionLoading !== null}
                        className="bg-amber/20 hover:bg-amber/30 text-amber border border-amber/20 hover:border-amber/30"
                      >
                        {actionLoading === "stay-active" ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : null}
                        {actionLoading === "stay-active" ? "Saving..." : "Yes, keep me active"}
                      </Button>
                      <Button
                        onClick={() => handleStayActive(false)}
                        disabled={actionLoading !== null}
                        variant="ghost"
                        className="text-sand-500 hover:text-sand-300 hover:bg-sand-700/20"
                      >
                        {actionLoading === "deactivate" ? "Saving..." : "No, deactivate me"}
                      </Button>
                      <Button
                        onClick={() => setStep1Phase("initial")}
                        disabled={actionLoading !== null}
                        variant="ghost"
                        className="text-sand-600 hover:text-sand-400 text-xs"
                      >
                        Back
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </StepRow>

            {/* Step 2: Complete Your Profile */}
            <StepRow
              stepNumber={2}
              title="Complete Your Profile"
              complete={status.step2.complete}
              active={activeStep === 2}
              completeSummary="Profile complete"
              icon={<User className="h-4 w-4" />}
              dimmed={!status.step1.complete}
            >
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {status.step2.missingFields.map((field) => (
                    <span
                      key={field}
                      className="inline-flex items-center gap-1 rounded-full bg-sand-700/30 px-2.5 py-0.5 text-xs text-sand-400"
                    >
                      <Circle className="h-2 w-2 text-coral" />
                      {fieldLabels[field] || field}
                    </span>
                  ))}
                </div>
                <Link href="/dashboard/profile?onboarding=1">
                  <Button
                    variant="outline"
                    className="border-pink-500/20 text-pink-400 hover:bg-pink-500/10"
                  >
                    Complete Profile
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </StepRow>

            {/* Step 3: Prebuild RSVP */}
            {(status.step3.visible || !status.step1.complete) && (
              <StepRow
                stepNumber={3}
                title="Can you attend Reno Prebuild 2026 (May 15-17)?"
                complete={status.step3.complete && status.step3.visible}
                active={activeStep === 3}
                completeSummary={
                  status.step3.prebuildResponse === "yes"
                    ? "Attending prebuild"
                    : status.step3.prebuildResponse === "maybe"
                      ? "Maybe attending prebuild"
                      : "Not attending prebuild"
                }
                icon={<CalendarDays className="h-4 w-4" />}
                dimmed={!status.step1.complete || !status.step2.complete}
              >
                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => handlePrebuild("yes")}
                    disabled={actionLoading !== null}
                    className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/20 hover:border-green-500/30"
                  >
                    {actionLoading === "prebuild-yes" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Yes
                  </Button>
                  <Button
                    onClick={() => handlePrebuild("maybe")}
                    disabled={actionLoading !== null}
                    variant="ghost"
                    className="text-sand-400 hover:text-sand-200 hover:bg-sand-700/20"
                  >
                    {actionLoading === "prebuild-maybe" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    Maybe
                  </Button>
                  <Button
                    onClick={() => handlePrebuild("no")}
                    disabled={actionLoading !== null}
                    variant="ghost"
                    className="text-sand-500 hover:text-sand-300 hover:bg-sand-700/20"
                  >
                    {actionLoading === "prebuild-no" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : null}
                    No
                  </Button>
                </div>
              </StepRow>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StepRow({
  stepNumber,
  title,
  complete,
  active,
  completeSummary,
  icon,
  dimmed,
  children,
}: {
  stepNumber: number;
  title: string;
  complete: boolean;
  active: boolean;
  completeSummary: string;
  icon: React.ReactNode;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 transition-colors ${
        complete
          ? "border-green-500/10 bg-green-500/5"
          : active
            ? "border-pink-500/15 bg-pink-500/5"
            : "border-sand-700/20 bg-sand-800/10"
      } ${dimmed && !complete ? "opacity-50 pointer-events-none" : ""}`}
    >
      <div className="flex items-center gap-3">
        {/* Step indicator */}
        <div
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium ${
            complete
              ? "bg-green-500/20 text-green-400"
              : active
                ? "bg-pink-500/20 text-pink-400"
                : "bg-sand-700/30 text-sand-500"
          }`}
        >
          {complete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
        </div>

        {/* Icon + Title */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className={complete ? "text-green-400/60" : active ? "text-pink-400" : "text-sand-500"}>
            {icon}
          </span>
          <span
            className={`text-sm font-medium ${
              complete ? "text-sand-400" : "text-sand-200"
            }`}
          >
            {complete ? completeSummary : title}
          </span>
        </div>
      </div>

      {/* Expanded content for active step */}
      <AnimatePresence>
        {active && !complete && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-3 pl-10">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
