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
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Send,
  ArrowLeft,
  Video,
  RefreshCw,
} from "lucide-react";
import type { ApplicationRow, ApplicationComment } from "@/lib/types/application";
import {
  updateApplicationStatus,
  getVideoSignedUrl,
  getApplicationComments,
  addApplicationComment,
} from "@/lib/actions/applications";

const statusStyles: Record<ApplicationRow["status"], string> = {
  pending: "bg-amber/20 text-amber",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  waitlist: "bg-blue-400/20 text-blue-300",
};

const statusFilters = ["all", "pending", "approved", "rejected", "waitlist"] as const;

export function ApplicationReview({
  applications,
}: {
  applications: ApplicationRow[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ApplicationRow | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? applications
      : applications.filter((a) => a.status === filter);

  if (selected) {
    return (
      <ApplicationDetail
        application={selected}
        onBack={() => setSelected(null)}
        onStatusChange={() => {
          setSelected(null);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter tabs */}
      <div className="flex gap-2">
        {statusFilters.map((s) => {
          const count =
            s === "all"
              ? applications.length
              : applications.filter((a) => a.status === s).length;
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                filter === s
                  ? "bg-pink-500/20 text-pink-400"
                  : "text-sand-400 hover:text-sand-200 hover:bg-pink-500/5"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
              <span className="ml-1.5 text-sand-500">{count}</span>
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden rounded-2xl">
        <Table>
          <TableHeader>
            <TableRow className="border-pink-500/10 hover:bg-transparent">
              <TableHead className="text-sand-400">Name</TableHead>
              <TableHead className="text-sand-400">Email</TableHead>
              <TableHead className="text-sand-400">Referred By</TableHead>
              <TableHead className="text-sand-400">Date</TableHead>
              <TableHead className="text-sand-400">Status</TableHead>
              <TableHead className="text-right text-sand-400">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="py-12 text-center text-sand-400"
                >
                  No applications found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((app) => (
                <TableRow
                  key={app.id}
                  className="border-pink-500/10 hover:bg-pink-500/5 cursor-pointer"
                  onClick={() => setSelected(app)}
                >
                  <TableCell className="font-medium text-sand-100">
                    {app.first_name} {app.last_name}
                    {app.playa_name && (
                      <span className="ml-1 text-pink-400/60 text-xs">
                        &quot;{app.playa_name}&quot;
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sand-300">{app.email}</TableCell>
                  <TableCell className="text-sand-400">
                    {app.referred_by || "—"}
                  </TableCell>
                  <TableCell className="text-sand-400">
                    {new Date(app.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusStyles[app.status]}>
                      {app.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-sand-300 hover:text-sand-100"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ApplicationDetail({
  application,
  onBack,
  onStatusChange,
}: {
  application: ApplicationRow;
  onBack: () => void;
  onStatusChange: () => void;
}) {
  const [comments, setComments] = useState<ApplicationComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isCommenting, startCommentTransition] = useTransition();

  const refreshVideoUrl = useCallback(async () => {
    if (!application.video_url) return;
    setVideoLoading(true);
    const r = await getVideoSignedUrl(application.video_url);
    if ("url" in r) setVideoUrl(r.url);
    else toast.error("Failed to load video");
    setVideoLoading(false);
  }, [application.video_url]);

  useEffect(() => {
    getApplicationComments(application.id).then((r) => {
      if (!("error" in r)) setComments(r);
    });
    refreshVideoUrl();
    // Auto-refresh signed URL every 50 minutes (URLs expire in 1 hour)
    const interval = application.video_url
      ? setInterval(refreshVideoUrl, 50 * 60 * 1000)
      : undefined;
    return () => clearInterval(interval);
  }, [application.id, refreshVideoUrl]);

  function handleStatusUpdate(status: "approved" | "rejected" | "waitlist") {
    startTransition(async () => {
      const result = await updateApplicationStatus(application.id, status);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`Application ${status}`);
      onStatusChange();
    });
  }

  function handleAddComment() {
    if (!newComment.trim()) return;
    startCommentTransition(async () => {
      const result = await addApplicationComment(application.id, newComment.trim());
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setNewComment("");
      const updated = await getApplicationComments(application.id);
      if (!("error" in updated)) setComments(updated);
    });
  }

  return (
    <div className="space-y-6">
      {/* Back button + header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-sand-300 hover:text-sand-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1">
          <h2 className="text-2xl font-bold text-sand-100">
            {application.first_name} {application.last_name}
            {application.playa_name && (
              <span className="ml-2 text-pink-400 text-lg font-normal">
                &quot;{application.playa_name}&quot;
              </span>
            )}
          </h2>
          <p className="text-sm text-sand-400">
            {application.email}
            {application.phone && ` · ${application.phone}`} — Applied{" "}
            {new Date(application.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge className={`${statusStyles[application.status]} text-sm`}>
          {application.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Application details — left 2 cols */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info card */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <Field label="Years Attended" value={application.years_attended} />
            <Field label="Previous Camps" value={application.previous_camps} />
            <Field label="Favorite Principle" value={application.favorite_principle} />
            <Field label="Why This Principle" value={application.principle_reason} />
            <Field label="Skills" value={application.skills} />
            <Field label="Referred By" value={application.referred_by} />
          </div>

          {/* Video */}
          {application.video_url && (
            <div className="glass-card rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-pink-400 flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video Submission
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={refreshVideoUrl}
                  disabled={videoLoading}
                  className="text-sand-400 hover:text-sand-200"
                  aria-label="Refresh video URL"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${videoLoading ? "animate-spin" : ""}`} />
                </Button>
              </div>
              {videoUrl ? (
                <video
                  src={videoUrl}
                  controls
                  className="w-full rounded-lg border border-blue-900/50"
                  onError={refreshVideoUrl}
                />
              ) : (
                <p className="text-sm text-sand-500">
                  {videoLoading ? "Loading video…" : "Failed to load video."}
                </p>
              )}
            </div>
          )}

          {/* Decision buttons */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-sm font-medium text-sand-300 mb-3">Decision</h3>
            <div className="flex gap-3">
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
        </div>

        {/* Comments — right col */}
        <div className="space-y-4">
          <div className="glass-card rounded-2xl p-6 flex flex-col" style={{ minHeight: "400px" }}>
            <h3 className="text-sm font-medium text-sand-300 mb-4">
              Committee Discussion
              {comments.length > 0 && (
                <span className="ml-2 text-sand-500">({comments.length})</span>
              )}
            </h3>

            {/* Comments list */}
            <div className="flex-1 space-y-4 overflow-y-auto mb-4">
              {comments.length === 0 ? (
                <p className="text-sm text-sand-500 text-center py-8">
                  No comments yet. Be the first to weigh in.
                </p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6 border border-pink-500/20">
                        <AvatarFallback className="bg-pink-500/20 text-[10px] text-pink-400">
                          {getInitials(c.author)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-medium text-sand-200">
                        {getAuthorName(c.author)}
                      </span>
                      <span className="text-[10px] text-sand-500">
                        {formatRelativeTime(c.created_at)}
                      </span>
                    </div>
                    <p className="text-sm text-sand-300 pl-8">{c.body}</p>
                  </div>
                ))
              )}
            </div>

            {/* Add comment */}
            <div className="space-y-2 border-t border-pink-500/10 pt-4">
              <Textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Add your review comment…"
                className="min-h-[80px] text-sm"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.metaKey) {
                    handleAddComment();
                  }
                }}
              />
              <Button
                onClick={handleAddComment}
                disabled={isCommenting || !newComment.trim()}
                size="sm"
                className="w-full bg-pink-500 text-white hover:bg-pink-600"
              >
                {isCommenting ? (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                  <Send className="mr-2 h-3 w-3" />
                )}
                Comment
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
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
      <h4 className="text-xs font-medium text-pink-400 uppercase tracking-wide">
        {label}
      </h4>
      <p className="mt-1 text-sm text-sand-200">{value}</p>
    </div>
  );
}

function getInitials(author: ApplicationComment["author"]): string {
  if (author.first_name && author.last_name) {
    return `${author.first_name[0]}${author.last_name[0]}`.toUpperCase();
  }
  return author.email.slice(0, 2).toUpperCase();
}

function getAuthorName(author: ApplicationComment["author"]): string {
  if (author.playa_name) return author.playa_name;
  if (author.first_name) return `${author.first_name} ${author.last_name || ""}`.trim();
  return author.email;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
