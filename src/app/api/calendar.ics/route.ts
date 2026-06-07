import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildFeedIcs } from "@/lib/calendar/ics";
import { REPLY_TO_EMAIL } from "@/lib/email/resend";

export const dynamic = "force-dynamic";
export const revalidate = 300; // hint, even though dynamic

const CAMP_YEAR = 2026;

export async function GET() {
  const adminClient = createAdminClient();

  const { data: campYear } = await adminClient
    .from("camp_years")
    .select("id")
    .eq("year", CAMP_YEAR)
    .single();

  const events = campYear
    ? (
        await adminClient
          .from("node_events")
          .select(
            "id, title, description, event_date, start_time, end_time, join_link, created_at, updated_at"
          )
          .eq("camp_year_id", campYear.id)
          .order("event_date", { ascending: true })
      ).data ?? []
    : [];

  const ics = buildFeedIcs(
    events.map((e) => ({
      uid: `${e.id}@node.family`,
      title: e.title,
      description: e.description,
      date: e.event_date,
      startTime: e.start_time,
      endTime: e.end_time,
      url: e.join_link,
      createdAt: e.created_at,
      updatedAt: e.updated_at,
    })),
    `NODE ${CAMP_YEAR}`,
    { email: REPLY_TO_EMAIL.replace(/^.*<(.+)>.*$/, "$1"), name: "NODE" }
  );

  return new NextResponse(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="node-${CAMP_YEAR}.ics"`,
      "Cache-Control": "public, max-age=300, s-maxage=300",
    },
  });
}
