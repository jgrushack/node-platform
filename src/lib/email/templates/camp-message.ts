export function campMessageEmail({
  subject,
  bodyHtml,
  siteUrl,
}: {
  subject: string;
  bodyHtml: string;
  siteUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${subject}</title>
  <link href="https://fonts.googleapis.com/css2?family=Exo+2:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    @font-face {
      font-family: 'SciFied';
      src: url('https://nodev0.vercel.app/fonts/SciFied.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#0F0120;font-family:'Exo 2',Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0F0120;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:32px 32px 16px;background-color:#0F0120;border-radius:16px 16px 0 0;">
              <svg width="120" height="60" viewBox="0 0 4234 2126" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;margin:0 auto;">
                <defs><linearGradient id="ng" x1="0" y1="1063" x2="4234" y2="1063" gradientUnits="userSpaceOnUse"><stop stop-color="#FBA52C"/><stop offset="1" stop-color="#EF335D"/></linearGradient></defs>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M1337.41 102.319C1427.21 158.828 1451.12 267.169 1397.68 367.225L495.898 1951.92C439.389 2041.72 320.786 2068.7 230.992 2012.19C141.197 1955.68 114.215 1837.08 170.724 1747.28L1072.51 162.587C1129.02 72.7922 1247.62 45.8094 1337.41 102.319Z" fill="url(#ng)"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M1781.56 912.65C1871.01 969.702 1897.27 1088.47 1840.22 1177.92L1393.26 1955.92C1336.21 2045.37 1217.45 2071.63 1128 2014.58C1038.55 1957.53 1012.28 1838.76 1069.34 1749.31L1516.29 971.312C1573.35 881.862 1692.11 855.598 1781.56 912.65Z" fill="url(#ng)"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M2234.76 1701.65C2318.8 1766.42 2334.42 1887.05 2269.65 1971.08L2267.56 1973.79C2202.8 2057.83 2082.17 2073.45 1998.14 2008.68C1914.1 1943.92 1898.48 1823.29 1963.25 1739.26L1965.34 1736.54C2030.1 1652.51 2150.73 1636.89 2234.76 1701.65Z" fill="url(#ng)"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M2895.98 2023.63C2806.18 1967.12 2782.27 1858.78 2835.71 1758.72L3737.49 174.023C3794 84.2285 3912.6 57.2458 4002.4 113.755C4092.19 170.264 4119.18 288.867 4062.67 378.661L3160.88 1963.36C3104.37 2053.15 2985.77 2080.14 2895.98 2023.63Z" fill="url(#ng)"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M2451.82 1213.3C2362.37 1156.25 2336.11 1037.48 2393.16 948.033L2840.12 170.031C2897.17 80.581 3015.93 54.3172 3105.38 111.369C3194.84 168.422 3221.1 287.186 3164.05 376.636L2717.09 1154.64C2660.04 1244.09 2541.27 1270.35 2451.82 1213.3Z" fill="url(#ng)"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M1998.58 424.295C1914.55 359.53 1898.92 238.904 1963.69 154.87L1965.78 152.157C2030.55 68.1225 2151.17 52.5019 2235.21 117.267C2319.24 182.033 2334.86 302.659 2270.1 386.693L2268.01 389.406C2203.24 473.44 2082.61 489.061 1998.58 424.295Z" fill="url(#ng)"/>
              </svg>
              <p style="margin:12px 0 0;font-family:'SciFied','Exo 2',Arial,Helvetica,sans-serif;font-size:18px;font-weight:400;letter-spacing:4px;color:#F9EDD8;text-transform:uppercase;">NODE 2026</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 32px;background-color:#1a0a2e;border-left:1px solid rgba(249,0,119,0.2);border-right:1px solid rgba(249,0,119,0.2);">
              <div style="margin:0 0 32px;font-size:16px;line-height:1.7;color:#F9EDD8;">
                ${bodyHtml}
              </div>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td align="center" style="border-radius:12px;background:linear-gradient(135deg,#F90077,#FF3399,#FFB800);">
                    <a href="${siteUrl}/dashboard/messages" target="_blank" style="display:inline-block;padding:16px 48px;font-family:'Exo 2',Arial,Helvetica,sans-serif;font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;letter-spacing:1px;">
                      View in Dashboard
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
                You received this email because you are a member of NODE.
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
