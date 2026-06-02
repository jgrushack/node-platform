export function calendarInviteEmail({
  firstName,
  title,
  whenLabel,
  description,
  joinLink,
  siteUrl,
  webcalUrl,
}: {
  firstName: string;
  title: string;
  whenLabel: string;
  description?: string | null;
  joinLink?: string | null;
  siteUrl: string;
  webcalUrl: string;
}): string {
  const safeDescription = (description ?? "").trim();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#0F0120;font-family:'Exo 2',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F0120;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:32px 32px 16px;background-color:#0F0120;border-radius:16px 16px 0 0;">
              <p style="margin:0;font-size:18px;font-weight:700;letter-spacing:4px;color:#F9EDD8;text-transform:uppercase;">NODE 2026</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;background-color:#1a0a2e;border-left:1px solid rgba(249,0,119,0.2);border-right:1px solid rgba(249,0,119,0.2);">
              <p style="margin:0 0 16px;font-size:16px;color:#F9EDD8;">Hey ${firstName},</p>
              <p style="margin:0 0 24px;font-size:16px;color:#F9EDD8;line-height:1.6;">
                You&rsquo;re invited to a NODE event. The calendar invite is attached &mdash; tap it from your email app to add it to your calendar and RSVP.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;background-color:rgba(249,0,119,0.08);border:1px solid rgba(249,0,119,0.2);border-radius:12px;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#F9EDD8;">${title}</p>
                    <p style="margin:0 0 8px;font-size:14px;color:#F9EDD8;opacity:0.8;">${whenLabel}</p>
                    ${safeDescription ? `<p style="margin:8px 0 0;font-size:14px;color:#F9EDD8;line-height:1.5;opacity:0.9;">${safeDescription.replace(/\n/g, "<br/>")}</p>` : ""}
                  </td>
                </tr>
              </table>
              ${joinLink ? `
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(135deg,#F90077,#FF3399,#FFB800);">
                    <a href="${joinLink}" target="_blank" style="display:inline-block;padding:14px 36px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:1px;">
                      Join the Call
                    </a>
                  </td>
                </tr>
              </table>` : ""}
              <p style="margin:24px 0 0;font-size:13px;color:#F9EDD8;opacity:0.6;line-height:1.6;">
                Want every NODE event automatically? <a href="${webcalUrl}" style="color:#FF99CC;text-decoration:underline;">Subscribe to the NODE calendar</a> &mdash; new events show up in your calendar app as we add them.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px;background-color:#0F0120;border-top:1px solid rgba(249,0,119,0.3);border-radius:0 0 16px 16px;">
              <p style="margin:0;font-size:12px;color:#F9EDD8;text-align:center;opacity:0.5;line-height:1.6;">
                <a href="${siteUrl}/dashboard/calendar" style="color:#F9EDD8;text-decoration:underline;opacity:0.7;">Open the dashboard calendar</a>
                &nbsp;&middot;&nbsp;
                You received this email because you&rsquo;re a confirmed NODE 2026 member.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
