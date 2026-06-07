import { z } from "zod";

const timeField = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time")
  .optional()
  .or(z.literal(""));

export const nodeEventSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200),
    event_type: z.enum(["call", "event", "deadline"]),
    event_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    start_time: timeField,
    end_time: timeField,
    // Require http(s) so the value is always emittable into the ICS feed
    // (sanitizeUri there only allows http/https); surfaced at input, not dropped.
    join_link: z
      .string()
      .url("Must be a valid URL")
      .refine((v) => /^https?:\/\//i.test(v), "Join link must start with http:// or https://")
      .optional()
      .or(z.literal("")),
    description: z.string().max(2000).optional(),
  })
  // An end time without a start time is meaningless (the ICS layer ignores it).
  .refine((d) => !(d.end_time && !d.start_time), {
    message: "Set a start time when you set an end time.",
    path: ["start_time"],
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
  invites_sent_at: string | null;
  google_event_id?: string | null;
  google_html_link?: string | null;
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
  invites_sent_at?: string | null;
}
