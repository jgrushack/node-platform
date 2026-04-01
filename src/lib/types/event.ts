import { z } from "zod";

export const nodeEventSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  event_type: z.enum(["call", "event", "deadline"]),
  event_date: z.string().min(1, "Date is required"),
  start_time: z.string().optional(),
  end_time: z.string().optional(),
  join_link: z.string().url("Must be a valid URL").optional().or(z.literal("")),
  description: z.string().max(2000).optional(),
});

export type NodeEventFormData = z.infer<typeof nodeEventSchema>;

export interface NodeEventRow {
  id: string;
  camp_year_id: string;
  title: string;
  description: string | null;
  event_type: "call" | "event" | "deadline";
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  join_link: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CalendarDayEvent {
  id: string;
  title: string;
  event_type: "call" | "event" | "deadline" | "bm";
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  join_link: string | null;
  description: string | null;
  created_by?: string;
}
