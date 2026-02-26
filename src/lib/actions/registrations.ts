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
