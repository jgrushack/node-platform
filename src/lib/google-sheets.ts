import { google } from "googleapis";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

function getAuth() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) return null;

  const parsed = JSON.parse(credentials);
  return new google.auth.GoogleAuth({
    credentials: parsed,
    scopes: SCOPES,
  });
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
  const auth = getAuth();
  if (!auth || !sheetId) return;

  const sheets = google.sheets({ version: "v4", auth });

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: "Sheet1!A:L",
    valueInputOption: "RAW",
    requestBody: {
      values: [
        [
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
        ],
      ],
    },
  });
}
