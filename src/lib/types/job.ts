import { z } from "zod";

// ── Admin form schemas ───────────────────────────────────────────────

export const jobDefinitionSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(2000).optional().or(z.literal("")),
  category: z.string().max(60).optional().or(z.literal("")),
  people_required: z.number().int().min(1).max(100),
  duration_min: z.number().int().min(1).max(1440),
  difficulty: z.number().int().min(0).max(10),
  active: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(100000).optional(),
});
export type JobDefinitionFormData = z.infer<typeof jobDefinitionSchema>;

const timeField = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/, "Invalid time");

export const jobShiftSchema = z
  .object({
    definition_id: z.string().uuid(),
    label: z.string().max(120).optional().or(z.literal("")),
    shift_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
    start_time: timeField,
    end_time: timeField.optional().or(z.literal("")),
    capacity: z.number().int().min(1).max(200),
    notes: z.string().max(1000).optional().or(z.literal("")),
  })
  .refine((d) => !(d.end_time && d.end_time <= d.start_time), {
    message: "End time must be after the start time.",
    path: ["end_time"],
  });
export type JobShiftFormData = z.infer<typeof jobShiftSchema>;

export const jobBoardSettingsSchema = z.object({
  // Empty string clears the open date (open immediately, no gating).
  signup_opens_at: z.string().optional().or(z.literal("")),
  early_access_enabled: z.boolean(),
  early_access_years_threshold: z.number().int().min(1).max(20),
  early_access_hours: z.number().int().min(0).max(336),
  points_target: z.number().int().min(0).max(100000),
});
export type JobBoardSettingsFormData = z.infer<typeof jobBoardSettingsSchema>;

// ── Row / view types ─────────────────────────────────────────────────

export interface JobDefinitionRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  people_required: number;
  duration_min: number;
  difficulty: number;
  point_value: number;
  active: boolean;
  sort_order: number;
}

/** A camper signed up on a shift (for the roster). */
export interface ShiftSignup {
  profileId: string;
  name: string;
  isMe: boolean;
}

/** A dated shift with its definition data and live roster, for the board. */
export interface ShiftView {
  id: string;
  definitionId: string;
  title: string;
  category: string | null;
  description: string | null;
  label: string | null;
  shiftDate: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string | null;
  capacity: number;
  pointValue: number;
  signups: ShiftSignup[];
  filled: number;
  isFull: boolean;
  mine: boolean;
}

export interface LeaderboardEntry {
  profileId: string;
  name: string;
  totalPoints: number;
  shiftCount: number;
  isMe: boolean;
  rank: number;
}

export interface JobBoardSettings {
  signupOpensAt: string | null;
  earlyAccessEnabled: boolean;
  earlyAccessYearsThreshold: number;
  earlyAccessHours: number;
  pointsTarget: number;
}

/** When the current member's signups open (resolved against their tenure). */
export interface SignupWindow {
  /** True once the member may sign up right now. */
  open: boolean;
  /** ISO instant the member's window opens, or null if always open. */
  opensAt: string | null;
  /** True if the member qualifies for the senior early-access head start. */
  earlyAccess: boolean;
}

export interface MyJobProgress {
  totalPoints: number;
  shiftCount: number;
  pointsTarget: number; // 0 = no target
  /** True when the soft target is met (or there is no target but ≥1 shift). */
  onTrack: boolean;
}
