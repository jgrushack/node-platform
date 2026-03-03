"use server";

import { createClient } from "@/lib/supabase/server";

export async function respondToNodeYear(response: "yes" | "no") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();

  if (!campYear) {
    return { error: "No camp year found for 2026" };
  }

  const status = response === "yes" ? "confirmed" : "cancelled";

  const { error } = await supabase.from("registrations").upsert(
    {
      profile_id: user.id,
      camp_year_id: campYear.id,
      status,
    },
    { onConflict: "profile_id,camp_year_id" }
  );

  if (error) {
    return { error: error.message };
  }

  return { success: true, status };
}

export async function respondToNodeYearExtended(
  response: "yes" | "no",
  stayActive?: boolean
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();

  if (!campYear) {
    return { error: "No camp year found for 2026" };
  }

  const status = response === "yes" ? "confirmed" : "cancelled";

  const { error } = await supabase.from("registrations").upsert(
    {
      profile_id: user.id,
      camp_year_id: campYear.id,
      status,
    },
    { onConflict: "profile_id,camp_year_id" }
  );

  if (error) {
    return { error: error.message };
  }

  // If declining, handle active member preference
  if (response === "no" && stayActive === false) {
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", user.id);

    if (profileError) {
      return { error: profileError.message };
    }
  }

  return { success: true, status, isActive: stayActive !== false };
}

export async function respondToPrebuild(
  response: "yes" | "no" | "maybe"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: campYear } = await supabase
    .from("camp_years")
    .select("id")
    .eq("year", 2026)
    .single();

  if (!campYear) {
    return { error: "No camp year found for 2026" };
  }

  const { error } = await supabase
    .from("registrations")
    .update({ prebuild_rsvp: response })
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
