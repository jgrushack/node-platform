export function duesPaymentFailedEmail({
  firstName,
  siteUrl,
}: {
  firstName: string;
  siteUrl: string;
}): string {
  const payUrl = `${siteUrl}/dashboard/payments`;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your NODE 2026 payment didn't go through</title>
</head>
<body style="margin:0;padding:0;background-color:#0F0120;font-family:'Exo 2',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F0120;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td align="center" style="padding:32px 32px 16px;background-color:#0F0120;border-radius:16px 16px 0 0;">
              <p style="margin:0;font-size:20px;font-weight:700;letter-spacing:3px;color:#F9EDD8;text-transform:uppercase;">NODE 2026</p>
            </td>
          </tr>
          <tr>
            <td style="padding:40px 32px;background-color:#1a0a2e;border-left:1px solid rgba(249,0,119,0.2);border-right:1px solid rgba(249,0,119,0.2);">
              <p style="margin:0 0 24px;font-size:18px;line-height:1.6;color:#F9EDD8;">Hey ${firstName},</p>
              <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#F9EDD8;">
                We tried to process your NODE 2026 payment and it didn&rsquo;t go through. No worries &mdash; nothing was charged, and your spot is safe.
              </p>
              <p style="margin:0 0 40px;font-size:16px;line-height:1.7;color:#F9EDD8;">
                Head to your dashboard to try again with a different card or payment method. If you&rsquo;re on a payment plan, the next attempt will retry automatically.
              </p>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(135deg,#F90077,#FF3399,#FFB800);">
                    <a href="${payUrl}" target="_blank" style="display:inline-block;padding:16px 48px;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:1px;">
                      Update Payment
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;background-color:#0F0120;border-top:1px solid rgba(249,0,119,0.3);border-radius:0 0 16px 16px;">
              <p style="margin:0 0 8px;font-size:14px;color:#F9EDD8;text-align:center;opacity:0.7;">
                node &mdash; a network of dreamers &amp; explorers
              </p>
              <p style="margin:0;font-size:12px;color:#F9EDD8;text-align:center;opacity:0.4;line-height:1.6;">
                Questions? Just reply to this email.
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
