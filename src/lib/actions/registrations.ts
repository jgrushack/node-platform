"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const yesNoSchema = z.enum(["yes", "no"]);
const prebuildSchema = z.enum(["yes", "no", "maybe"]);

// Transport options for the Road to 2026 checklist. Legacy 'yes'/'need_ride'
// are still accepted (migration 00045 keeps them in the CHECK) and mapped on read.
// NOT exported — a "use server" file may only export async functions; the type
// below (CarPassStatus) is what other modules import.
const carPassSchema = z.enum([
  "car_pass_parking",
  "burner_express",
  "ride_sorted",
  "ride_unsorted",
  "other",
  "no",
  // legacy:
  "yes",
  "need_ride",
]);
export type CarPassStatus = z.infer<typeof carPassSchema>;

const arrivalDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a YYYY-MM-DD date.")
  .nullable();


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
  carPass: CarPassStatus
) {
  const parsed = carPassSchema.safeParse(carPass);
  if (!parsed.success) return { error: "Invalid transport option." };

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

export async function updateArrivalDates(
  arrivalDate: string | null,
  departureDate: string | null
) {
  const a = arrivalDateSchema.safeParse(arrivalDate);
  const d = arrivalDateSchema.safeParse(departureDate);
  if (!a.success || !d.success) return { error: "Invalid date." };

  // If both are present, arrival must not be after departure.
  if (arrivalDate && departureDate && arrivalDate > departureDate) {
    return { error: "Arrival can't be after departure." };
  }

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
    .update({ arrival_date: arrivalDate, departure_date: departureDate })
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id);

  if (error) {
    return { error: error.message };
  }

  return { success: true };
}
