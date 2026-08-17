/**
 * "You're locked in" — sent once when a camper completes every row of the
 * Road to 2026 checklist. Pure hype + their week at a glance.
 */
export function lockedInEmail({
  firstName,
  daysToGate,
  arrivalLabel,
  firstShiftLabel,
  renoBuddies,
  dashboardUrl,
}: {
  firstName: string;
  daysToGate: number | null;
  arrivalLabel: string | null;
  firstShiftLabel: string | null;
  renoBuddies: string[];
  dashboardUrl: string;
}): string {
  const rows: string[] = [];
  if (arrivalLabel) rows.push(row("Arriving", arrivalLabel));
  if (firstShiftLabel) rows.push(row("First shift", firstShiftLabel));
  if (renoBuddies.length)
    rows.push(row("Landing in Reno with you", renoBuddies.join(", ")));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're locked in — NODE 2026</title>
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @font-face { font-family: 'SciFied'; src: url('https://www.node.family/fonts/SciFied.ttf') format('truetype'); }
    @font-face { font-family: 'Neuropol'; src: url('https://www.node.family/fonts/Neuropol.otf') format('opentype'); }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0F0120;font-family:'Exo 2',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F0120;">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr>
          <td align="center" style="padding:32px 32px 8px;">
            <p style="margin:0;font-family:'SciFied','Exo 2',Arial,sans-serif;font-size:16px;letter-spacing:4px;color:#F9EDD8;text-transform:uppercase;">NODE 2026</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:16px 32px 32px;">
            <p style="margin:0;font-family:'Neuropol','Exo 2',Arial,sans-serif;font-size:34px;line-height:1.15;font-weight:700;letter-spacing:1px;text-transform:uppercase;background:linear-gradient(135deg,#F90077,#FF3399,#FFB800);-webkit-background-clip:text;background-clip:text;color:#FF3399;">
              We&rsquo;re going to<br/>Burning Man
            </p>
            ${
              daysToGate !== null
                ? `<p style="margin:16px 0 0;font-size:14px;letter-spacing:3px;text-transform:uppercase;color:#F9EDD8;opacity:0.7;">${daysToGate} day${daysToGate === 1 ? "" : "s"} to gate</p>`
                : ""
            }
          </td>
        </tr>
        <tr>
          <td style="padding:32px;background-color:#1a0a2e;border-radius:16px;border:1px solid rgba(249,0,119,0.2);">
            <p style="margin:0 0 16px;font-size:18px;line-height:1.6;color:#F9EDD8;">Hey ${firstName},</p>
            <p style="margin:0 0 24px;font-size:16px;line-height:1.7;color:#F9EDD8;">
              Ticket, ride, dues, dates, shifts &mdash; every box is checked. You&rsquo;re officially locked in for NODE 2026. Nothing left to do but pack (and maybe hydrate).
            </p>
            ${
              rows.length
                ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;border-collapse:collapse;">${rows.join("")}</table>`
                : ""
            }
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
              <tr><td align="center" style="border-radius:12px;background:linear-gradient(135deg,#F90077,#FF3399,#FFB800);">
                <a href="${dashboardUrl}" target="_blank" style="display:inline-block;padding:14px 40px;font-size:15px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:1px;">See your week</a>
              </td></tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 0;">
            <p style="margin:0 0 8px;font-size:14px;color:#F9EDD8;text-align:center;opacity:0.7;">node &mdash; a network of dreamers &amp; explorers</p>
            <p style="margin:0;font-size:12px;color:#F9EDD8;text-align:center;opacity:0.4;">See you in the dust.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:10px 0;border-top:1px solid rgba(249,237,216,0.08);font-size:12px;letter-spacing:1px;text-transform:uppercase;color:#F9EDD8;opacity:0.6;width:45%;vertical-align:top;">${label}</td>
    <td style="padding:10px 0;border-top:1px solid rgba(249,237,216,0.08);font-size:15px;color:#F9EDD8;vertical-align:top;">${value}</td>
  </tr>`;
}
