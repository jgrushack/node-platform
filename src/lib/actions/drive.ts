"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  createResumableUpload,
  ensureCamperFolder,
  getDriveConnectionStatus,
  getDriveFile,
} from "@/lib/google/drive";

const CAMP_YEAR = 2026;
const MAX_FILE_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB — Drive's own cap is higher

const ALLOWED_MIME = /^(image|video)\//;

async function loadContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const [{ data: campYear }, { data: me }] = await Promise.all([
    admin.from("camp_years").select("id").eq("year", CAMP_YEAR).single(),
    admin
      .from("profiles")
      .select("first_name, last_name, playa_name, role")
      .eq("id", user.id)
      .single(),
  ]);
  if (!campYear || !me) return null;
  const { data: reg } = await admin
    .from("registrations")
    .select("status")
    .eq("profile_id", user.id)
    .eq("camp_year_id", campYear.id)
    .maybeSingle();
  return {
    admin,
    user,
    campYearId: campYear.id,
    isAdmin: ["admin", "super_admin"].includes(me.role),
    isConfirmed: reg?.status === "confirmed",
    folderName:
      [me.first_name, me.last_name].filter(Boolean).join(" ").trim() ||
      me.playa_name ||
      user.email?.split("@")[0] ||
      "Camper",
  };
}

export interface DrivePhotoStatus {
  connected: boolean;
  accountEmail: string | null;
  isAdmin: boolean;
  eligible: boolean;
  folderName: string;
  yearFolderName: string;
  yearFolderUrl: string;
  /** My folder, if I've uploaded through the site before. */
  myFolderUrl: string | null;
  uploadedCount: number;
  uploadedBytes: number;
}

export async function getDrivePhotoStatus(): Promise<DrivePhotoStatus | { error: string }> {
  const ctx = await loadContext();
  if (!ctx) return { error: "Not signed in" };
  const status = await getDriveConnectionStatus();
  const { data: uploads } = await ctx.admin
    .from("drive_uploads")
    .select("drive_folder_id, size_bytes")
    .eq("profile_id", ctx.user.id)
    .eq("camp_year_id", ctx.campYearId);
  const rows = uploads ?? [];
  const folderId = rows[0]?.drive_folder_id ?? null;
  return {
    connected: status.connected,
    accountEmail: ctx.isAdmin ? status.accountEmail : null,
    isAdmin: ctx.isAdmin,
    eligible: ctx.isConfirmed,
    folderName: ctx.folderName,
    yearFolderName: status.folderName,
    yearFolderUrl: `https://drive.google.com/drive/folders/${status.folderId}`,
    myFolderUrl: folderId ? `https://drive.google.com/drive/folders/${folderId}` : null,
    uploadedCount: rows.length,
    uploadedBytes: rows.reduce((s, r) => s + Number(r.size_bytes ?? 0), 0),
  };
}

const startSchema = z.object({
  name: z.string().min(1).max(255),
  mimeType: z.string().regex(ALLOWED_MIME, "Only photos and videos"),
  size: z.number().int().positive().max(MAX_FILE_BYTES),
  origin: z.string().url(),
});

export type StartUploadResult =
  | { uploadUrl: string; folderId: string; folderUrl: string }
  | { error: string };

/** Open a resumable Drive session for one file inside the camper's folder. */
export async function startDriveUpload(
  input: z.input<typeof startSchema>
): Promise<StartUploadResult> {
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid file" };
  const ctx = await loadContext();
  if (!ctx) return { error: "Not signed in" };
  if (!ctx.isConfirmed) return { error: "Photo uploads are for NODE 2026 campers." };

  const status = await getDriveConnectionStatus();
  if (!status.connected) return { error: "Google Drive isn't connected yet. Ask an admin." };

  // Only allow sessions for our own origin (the browser must match for CORS).
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://www.node.family";
  const allowedOrigins = new Set([
    site,
    site.replace("://www.", "://"),
    "https://nodev0.vercel.app",
    "http://localhost:3000",
  ]);
  if (!allowedOrigins.has(parsed.data.origin)) return { error: "Bad origin" };

  try {
    const folder = await ensureCamperFolder(ctx.folderName);
    const { uploadUrl } = await createResumableUpload({
      folderId: folder.folderId,
      name: parsed.data.name,
      mimeType: parsed.data.mimeType,
      size: parsed.data.size,
      origin: parsed.data.origin,
    });
    return { uploadUrl, folderId: folder.folderId, folderUrl: folder.folderUrl };
  } catch (e) {
    console.error("[startDriveUpload]", e);
    return { error: "Couldn't open a Drive upload. Try again in a minute." };
  }
}

const recordSchema = z.object({
  fileId: z.string().min(1).max(200),
  folderId: z.string().min(1).max(200),
});

/** After Google confirms the bytes, verify the file and log it. */
export async function recordDriveUpload(
  input: z.input<typeof recordSchema>
): Promise<{ success: true } | { error: string }> {
  const parsed = recordSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid upload" };
  const ctx = await loadContext();
  if (!ctx) return { error: "Not signed in" };
  if (!ctx.isConfirmed) return { error: "Not a 2026 camper" };

  let file: Awaited<ReturnType<typeof getDriveFile>> = null;
  try {
    file = await getDriveFile(parsed.data.fileId);
  } catch (e) {
    console.error("[recordDriveUpload] lookup", e);
  }
  // Don't let a client log a file that isn't in the folder we opened for it.
  if (!file || !file.parents.includes(parsed.data.folderId)) {
    return { error: "Upload not found in your folder" };
  }

  const { error } = await ctx.admin.from("drive_uploads").upsert(
    {
      profile_id: ctx.user.id,
      camp_year_id: ctx.campYearId,
      drive_file_id: file.id,
      drive_folder_id: parsed.data.folderId,
      file_name: file.name,
      mime_type: file.mimeType,
      size_bytes: file.size,
    },
    { onConflict: "drive_file_id" }
  );
  if (error) {
    console.error("[recordDriveUpload]", error);
    return { error: "Uploaded, but couldn't log it." };
  }
  return { success: true };
}
