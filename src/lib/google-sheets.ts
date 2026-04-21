import { createPrivateKey, sign as cryptoSign } from "crypto";

const SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_BASE = "https://sheets.googleapis.com/v4/spreadsheets";
const TOKEN_SKEW_SECONDS = 60;

type ServiceAccountCredentials = {
  client_email: string;
  private_key: string;
};

type CachedToken = { accessToken: string; expiresAt: number };
let cachedToken: CachedToken | null = null;

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=+$/, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function loadCredentials(): ServiceAccountCredentials | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as ServiceAccountCredentials;
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

async function getAccessToken(
  creds: ServiceAccountCredentials
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + TOKEN_SKEW_SECONDS) {
    return cachedToken.accessToken;
  }

  const header = base64UrlEncode(
    JSON.stringify({ alg: "RS256", typ: "JWT" })
  );
  const payload = base64UrlEncode(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    })
  );
  const signingInput = `${header}.${payload}`;

  const privateKey = createPrivateKey(creds.private_key);
  const signature = cryptoSign(
    "RSA-SHA256",
    Buffer.from(signingInput),
    privateKey
  );
  const jwt = `${signingInput}.${base64UrlEncode(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + data.expires_in,
  };
  return data.access_token;
}

async function appendRow(
  sheetId: string,
  accessToken: string,
  values: string[]
): Promise<void> {
  const url =
    `${SHEETS_BASE}/${encodeURIComponent(sheetId)}` +
    `/values/${encodeURIComponent("Sheet1!A:L")}:append` +
    `?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: [values] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Sheets append failed: ${res.status} ${text}`);
  }
}

export async function appendApplicationToSheet(data: {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  playaName?: string;
  yearsAttended: string;
  previousCamps?: string;
  favoritePrinciple?: string;
  principleReason?: string;
  skills?: string;
  referredBy?: string;
}) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  const creds = loadCredentials();
  if (!creds || !sheetId) return;

  const accessToken = await getAccessToken(creds);
  await appendRow(sheetId, accessToken, [
    new Date().toISOString(),
    data.firstName,
    data.lastName,
    data.email,
    data.phone || "",
    data.playaName || "",
    data.yearsAttended,
    data.previousCamps || "",
    data.favoritePrinciple || "",
    data.principleReason || "",
    data.skills || "",
    data.referredBy || "",
  ]);
}
