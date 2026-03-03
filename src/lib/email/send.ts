import { resend, FROM_EMAIL } from "./resend";
import { existingMemberInviteEmail } from "./templates/existing-member-invite";
import { approvedApplicantEmail } from "./templates/approved-applicant";

export async function sendExistingMemberInvite({
  email,
  firstName,
  magicLink,
}: {
  email: string;
  firstName: string;
  magicLink: string;
}): Promise<{ success: true } | { error: string }> {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "Welcome to the NODE Portal",
    html: existingMemberInviteEmail({ firstName, magicLink }),
  });

  if (error) {
    console.error("[sendExistingMemberInvite]", error);
    return { error: error.message };
  }

  return { success: true };
}

export async function sendApprovedApplicantEmail({
  email,
  firstName,
  magicLink,
}: {
  email: string;
  firstName: string;
  magicLink: string;
}): Promise<{ success: true } | { error: string }> {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: email,
    subject: "You're In — Welcome to NODE 2026",
    html: approvedApplicantEmail({ firstName, magicLink }),
  });

  if (error) {
    console.error("[sendApprovedApplicantEmail]", error);
    return { error: error.message };
  }

  return { success: true };
}
