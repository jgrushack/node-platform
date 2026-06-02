import { resend, FROM_EMAIL, REPLY_TO_EMAIL } from "./resend";
import { existingMemberInviteEmail } from "./templates/existing-member-invite";
import { approvedApplicantEmail } from "./templates/approved-applicant";
import { campMessageEmail } from "./templates/camp-message";
import { calendarInviteEmail } from "./templates/calendar-invite";
import { buildInviteIcs, type IcsEvent, type IcsOrganizer } from "@/lib/calendar/ics";

/** Strip HTML tags and decode entities into plain text for email fallback. */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rsquo;/g, "\u2019")
    .replace(/&lsquo;/g, "\u2018")
    .replace(/&rdquo;/g, "\u201D")
    .replace(/&ldquo;/g, "\u201C")
    .replace(/&mdash;/g, "\u2014")
    .replace(/&ndash;/g, "\u2013")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function sendExistingMemberInvite({
  email,
  firstName,
  magicLink,
}: {
  email: string;
  firstName: string;
  magicLink: string;
}): Promise<{ success: true } | { error: string }> {
  const html = existingMemberInviteEmail({ firstName, magicLink });
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: email,
    subject: "Welcome to the NODE Portal",
    html,
    text: htmlToPlainText(html),
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
  const html = approvedApplicantEmail({ firstName, magicLink });
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    replyTo: REPLY_TO_EMAIL,
    to: email,
    subject: "You're In — Welcome to NODE 2026",
    html,
    text: htmlToPlainText(html),
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
  recipients: { email: string; profileId?: string }[];
  subject: string;
  bodyHtml: string;
}): Promise<{ sent: number; failed: number; sentProfileIds: string[] }> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://nodev0.vercel.app";
  let sent = 0;
  let failed = 0;
  // Track which recipients actually went out so callers only mark those as
  // emailed (a failed batch must not be recorded as delivered).
  const sentProfileIds: string[] = [];

  // Resend batch supports up to 100 emails per call
  const BATCH_SIZE = 100;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => {
      const html = campMessageEmail({
        subject,
        bodyHtml,
        siteUrl,
      });
      return {
        from: FROM_EMAIL,
        replyTo: REPLY_TO_EMAIL,
        to: r.email,
        subject,
        html,
        text: htmlToPlainText(html),
      };
    });

    const { error } = await resend.batch.send(emails);
    if (error) {
      console.error("[sendCampMessageBatch]", error);
      failed += batch.length;
    } else {
      sent += batch.length;
      for (const r of batch) {
        if (r.profileId) sentProfileIds.push(r.profileId);
      }
    }
  }

  return { sent, failed, sentProfileIds };
}

export async function sendEventInviteBatch({
  recipients,
  event,
  organizer,
  whenLabel,
  siteUrl,
  webcalUrl,
}: {
  recipients: { email: string; firstName: string }[];
  event: IcsEvent;
  organizer: IcsOrganizer;
  whenLabel: string;
  siteUrl: string;
  webcalUrl: string;
}): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const subject = `NODE: ${event.title}`;

  // Each recipient gets a personalized ICS (ATTENDEE line is per-recipient),
  // so we can't share an attachment across the batch.
  const BATCH_SIZE = 100;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);
    const emails = batch.map((r) => {
      const ics = buildInviteIcs(event, organizer, {
        email: r.email,
        name: r.firstName,
      });
      const html = calendarInviteEmail({
        firstName: r.firstName,
        title: event.title,
        whenLabel,
        description: event.description,
        joinLink: event.url,
        siteUrl,
        webcalUrl,
      });
      return {
        from: FROM_EMAIL,
        replyTo: REPLY_TO_EMAIL,
        to: r.email,
        subject,
        html,
        text: htmlToPlainText(html),
        attachments: [
          {
            filename: "invite.ics",
            content: Buffer.from(ics, "utf-8"),
            contentType: "text/calendar; method=REQUEST; charset=utf-8",
          },
        ],
      };
    });

    const { error } = await resend.batch.send(emails);
    if (error) {
      console.error("[sendEventInviteBatch]", error);
      failed += batch.length;
    } else {
      sent += batch.length;
    }
  }

  return { sent, failed };
}
