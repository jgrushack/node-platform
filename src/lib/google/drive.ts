import { createAdminClient } from "@/lib/supabase/admin";

// Google Drive photo uploads: the app acts as ONE connected Google account
// (authorized once by an admin via OAuth — ideally the account that owns the
// NODE Photos folder so uploads land in its storage quota). Browsers upload
// file bytes straight to Google via a resumable session the server opens;
// the bytes never touch our servers.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const DRIVE_BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD_BASE = "https://www.googleapis.com/upload/drive/v3";
const FOLDER_MIME = "application/vnd.google-apps.folder";
const TOKEN_SKEW_SECONDS = 60;

// Full Drive scope: we create folders inside a folder the app didn't create,
// which drive.file can't see.
const SCOPES = ["https://www.googleapis.com/auth/drive", "openid", "email"].join(" ");

/** The communal "NODE Photos → 2026 - Axis Mundi" folder (owned by Joe). */
export const DEFAULT_YEAR_FOLDER_ID = "1QSSKEEHJAR2kHnJB21P1tx9MTGYUbQHe";
export const DEFAULT_YEAR_FOLDER_NAME = "2026 - Axis Mundi";

function oauthCreds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth env vars (GOOGLE_OAUTH_CLIENT_ID/SECRET) not configured");
  }
  return { clientId, clientSecret };
}

export function buildDriveConsentUrl(redirectUri: string, state: string): string {
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

export async function exchangeDriveCode(
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

export async function fetchDriveAccountEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) return null;
    const data = (await res.json()) as { email?: string };
    return data.email ?? null;
  } catch {
    return null;
  }
}

type DriveConfig = {
  refresh_token: string;
  account_email: string | null;
  year_folder_id: string;
  year_folder_name: string | null;
};

async function getDriveConfig(): Promise<DriveConfig | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("google_drive_config")
    .select("refresh_token, account_email, year_folder_id, year_folder_name")
    .eq("id", true)
    .maybeSingle();
  return (data as DriveConfig | null) ?? null;
}

export async function getDriveConnectionStatus(): Promise<{
  connected: boolean;
  accountEmail: string | null;
  folderId: string;
  folderName: string;
}> {
  const cfg = await getDriveConfig();
  return {
    connected: !!cfg?.refresh_token,
    accountEmail: cfg?.account_email ?? null,
    folderId: cfg?.year_folder_id ?? DEFAULT_YEAR_FOLDER_ID,
    folderName: cfg?.year_folder_name ?? DEFAULT_YEAR_FOLDER_NAME,
  };
}

export async function storeDriveConfig(input: {
  refreshToken: string;
  accountEmail: string | null;
  connectedBy: string;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("google_drive_config").upsert(
    {
      id: true,
      refresh_token: input.refreshToken,
      account_email: input.accountEmail,
      year_folder_id: DEFAULT_YEAR_FOLDER_ID,
      year_folder_name: DEFAULT_YEAR_FOLDER_NAME,
      connected_by: input.connectedBy,
      connected_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );
  if (error) throw new Error(`Failed to store drive config: ${error.message}`);
  cachedToken = null;
}

let cachedToken: { accessToken: string; expiresAt: number; refreshToken: string } | null = null;

async function getAccessToken(cfg: DriveConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
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

/** Escape a string for a Drive `q` query literal. */
function q(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Find (or create) the camper's folder directly under the year folder. */
export async function ensureCamperFolder(
  folderName: string
): Promise<{ folderId: string; folderUrl: string; created: boolean }> {
  const cfg = await getDriveConfig();
  if (!cfg) throw new Error("Google Drive not connected");
  const token = await getAccessToken(cfg);

  const query =
    `'${q(cfg.year_folder_id)}' in parents and name = '${q(folderName)}' ` +
    `and mimeType = '${FOLDER_MIME}' and trashed = false`;
  const listRes = await fetch(
    `${DRIVE_BASE}/files?${new URLSearchParams({
      q: query,
      fields: "files(id,name)",
      pageSize: "5",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    })}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) throw new Error(`Drive list failed: ${listRes.status} ${await listRes.text()}`);
  const list = (await listRes.json()) as { files?: { id: string; name: string }[] };
  const existing = list.files?.[0];
  if (existing) {
    return {
      folderId: existing.id,
      folderUrl: `https://drive.google.com/drive/folders/${existing.id}`,
      created: false,
    };
  }

  const createRes = await fetch(
    `${DRIVE_BASE}/files?${new URLSearchParams({ fields: "id", supportsAllDrives: "true" })}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        name: folderName,
        mimeType: FOLDER_MIME,
        parents: [cfg.year_folder_id],
      }),
    }
  );
  if (!createRes.ok)
    throw new Error(`Drive folder create failed: ${createRes.status} ${await createRes.text()}`);
  const created = (await createRes.json()) as { id: string };
  return {
    folderId: created.id,
    folderUrl: `https://drive.google.com/drive/folders/${created.id}`,
    created: true,
  };
}

/**
 * Open a resumable upload session for one file. The returned URL accepts
 * chunked PUTs directly from the browser (CORS is granted to `origin` because
 * we pass it when opening the session). The session URL is itself the only
 * credential — no OAuth token reaches the client.
 */
export async function createResumableUpload(input: {
  folderId: string;
  name: string;
  mimeType: string;
  size: number;
  origin: string;
}): Promise<{ uploadUrl: string }> {
  const cfg = await getDriveConfig();
  if (!cfg) throw new Error("Google Drive not connected");
  const token = await getAccessToken(cfg);

  const res = await fetch(
    `${UPLOAD_BASE}/files?${new URLSearchParams({
      uploadType: "resumable",
      supportsAllDrives: "true",
      fields: "id,name,size,mimeType,webViewLink",
    })}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": input.mimeType,
        "X-Upload-Content-Length": String(input.size),
        Origin: input.origin,
      },
      body: JSON.stringify({ name: input.name, parents: [input.folderId] }),
    }
  );
  if (!res.ok) throw new Error(`Drive upload session failed: ${res.status} ${await res.text()}`);
  const uploadUrl = res.headers.get("location");
  if (!uploadUrl) throw new Error("Drive returned no upload session URL");
  return { uploadUrl };
}

/** Confirm a file exists in the expected folder before we log it. */
export async function getDriveFile(
  fileId: string
): Promise<{ id: string; name: string; mimeType: string; size: number; parents: string[] } | null> {
  const cfg = await getDriveConfig();
  if (!cfg) throw new Error("Google Drive not connected");
  const token = await getAccessToken(cfg);
  const res = await fetch(
    `${DRIVE_BASE}/files/${encodeURIComponent(fileId)}?${new URLSearchParams({
      fields: "id,name,mimeType,size,parents",
      supportsAllDrives: "true",
    })}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const f = (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    size?: string;
    parents?: string[];
  };
  return {
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    size: Number(f.size ?? 0),
    parents: f.parents ?? [],
  };
}
