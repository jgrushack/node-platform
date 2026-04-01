import { getNodeEvents } from "@/lib/actions/events";
import { getCurrentUserRole, getCurrentUserId } from "@/lib/actions/applications";
import { CalendarClient } from "./calendar-client";
import type { CalendarDayEvent } from "@/lib/types/event";
import { bmCalendarEvents } from "@/lib/data/bm-calendar";

export default async function CalendarPage() {
  const [eventsResult, role, userId] = await Promise.all([
    getNodeEvents(),
    getCurrentUserRole(),
    getCurrentUserId(),
  ]);

  const nodeEvents: CalendarDayEvent[] =
    "error" in eventsResult
      ? []
      : eventsResult.map((e) => ({
          id: e.id,
          title: e.title,
          event_type: e.event_type,
          event_date: e.event_date,
          start_time: e.start_time,
          end_time: e.end_time,
          join_link: e.join_link,
          description: e.description,
          created_by: e.created_by,
        }));

  // BM calendar events visible to admin/super_admin only
  const bmEvents: CalendarDayEvent[] =
    role === "admin" || role === "super_admin"
      ? bmCalendarEvents.map((e, i) => ({
          id: `bm-${i}`,
          title: e.title,
          event_type: "bm" as const,
          event_date: e.start,
          start_time: null,
          end_time: null,
          join_link: null,
          description: e.end ? `Through ${e.end}` : null,
        }))
      : [];

  const allEvents = [...nodeEvents, ...bmEvents];

  return (
    <CalendarClient
      events={allEvents}
      userRole={role ?? "member"}
      userId={userId ?? ""}
    />
  );
}
