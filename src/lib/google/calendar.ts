import { createAdminClient } from "@/lib/supabase/admin";

// Google Calendar integration (A2): the app acts as a single dedicated Google
// account (e.g. noderepublik@gmail.com) authorized once via OAuth. Events are
// created on that account's calendar with attendees, so Google sends the
// invites and collects RSVPs natively.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "openid",
  "email",
].join(" ");
const EVENT_TIMEZONE = "America/Los_Angeles";
const TOKEN_SKEW_SECONDS = 60;

function oauthCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth env vars (GOOGLE_OAUTH_CLIENT_ID/SECRET) not configured");
  }
  return { clientId, clientSecret };
}

/** Build the Google consent URL (offline + forced consent to guarantee a refresh token). */
export function buildConsentUrl(redirectUri: string, state: string): string {
  const { clientId } = oauthCreds();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ refreshToken: string; accessToken: string }> {
  const { clientId, clientSecret } = oauthCreds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { refresh_token?: string; access_token: string };
  if (!data.refresh_token) {
    throw new Error("Google returned no refresh_token — re-consent with prompt=consent required.");
  }
  return { refreshToken: data.refresh_token, accessToken: data.access_token };
}

export async function fetchAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

type CalConfig = {
  refresh_token: string;
  calendar_id: string;
  account_email: string | null;
};

async function getCalendarConfig(): Promise<CalConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_calendar_config")
    .select("refresh_token, calendar_id, account_email")
    .eq("id", true)
    .maybeSingle();
  return (data as CalConfig | null) ?? null;
}

export async function getConnectionStatus(): Promise<{
  connected: boolean;
  accountEmail: string | null;
}> {
  const cfg = await getCalendarConfig();
  return { connected: !!cfg?.refresh_token, accountEmail: cfg?.account_email ?? null };
}

export async function storeCalendarConfig(input: {
  refreshToken: string;
  accountEmail: string | null;
  connectedBy: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("google_calendar_config").upsert(
    {
      id: true,
      refresh_token: input.refreshToken,
      account_email: input.accountEmail,
      calendar_id: "primary",
      connected_by: input.connectedBy,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Failed to store calendar config: ${error.message}`);
  cachedToken = null;
}

let cachedToken: { accessToken: string; expiresAt: number; refreshToken: string } | null = null;

async function getAccessToken(): Promise<string> {
  const cfg = await getCalendarConfig();
  if (!cfg?.refresh_token) throw new Error("Google Calendar not connected");
  const now = Math.floor(Date.now() / 1000);
  // Cache is keyed to the refresh token so reconnecting a different account
  // (or a warm serverless instance) never serves a token for the old account.
  if (
    cachedToken &&
    cachedToken.refreshToken === cfg.refresh_token &&
    cachedToken.expiresAt > now + TOKEN_SKEW_SECONDS
  ) {
    return cachedToken.accessToken;
  }
  const { clientId, clientSecret } = oauthCreds();
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: cfg.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Token refresh failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in?: number };
  cachedToken = {
    accessToken: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600),
    refreshToken: cfg.refresh_token,
  };
  return data.access_token;
}

export type CalendarEventInput = {
  title: string;
  description?: string | null;
  location?: string | null;
  date: string; // YYYY-MM-DD
  startTime?: string | null; // HH:MM[:SS]
  endTime?: string | null;
  attendees?: string[]; // emails
};

function nextDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + 1);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function toMinutes(t: string): number {
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function toGoogleTimes(date: string, startTime?: string | null, endTime?: string | null) {
  if (!startTime) {
    // All-day event — Google end.date is exclusive, so push to the next day.
    return { start: { date }, end: { date: nextDay(date) } };
  }
  const startHM = startTime.slice(0, 5);
  let endDate = date;
  let endHM: string;
  // A real end time is one that differs from the start. Equal start/end (or no
  // end) falls back to a 1-hour duration rather than a zero-length / 24h event.
  const hasRealEnd = !!endTime && toMinutes(endTime) !== toMinutes(startTime);
  if (hasRealEnd) {
    endHM = endTime!.slice(0, 5);
    // Overnight: end before start rolls to the next day.
    if (toMinutes(endTime!) < toMinutes(startTime)) endDate = nextDay(date);
  } else {
    // Default 1-hour duration.
    const [h, m] = startHM.split(":").map(Number);
    const nh = h + 1;
    if (nh >= 24) endDate = nextDay(date);
    endHM = `${String(nh % 24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  return {
    start: { dateTime: `${date}T${startHM}:00`, timeZone: EVENT_TIMEZONE },
    end: { dateTime: `${endDate}T${endHM}:00`, timeZone: EVENT_TIMEZONE },
  };
}

function buildEventBody(e: CalendarEventInput) {
  const descriptionParts: string[] = [];
  if (e.description) descriptionParts.push(e.description);
  if (e.location) descriptionParts.push(`Join: ${e.location}`);
  return {
    summary: e.title,
    description: descriptionParts.length ? descriptionParts.join("\n\n") : undefined,
    location: e.location ?? undefined,
    ...toGoogleTimes(e.date, e.startTime, e.endTime),
    attendees: e.attendees?.map((email) => ({ email })) ?? undefined,
    guestsCanInviteOthers: false,
    guestsCanSeeOtherGuests: false,
  };
}

async function calendarId(): Promise<string> {
  const cfg = await getCalendarConfig();
  return cfg?.calendar_id ?? "primary";
}

export async function createCalendarEvent(
  e: CalendarEventInput
): Promise<{ id: string; htmlLink: string }> {
  const token = await getAccessToken();
  const calId = await calendarId();
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events?sendUpdates=all`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody(e)),
    }
  );
  if (!res.ok) throw new Error(`Create event failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as { id: string; htmlLink: string };
  return { id: data.id, htmlLink: data.htmlLink };
}

export async function updateCalendarEvent(eventId: string, e: CalendarEventInput): Promise<void> {
  const token = await getAccessToken();
  const calId = await calendarId();
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(buildEventBody(e)),
    }
  );
  if (!res.ok) throw new Error(`Update event failed: ${res.status} ${await res.text()}`);
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const token = await getAccessToken();
  const calId = await calendarId();
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
  );
  // 404/410 = already gone — treat as success.
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Delete event failed: ${res.status} ${await res.text()}`);
  }
}

export type GoogleAttendee = {
  email: string;
  responseStatus: "needsAction" | "declined" | "tentative" | "accepted" | string;
  displayName?: string;
};

export async function getEventAttendees(eventId: string): Promise<GoogleAttendee[]> {
  const token = await getAccessToken();
  const calId = await calendarId();
  const res = await fetch(
    `${CALENDAR_BASE}/calendars/${encodeURIComponent(calId)}/events/${encodeURIComponent(eventId)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Get event failed: ${res.status} ${await res.text()}`);
  const data = (await res.json()) as {
    attendees?: Array<{ email: string; responseStatus: string; displayName?: string }>;
  };
  return (data.attendees ?? []).map((a) => ({
    email: a.email,
    responseStatus: a.responseStatus,
    displayName: a.displayName,
  }));
}
