"use server";

import { createClient } from "@/lib/supabase/server";

const REQUIRED_PROFILE_FIELDS = [
  "first_name",
  "last_name",
  "phone",
  "dietary_restrictions",
  "emergency_contact",
] as const;

export type OnboardingStatus = {
  step1: {
    complete: boolean;
    attending: boolean | null;
    isActive: boolean;
    registrationStatus: string | null;
  };
  step2: {
    complete: boolean;
    missingFields: string[];
  };
  step3: {
    complete: boolean;
    prebuildResponse: string | null;
    visible: boolean; // hidden if deactivated
  };
  allComplete: boolean;
  onboardingCompletedAt: string | null;
};

export async function getOnboardingStatus(): Promise<
  { data: OnboardingStatus } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Fetch profile
  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "first_name, last_name, phone, dietary_restrictions, emergency_contact, is_active, onboarding_completed_at"
    )
    .eq("id", user.id)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  // Fetch 2026 registration
  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();

  let registrationStatus: string | null = null;
  let prebuildResponse: string | null = null;

  if (campYear) {
    const { data: reg } = await supabase
      .from("registrations")
      .select("status, prebuild_rsvp")
      .eq("profile_id", user.id)
      .eq("camp_year_id", campYear.id)
      .maybeSingle();

    if (reg) {
      registrationStatus = reg.status;
      prebuildResponse = reg.prebuild_rsvp;
    }
  }

  // Step 1: Has the user responded to the 2026 question?
  const step1Complete =
    registrationStatus === "confirmed" || registrationStatus === "cancelled";
  const attending = registrationStatus === "confirmed";
  const isActive = profile.is_active !== false; // default true

  // Step 2: Are required profile fields filled?
  const missingFields: string[] = [];
  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = profile[field];
    if (!value || (typeof value === "string" && value.trim() === "")) {
      missingFields.push(field);
    }
  }
  const step2Complete = missingFields.length === 0;

  // Step 3: Prebuild RSVP — visible only if attending or active member
  const step3Visible = attending || (step1Complete && !attending && isActive);
  const step3Complete = step3Visible ? prebuildResponse !== null : true;

  const allComplete = step1Complete && step2Complete && step3Complete;

  return {
    data: {
      step1: {
        complete: step1Complete,
        attending: step1Complete ? attending : null,
        isActive,
        registrationStatus,
      },
      step2: {
        complete: step2Complete,
        missingFields,
      },
      step3: {
        complete: step3Complete,
        prebuildResponse,
        visible: step3Visible,
      },
      allComplete,
      onboardingCompletedAt: profile.onboarding_completed_at,
    },
  };
}

export async function completeOnboarding(): Promise<
  { success: true } | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Validate all steps are done server-side
  const status = await getOnboardingStatus();
  if ("error" in status) {
    return { error: status.error };
  }

  if (!status.data.allComplete) {
    return { error: "Not all onboarding steps are complete" };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
