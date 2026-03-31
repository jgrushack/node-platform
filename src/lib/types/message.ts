import { z } from "zod";

export const audienceFilterSchema = z.object({
  type: z.enum(["all", "custom", "filtered"]),
  // For "custom" — hand-picked profile IDs
  profile_ids: z.array(z.string().uuid()).optional(),
  // For "filtered" — combinable criteria (AND-ed together)
  registration_years: z.array(z.number().int().min(2017).max(2030)).optional(),
  roles: z.array(z.enum(["lead", "admin", "super_admin"])).optional(),
  is_committee_member: z.boolean().optional(),
  is_build_crew: z.boolean().optional(),
  tenure: z.enum(["og", "veteran", "first_year"]).optional(),
  onboarding_incomplete: z.boolean().optional(),
  // Standing gate
  include_reapply: z.boolean().optional(),
  include_limited_referrals: z.boolean().optional(),
  // not_invited_back is ALWAYS excluded — no toggle
});

export type AudienceFilter = z.infer<typeof audienceFilterSchema>;

export const composeMessageSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(200),
  body_html: z.string().min(1, "Message body is required"),
  audience_filter: audienceFilterSchema,
});

export type ComposeMessageData = z.infer<typeof composeMessageSchema>;

export interface CampMessage {
  id: string;
  subject: string;
  body_html: string;
  audience_filter: AudienceFilter;
  sent_by: string;
  recipient_count: number;
  sent_at: string;
  created_at: string;
  sender?: {
    first_name: string | null;
    last_name: string | null;
    playa_name: string | null;
    email: string;
  };
}

export interface MessageRecipient {
  id: string;
  message_id: string;
  profile_id: string;
  email_sent: boolean;
  read_at: string | null;
  created_at: string;
}

export interface UnreadMessage {
  id: string;
  message_id: string;
  subject: string;
  body_html: string;
  sent_at: string;
  sender_name: string;
  read_at?: string | null;
}

export interface RecipientPreview {
  id: string;
  first_name: string | null;
  last_name: string | null;
  playa_name: string | null;
  email: string;
}
