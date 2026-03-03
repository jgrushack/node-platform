export function approvedApplicantEmail({
  firstName,
  magicLink,
}: {
  firstName: string;
  magicLink: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>You're In — Welcome to NODE 2026</title>
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#0F0120;font-family:'Exo 2',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F0120;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:48px 32px 32px;background:linear-gradient(135deg,#F90077 0%,#FF3399 40%,#FF6B9D 70%,#FFB800 100%);border-radius:16px 16px 0 0;">
              <img src="https://nodev0.vercel.app/email/node-2026-header.png" alt="NODE 2026" width="400" style="display:block;max-width:400px;width:100%;height:auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;background-color:#1a0a2e;border-left:1px solid rgba(249,0,119,0.2);border-right:1px solid rgba(249,0,119,0.2);">
              <p style="margin:0 0 24px;font-size:18px;line-height:1.6;color:#F9EDD8;">
                Hey ${firstName},
              </p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#F9EDD8;">
                You did it. The committee has reviewed your application and we&rsquo;re stoked to welcome you to NODE 2026.
              </p>
              <p style="margin:0 0 40px;font-size:16px;line-height:1.7;color:#F9EDD8;">
                Click below to set up your account, complete your profile, and start getting ready for the playa.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(135deg,#F90077,#FF3399,#FFB800);">
                    <a href="${magicLink}" target="_blank" style="display:inline-block;padding:16px 48px;font-family:'Exo 2',Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:1px;">
                      Set Up Your Account
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:32px;background-color:#0F0120;border-top:1px solid rgba(249,0,119,0.3);border-radius:0 0 16px 16px;">
              <p style="margin:0 0 8px;font-size:14px;color:#F9EDD8;text-align:center;opacity:0.7;">
                NODE &mdash; Where Connection Meets the Desert
              </p>
              <p style="margin:0;font-size:12px;color:#F9EDD8;text-align:center;opacity:0.4;">
                This is a one-time account setup email from NODE.
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
