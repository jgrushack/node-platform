# Confirm Signup Email Template

**Supabase location:** Authentication > Email Templates > Confirm Signup
**Subject:** `Confirm Your NODE Account`

## HTML Body

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>Confirm Your NODE Account</title>
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700&display=swap" rel="stylesheet" />
</head>
<body style="margin:0;padding:0;background-color:#0F0120;font-family:'Exo 2',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F0120;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 32px 16px;background-color:#0F0120;border-radius:16px 16px 0 0;">
              <img src="https://www.node.family/images/node-logo.png" alt="NODE" width="120" height="60" style="display:block;margin:0 auto;" />
              <img src="https://www.node.family/images/node-2026-text.png" alt="NODE 2026" width="250" height="32" style="display:block;margin:12px auto 0;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;background-color:#1a0a2e;border:1px solid rgba(249,0,119,0.2);border-bottom:none;">
              <p style="margin:0 0 24px;font-size:18px;line-height:1.6;color:#F9EDD8;">
                Welcome to NODE,
              </p>
              <p style="margin:0 0 20px;font-size:16px;line-height:1.7;color:#F9EDD8;">
                Thanks for signing up. Confirm your email address to activate your account and enter the portal.
              </p>
              <p style="margin:0 0 40px;font-size:16px;line-height:1.7;color:#F9EDD8;">
                One click and you're in.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center">
                    <a href="{{ .ConfirmationURL }}" target="_blank" style="text-decoration:none;">
                      <img src="https://www.node.family/images/email-button-confirm.png" alt="Confirm Your Email" width="280" height="52" style="display:block;border-radius:12px;" />
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
                node &mdash; a network of dreamers &amp; explorers
              </p>
              <p style="margin:0;font-size:12px;color:#F9EDD8;text-align:center;opacity:0.4;line-height:1.6;">
                You're receiving this because an account was created with this email on the NODE portal. If you didn't sign up, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
```
