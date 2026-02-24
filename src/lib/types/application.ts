import { z } from "zod";

export const applicationSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phone: z.string().optional(),
  playaName: z.string().optional(),
  yearsAttended: z.string().min(1, "Please select your experience level"),
  previousCamps: z.string().optional(),
  favoritePrinciple: z.string().optional(),
  principleReason: z.string().optional(),
  skills: z.string().optional(),
  referredBy: z.string().optional(),
});

export type ApplicationFormData = z.infer<typeof applicationSchema>;

export interface ApplicationRow {
  id: string;
  camp_year_id: string | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  playa_name: string | null;
  years_attended: string | null;
  previous_camps: string | null;
  favorite_principle: string | null;
  principle_reason: string | null;
  skills: string | null;
  referred_by: string | null;
  video_url: string | null;
  status: "pending" | "approved" | "rejected" | "waitlist";
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
}
