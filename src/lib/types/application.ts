import { z } from "zod";

export const applicationSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email("Valid email is required").max(254),
  phone: z.string().max(20).optional(),
  playaName: z.string().max(100).optional(),
  yearsAttended: z.string().min(1, "Please select your experience level"),
  previousCamps: z.string().max(2000).optional(),
  favoritePrinciple: z.string().max(200).optional(),
  principleReason: z.string().max(2000).optional(),
  skills: z.string().max(2000).optional(),
  referredBy: z.string().max(200).optional(),
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

export interface ApplicationComment {
  id: string;
  application_id: string;
  author_id: string;
  body: string;
  created_at: string;
  author: {
    first_name: string | null;
    last_name: string | null;
    playa_name: string | null;
    email: string;
  };
}

export type VoteValue = "yes" | "no" | "waitlist";

export interface ApplicationVote {
  id: string;
  application_id: string;
  voter_id: string;
  vote: VoteValue;
  created_at: string;
  voter: {
    first_name: string | null;
    last_name: string | null;
    playa_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}

export interface VoteSummary {
  yes: number;
  no: number;
  waitlist: number;
}

export interface ApplicationWithVotes extends ApplicationRow {
  votes: ApplicationVote[];
  vote_summary: VoteSummary;
  current_user_vote: VoteValue | null;
}

export interface CommitteeRequest {
  id: string;
  profile_id: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface ApplicationSummaryData {
  pendingCount: number;
  approvedCount: number;
  slotsRemaining: number;
}
