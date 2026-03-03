"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Eye, CheckCircle, XCircle, Clock, Loader2, RefreshCw } from "lucide-react";
import type { ApplicationRow } from "@/lib/types/application";
import {
  updateApplicationStatus,
  getVideoSignedUrl,
} from "@/lib/actions/applications";

const statusStyles: Record<ApplicationRow["status"], string> = {
  pending: "bg-amber/20 text-amber",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  waitlist: "bg-blue-400/20 text-blue-300",
};

export function ApplicationsTable({
  applications,
}: {
  applications: ApplicationRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [notes, setNotes] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [isPending, startTransition] = useTransition();

  const refreshVideoUrl = useCallback(async (videoPath: string) => {
    setVideoLoading(true);
    const result = await getVideoSignedUrl(videoPath);
    if ("url" in result) setVideoUrl(result.url);
    else toast.error("Failed to load video");
    setVideoLoading(false);
  }, []);

  // Auto-refresh signed URL every 50 minutes while dialog is open
  useEffect(() => {
    if (!selected?.video_url) return;
    const interval = setInterval(() => refreshVideoUrl(selected.video_url!), 50 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selected, refreshVideoUrl]);

  async function openDetail(app: ApplicationRow) {
    setSelected(app);
    setNotes(app.reviewer_notes || "");
    setVideoUrl(null);

    if (app.video_url) {
      refreshVideoUrl(app.video_url);
    }
  }

  function handleStatusUpdate(status: "approved" | "rejected" | "waitlist") {
    if (!selected) return;
    startTransition(async () => {
      const result = await updateApplicationStatus(
        selected.id,
        status,
        notes || undefined
      );
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Application ${status}`);
      setSelected(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="glass-card overflow-x-auto rounded-2xl">
        <Table className="min-w-[500px]">
          <TableHeader>
            <TableRow className="border-pink-500/10 hover:bg-transparent">
              <TableHead className="text-sand-400">Name</TableHead>
              <TableHead className="text-sand-400 hidden sm:table-cell">Email</TableHead>
              <TableHead className="text-sand-400">Date</TableHead>
              <TableHead className="text-sand-400">Status</TableHead>
              <TableHead className="text-right text-sand-400">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-12 text-center text-sand-400"
                >
                  No applications yet.
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => (
                <TableRow
                  key={app.id}
                  className="border-pink-500/10 hover:bg-pink-500/5"
                >
                  <TableCell className="font-medium text-sand-100">
                    {app.first_name} {app.last_name}
                  </TableCell>
                  <TableCell className="text-sand-300 hidden sm:table-cell">{app.email}</TableCell>
                  <TableCell className="text-sand-400">
                    {new Date(app.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusStyles[app.status]}>
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openDetail(app)}
                        className="text-sand-300 hover:text-sand-100"
                        aria-label={`View ${app.first_name} ${app.last_name}'s application`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="glass-card border-pink-500/15 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sand-100">
              {selected?.first_name} {selected?.last_name}
              {selected?.playa_name && (
                <span className="ml-2 text-pink-400 text-base font-normal">
                  &quot;{selected.playa_name}&quot;
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-sand-400">
              {selected?.email}
              {selected?.phone && ` · ${selected.phone}`} — Applied{" "}
              {selected && new Date(selected.created_at).toLocaleDateString()}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <Field label="Years Attended" value={selected?.years_attended} />
            <Field label="Previous Camps" value={selected?.previous_camps} />
            <Field
              label="Favorite Principle"
              value={selected?.favorite_principle}
            />
            <Field label="Principle Reason" value={selected?.principle_reason} />
            <Field label="Skills" value={selected?.skills} />
            <Field label="Referred By" value={selected?.referred_by} />

            {/* Video */}
            {selected?.video_url && (
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-pink-400">Video</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => selected.video_url && refreshVideoUrl(selected.video_url)}
                    disabled={videoLoading}
                    className="text-sand-400 hover:text-sand-200 h-7 px-2"
                    aria-label="Refresh video URL"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${videoLoading ? "animate-spin" : ""}`} />
                  </Button>
                </div>
                {videoUrl ? (
                  <video
                    src={videoUrl}
                    controls
                    className="mt-1 w-full max-w-md rounded-lg border border-blue-900/50"
                    onError={() => selected.video_url && refreshVideoUrl(selected.video_url)}
                  />
                ) : (
                  <p className="mt-1 text-sm text-sand-500">
                    {videoLoading ? "Loading video…" : "Failed to load video."}
                  </p>
                )}
              </div>
            )}

            {/* Reviewer Notes */}
            <div className="space-y-2">
              <Label className="text-sand-300">Reviewer Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes about this applicant…"
                className="min-h-[80px]"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col gap-2 pt-2 sm:flex-row">
              <Button
                onClick={() => handleStatusUpdate("approved")}
                disabled={isPending}
                className="flex-1 bg-green-600 text-white hover:bg-green-700"
              >
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Approve
              </Button>
              <Button
                onClick={() => handleStatusUpdate("waitlist")}
                disabled={isPending}
                variant="outline"
                className="flex-1 border-blue-400/30 text-blue-300 hover:bg-blue-400/10"
              >
                <Clock className="mr-2 h-4 w-4" />
                Waitlist
              </Button>
              <Button
                onClick={() => handleStatusUpdate("rejected")}
                disabled={isPending}
                variant="outline"
                className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  if (!value) return null;
  return (
    <div>
      <h4 className="text-sm font-medium text-pink-400">{label}</h4>
      <p className="mt-1 text-sm text-sand-300">{value}</p>
    </div>
  );
}
