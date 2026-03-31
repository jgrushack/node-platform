"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const yesNoSchema = z.enum(["yes", "no"]);
const prebuildSchema = z.enum(["yes", "no", "maybe"]);


export async function respondToNodeYearExtended(
  response: "yes" | "no",
  stayActive?: boolean
) {
  const parsed = yesNoSchema.safeParse(response);
  if (!parsed.success) return { error: "Invalid response." };

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
  const parsed = prebuildSchema.safeParse(response);
  if (!parsed.success) return { error: "Invalid response." };

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

export async function updateTicketAndCarPass(
  hasTicket: boolean,
  carPass: "yes" | "no" | "need_ride" | "burner_express"
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
    .update({ has_ticket: hasTicket, has_car_pass: carPass })
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
