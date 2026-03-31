import { resend, FROM_EMAIL } from "./resend";
import { existingMemberInviteEmail } from "./templates/existing-member-invite";
import { approvedApplicantEmail } from "./templates/approved-applicant";
import { campMessageEmail } from "./templates/camp-message";

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

export async function sendCampMessageBatch({
  recipients,
  subject,
  bodyHtml,
}: {
  recipients: { email: string; firstName: string }[];
  subject: string;
  bodyHtml: string;
}): Promise<{ sent: number; failed: number }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nodev0.vercel.app";
  let sent = 0;
  let failed = 0;

  // Resend batch supports up to 100 emails per call
  const BATCH_SIZE = 100;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => ({
      from: FROM_EMAIL,
      to: r.email,
      subject,
      html: campMessageEmail({
        firstName: r.firstName,
        subject,
        bodyHtml,
        siteUrl,
      }),
    }));

    const { error } = await resend.batch.send(emails);
    if (error) {
      console.error("[sendCampMessageBatch]", error);
      failed += batch.length;
    } else {
      sent += batch.length;
    }
  }

  return { sent, failed };
}
