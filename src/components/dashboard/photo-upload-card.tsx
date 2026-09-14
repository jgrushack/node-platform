"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  UploadCloud,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Smartphone,
  ChevronDown,
  Link2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  getDrivePhotoStatus,
  recordDriveUpload,
  startDriveUpload,
  type DrivePhotoStatus,
} from "@/lib/actions/drive";

const CHUNK = 8 * 1024 * 1024; // 8 MiB — must be a multiple of 256 KiB
const PARALLEL = 2;

type Item = {
  id: string;
  file: File;
  progress: number; // 0–1
  state: "queued" | "uploading" | "done" | "error";
  error?: string;
};

function fmtBytes(n: number): string {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/** PUT one chunk to a Drive resumable session; resolves the next offset or the final file. */
function putChunk(
  uploadUrl: string,
  file: File,
  start: number,
  onProgress: (sent: number) => void
): Promise<{ done: false; next: number } | { done: true; fileId: string }> {
  const end = Math.min(start + CHUNK, file.size);
  const blob = file.slice(start, end);
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl, true);
    xhr.setRequestHeader("Content-Range", `bytes ${start}-${end - 1}/${file.size}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(start + e.loaded);
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.onload = () => {
      if (xhr.status === 308) {
        // Google tells us how much it has: "Range: bytes=0-N"
        const range = xhr.getResponseHeader("Range");
        const m = range?.match(/bytes=0-(\d+)/);
        resolve({ done: false, next: m ? Number(m[1]) + 1 : end });
      } else if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const body = JSON.parse(xhr.responseText) as { id: string };
          resolve({ done: true, fileId: body.id });
        } catch {
          reject(new Error("Bad response from Drive"));
        }
      } else {
        reject(new Error(`Drive rejected chunk (${xhr.status})`));
      }
    };
    xhr.send(blob);
  });
}

export function PhotoUploadCard() {
  const [status, setStatus] = useState<DrivePhotoStatus | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const running = useRef(0);

  const refresh = useCallback(() => {
    getDrivePhotoStatus().then((res) => {
      if (!("error" in res)) setStatus(res);
    });
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const update = (id: string, patch: Partial<Item>) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  async function uploadOne(item: Item) {
    update(item.id, { state: "uploading", progress: 0 });
    const start = await startDriveUpload({
      name: item.file.name,
      mimeType: item.file.type || "application/octet-stream",
      size: item.file.size,
      origin: window.location.origin,
    });
    if ("error" in start) {
      update(item.id, { state: "error", error: start.error });
      return;
    }
    let offset = 0;
    try {
      // Sequential chunks; each 308 tells us where Google actually is.
      for (;;) {
        const res = await putChunk(start.uploadUrl, item.file, offset, (sent) =>
          update(item.id, { progress: Math.min(0.99, sent / item.file.size) })
        );
        if (res.done) {
          const rec = await recordDriveUpload({ fileId: res.fileId, folderId: start.folderId });
          if ("error" in rec) update(item.id, { state: "done", progress: 1, error: rec.error });
          else update(item.id, { state: "done", progress: 1 });
          return;
        }
        offset = res.next;
      }
    } catch (e) {
      update(item.id, { state: "error", error: e instanceof Error ? e.message : "Upload failed" });
    }
  }

  // Simple concurrency-limited queue.
  useEffect(() => {
    const queued = items.filter((i) => i.state === "queued");
    while (running.current < PARALLEL && queued.length) {
      const next = queued.shift()!;
      running.current += 1;
      update(next.id, { state: "uploading" });
      uploadOne(next).finally(() => {
        running.current -= 1;
        setItems((p) => [...p]); // re-run the effect for the next item
        refresh();
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function addFiles(list: FileList | File[]) {
    const files = Array.from(list).filter((f) => /^(image|video)\//.test(f.type));
    if (!files.length) return;
    setItems((prev) => [
      ...prev,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
        progress: 0,
        state: "queued" as const,
      })),
    ]);
  }

  if (!status) return null;
  if (!status.eligible && !status.isAdmin) return null;

  const done = items.filter((i) => i.state === "done").length;
  const active = items.filter((i) => i.state === "uploading" || i.state === "queued").length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
      <Card className="glass-card border-0 overflow-hidden">
        <CardContent className="space-y-4 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-amber/15 ring-1 ring-amber/30">
                <Camera className="h-5 w-5 text-amber" />
              </span>
              <div>
                <p className="font-medium text-sand-100">Add your 2026 photos</p>
                <p className="text-sm text-sand-400">
                  Straight into the communal NODE Drive, in a folder named{" "}
                  <span className="text-sand-200">{status.folderName}</span>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {status.myFolderUrl && (
                <a
                  href={status.myFolderUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sand-300 hover:bg-white/5"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> My folder
                </a>
              )}
              <a
                href={status.yearFolderUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sand-300 hover:bg-white/5"
              >
                <ExternalLink className="h-3.5 w-3.5" /> {status.yearFolderName}
              </a>
            </div>
          </div>

          {!status.connected ? (
            <div className="rounded-xl border border-amber/25 bg-amber/5 p-4 text-sm text-amber-100/90">
              {status.isAdmin ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span>
                    Site uploads aren&apos;t live yet. Connect the Google account that owns the
                    photo folder (Joe&apos;s) so uploads land in its storage.
                  </span>
                  <Button asChild size="sm" className="rounded-full bg-amber text-blue-950 hover:bg-amber/90">
                    <a href="/api/google/drive/connect">
                      <Link2 className="mr-1.5 h-4 w-4" /> Connect Google Drive
                    </a>
                  </Button>
                </div>
              ) : (
                <span>
                  Site uploads are coming online. For now, use the Drive app and drop your
                  photos in a folder with your name — steps below.
                </span>
              )}
            </div>
          ) : (
            status.eligible && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragging(true);
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragging(false);
                  addFiles(e.dataTransfer.files);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors ${
                  dragging
                    ? "border-pink-500/60 bg-pink-500/10"
                    : "border-white/15 bg-white/[0.02] hover:border-pink-500/40 hover:bg-white/[0.04]"
                }`}
              >
                <UploadCloud className="h-7 w-7 text-pink-400" />
                <p className="text-sm font-medium text-sand-100">
                  Drop photos &amp; videos here, or tap to choose
                </p>
                <p className="text-xs text-sand-500">
                  Originals, full size. Keep this tab open until the bar fills. No nudity,
                  nothing illicit — the Drive is public.
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>
            )
          )}

          {items.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-sand-400">
                <span>
                  {done} of {items.length} uploaded
                  {active > 0 ? ` · ${active} in progress` : ""}
                </span>
                {active > 0 && <Loader2 className="h-3.5 w-3.5 animate-spin text-pink-400" />}
              </div>
              <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {items.map((it) => (
                  <li key={it.id} className="rounded-lg bg-white/[0.03] px-3 py-2 text-xs">
                    <div className="flex items-center gap-2">
                      {it.state === "done" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 flex-shrink-0 text-green-400" />
                      ) : it.state === "error" ? (
                        <XCircle className="h-3.5 w-3.5 flex-shrink-0 text-red-400" />
                      ) : (
                        <Loader2
                          className={`h-3.5 w-3.5 flex-shrink-0 text-pink-400 ${it.state === "uploading" ? "animate-spin" : "opacity-40"}`}
                        />
                      )}
                      <span className="min-w-0 flex-1 truncate text-sand-200">{it.file.name}</span>
                      <span className="tabular-nums text-sand-500">{fmtBytes(it.file.size)}</span>
                    </div>
                    {it.state === "uploading" && (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-blue-900/50">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-pink-500 to-amber"
                          style={{ width: `${Math.round(it.progress * 100)}%` }}
                        />
                      </div>
                    )}
                    {it.error && <p className="mt-1 text-red-400">{it.error}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {status.uploadedCount > 0 && items.length === 0 && (
            <p className="text-xs text-sand-500">
              You&apos;ve added {status.uploadedCount} file{status.uploadedCount === 1 ? "" : "s"} (
              {fmtBytes(status.uploadedBytes)}) through the site. Keep them coming.
            </p>
          )}

          {/* Joe's manual instructions — still the fallback for phone uploads */}
          <button
            type="button"
            onClick={() => setShowTips((s) => !s)}
            className="flex w-full items-center justify-between text-left text-xs text-sand-400 hover:text-sand-200"
          >
            <span className="flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Uploading from your phone with the Drive app
            </span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTips ? "rotate-180" : ""}`} />
          </button>
          {showTips && (
            <ol className="list-decimal space-y-1.5 pl-5 text-xs leading-relaxed text-sand-400">
              <li>
                Install the Google Drive app —{" "}
                <a className="text-pink-300 underline" href="https://apps.apple.com/us/app/google-drive/id507874739" target="_blank" rel="noreferrer">
                  iOS
                </a>{" "}
                /{" "}
                <a className="text-pink-300 underline" href="https://play.google.com/store/apps/details?id=com.google.android.apps.docs" target="_blank" rel="noreferrer">
                  Android
                </a>
                .
              </li>
              <li>
                Open the{" "}
                <a className="text-pink-300 underline" href={status.yearFolderUrl} target="_blank" rel="noreferrer">
                  {status.yearFolderName}
                </a>{" "}
                folder. Create a <strong className="text-sand-200">new folder with your name</strong> and dump
                your photos in it.
              </li>
              <li>
                The Drive is public and editable by anyone: don&apos;t delete other folders or past
                years, and no photos of illicit activity or nudity.
              </li>
              <li>
                The app is finicky — keep it open until uploads finish. On iPhone, turn off auto-lock
                (
                <a className="text-pink-300 underline" href="https://support.apple.com/guide/iphone/keep-the-iphone-display-on-longer-iph7117338a8/ios" target="_blank" rel="noreferrer">
                  how
                </a>
                ) so it stays active.
              </li>
            </ol>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
