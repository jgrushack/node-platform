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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ThumbsUp,
  ThumbsDown,
  Hourglass,
  ShieldAlert,
} from "lucide-react";
import type {
  ApplicationWithVotes,
  ApplicationComment,
  VoteValue,
} from "@/lib/types/application";
import {
  castVote,
  adminOverrideStatus,
  getVideoSignedUrl,
  getApplicationComments,
  addApplicationComment,
} from "@/lib/actions/applications";

const statusStyles: Record<ApplicationWithVotes["status"], string> = {
  pending: "bg-amber/20 text-amber",
  approved: "bg-green-500/20 text-green-400",
  rejected: "bg-red-500/20 text-red-400",
  waitlist: "bg-blue-400/20 text-blue-300",
};

const voteStyles: Record<VoteValue, { bg: string; text: string }> = {
  yes: { bg: "bg-green-500/20", text: "text-green-400" },
  no: { bg: "bg-red-500/20", text: "text-red-400" },
  waitlist: { bg: "bg-blue-400/20", text: "text-blue-300" },
};

const statusFilters = [
  "all",
  "pending",
  "approved",
  "rejected",
  "waitlist",
] as const;

export function ApplicationReview({
  applications,
  userRole,
}: {
  applications: ApplicationWithVotes[];
  userRole: string;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<ApplicationWithVotes | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const filtered =
    filter === "all"
      ? applications
      : applications.filter((a) => a.status === filter);

  if (selected) {
    return (
      <ApplicationDetail
        application={selected}
        userRole={userRole}
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
      <div className="flex flex-wrap gap-2">
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
      <div className="glass-card overflow-x-auto rounded-2xl">
        <Table className="min-w-[700px]">
          <TableHeader>
            <TableRow className="border-pink-500/10 hover:bg-transparent">
              <TableHead className="text-sand-400">Name</TableHead>
              <TableHead className="text-sand-400 hidden sm:table-cell">
                Email
              </TableHead>
              <TableHead className="text-sand-400 hidden md:table-cell">
                Referred By
              </TableHead>
              <TableHead className="text-sand-400">Date</TableHead>
              <TableHead className="text-sand-400">Votes</TableHead>
              <TableHead className="text-sand-400">Status</TableHead>
              <TableHead className="text-right text-sand-400">Review</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={7}
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
                  <TableCell className="text-sand-300 hidden sm:table-cell">
                    {app.email}
                  </TableCell>
                  <TableCell className="text-sand-400 hidden md:table-cell">
                    {app.referred_by || "—"}
                  </TableCell>
                  <TableCell className="text-sand-400">
                    {new Date(app.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <VoteTally summary={app.vote_summary} />
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

function VoteTally({
  summary,
}: {
  summary: ApplicationWithVotes["vote_summary"];
}) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-green-400 font-medium">
        {summary.yes}
      </span>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500/20 text-red-400 font-medium">
        {summary.no}
      </span>
      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-purple-500/20 text-purple-400 font-medium">
        {summary.waitlist}
      </span>
    </div>
  );
}

function ApplicationDetail({
  application,
  userRole,
  onBack,
  onStatusChange,
}: {
  application: ApplicationWithVotes;
  userRole: string;
  onBack: () => void;
  onStatusChange: () => void;
}) {
  const [comments, setComments] = useState<ApplicationComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoLoading, setVideoLoading] = useState(false);
  const [isVoting, startVotingTransition] = useTransition();
  const [isOverriding, startOverrideTransition] = useTransition();
  const [isCommenting, startCommentTransition] = useTransition();
  const [currentVote, setCurrentVote] = useState<VoteValue | null>(
    application.current_user_vote
  );

  const isAdmin = ["admin", "super_admin"].includes(userRole);

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
    setTimeout(() => refreshVideoUrl(), 0);
    const interval = application.video_url
      ? setInterval(refreshVideoUrl, 50 * 60 * 1000)
      : undefined;
    return () => clearInterval(interval);
  }, [application.id, application.video_url, refreshVideoUrl]);

  function handleVote(vote: VoteValue) {
    startVotingTransition(async () => {
      const result = await castVote(application.id, vote);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setCurrentVote(vote);
      if (result.autoApproved) {
        toast.success(
          "4 yes votes reached — application auto-approved! Account created and welcome email sent."
        );
        onStatusChange();
      } else {
        toast.success(`Vote recorded: ${vote}`);
      }
    });
  }

  function handleAdminOverride(status: "approved" | "rejected" | "waitlist") {
    startOverrideTransition(async () => {
      const result = await adminOverrideStatus(application.id, status);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        status === "approved"
          ? "Application approved. Account created and welcome email sent."
          : `Application ${status}.`
      );
      onStatusChange();
    });
  }

  function handleAddComment() {
    if (!newComment.trim()) return;
    startCommentTransition(async () => {
      const result = await addApplicationComment(
        application.id,
        newComment.trim()
      );
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="self-start text-sand-300 hover:text-sand-100"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-sand-100 sm:text-2xl">
            {application.first_name} {application.last_name}
            {application.playa_name && (
              <span className="ml-2 text-pink-400 text-base font-normal sm:text-lg">
                &quot;{application.playa_name}&quot;
              </span>
            )}
          </h2>
          <p className="text-xs text-sand-400 sm:text-sm">
            {application.email}
            {application.phone && ` · ${application.phone}`} — Applied{" "}
            {new Date(application.created_at).toLocaleDateString()}
          </p>
        </div>
        <Badge
          className={`${statusStyles[application.status]} text-sm self-start sm:self-auto`}
        >
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
            <Field
              label="Favorite Principle"
              value={application.favorite_principle}
            />
            <Field
              label="Why This Principle"
              value={application.principle_reason}
            />
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
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${videoLoading ? "animate-spin" : ""}`}
                  />
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

          {/* Voting panel */}
          {application.status === "pending" && (
            <div className="glass-card rounded-2xl p-4 sm:p-6">
              <h3 className="text-sm font-medium text-sand-300 mb-3">
                Your Vote
              </h3>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Button
                  onClick={() => handleVote("yes")}
                  disabled={isVoting}
                  className={`flex-1 ${
                    currentVote === "yes"
                      ? "bg-green-600 text-white ring-2 ring-green-400"
                      : "bg-green-600/20 text-green-400 hover:bg-green-600/40"
                  }`}
                >
                  {isVoting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ThumbsUp className="mr-2 h-4 w-4" />
                  )}
                  Yes
                  {currentVote === "yes" && " (your vote)"}
                </Button>
                <Button
                  onClick={() => handleVote("waitlist")}
                  disabled={isVoting}
                  className={`flex-1 ${
                    currentVote === "waitlist"
                      ? "bg-blue-600 text-white ring-2 ring-blue-400"
                      : "bg-blue-600/20 text-blue-300 hover:bg-blue-600/40"
                  }`}
                >
                  <Hourglass className="mr-2 h-4 w-4" />
                  Waitlist
                  {currentVote === "waitlist" && " (your vote)"}
                </Button>
                <Button
                  onClick={() => handleVote("no")}
                  disabled={isVoting}
                  className={`flex-1 ${
                    currentVote === "no"
                      ? "bg-red-600 text-white ring-2 ring-red-400"
                      : "bg-red-600/20 text-red-400 hover:bg-red-600/40"
                  }`}
                >
                  <ThumbsDown className="mr-2 h-4 w-4" />
                  No
                  {currentVote === "no" && " (your vote)"}
                </Button>
              </div>
              <p className="text-xs text-sand-500 mt-2">
                4 yes votes will auto-approve this application and send a welcome
                email.
              </p>
            </div>
          )}

          {/* Admin override panel */}
          {isAdmin && (
            <div className="glass-card rounded-2xl p-4 sm:p-6 border border-amber/20">
              <div className="flex items-center gap-2 mb-3">
                <ShieldAlert className="h-4 w-4 text-amber" />
                <h3 className="text-sm font-medium text-amber">
                  Admin Override
                </h3>
              </div>
              <p className="text-xs text-sand-400 mb-3">
                Override the voting process. Approve creates an account and sends
                a welcome email immediately.
              </p>
              <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
                <Button
                  onClick={() => handleAdminOverride("approved")}
                  disabled={isOverriding || application.status === "approved"}
                  className="flex-1 bg-green-600 text-white hover:bg-green-700"
                >
                  {isOverriding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Approve
                </Button>
                <Button
                  onClick={() => handleAdminOverride("waitlist")}
                  disabled={isOverriding || application.status === "waitlist"}
                  variant="outline"
                  className="flex-1 border-blue-400/30 text-blue-300 hover:bg-blue-400/10"
                >
                  <Clock className="mr-2 h-4 w-4" />
                  Waitlist
                </Button>
                <Button
                  onClick={() => handleAdminOverride("rejected")}
                  disabled={isOverriding || application.status === "rejected"}
                  variant="outline"
                  className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right column — Votes + Comments */}
        <div className="space-y-4">
          {/* Transparent votes panel */}
          <div className="glass-card rounded-2xl p-6">
            <h3 className="text-sm font-medium text-sand-300 mb-4">
              Votes
              <span className="ml-2 text-sand-500">
                ({application.votes.length})
              </span>
            </h3>

            {application.votes.length === 0 ? (
              <p className="text-sm text-sand-500 text-center py-4">
                No votes yet.
              </p>
            ) : (
              <div className="space-y-3">
                {application.votes.map((v) => (
                  <div key={v.id} className="flex items-center gap-3">
                    <Avatar className="h-7 w-7 border border-pink-500/20">
                      {v.voter.avatar_url ? (
                        <AvatarImage src={v.voter.avatar_url} />
                      ) : null}
                      <AvatarFallback className="bg-pink-500/20 text-[10px] text-pink-400">
                        {getVoterInitials(v.voter)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 text-xs text-sand-200 truncate">
                      {getVoterName(v.voter)}
                    </span>
                    <Badge
                      className={`${voteStyles[v.vote].bg} ${voteStyles[v.vote].text} text-xs`}
                    >
                      {v.vote}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {/* Vote summary bar */}
            {application.votes.length > 0 && (
              <div className="mt-4 pt-3 border-t border-pink-500/10">
                <VoteTallyDetail summary={application.vote_summary} />
              </div>
            )}
          </div>

          {/* Comments */}
          <div
            className="glass-card rounded-2xl p-6 flex flex-col"
            style={{ minHeight: "350px" }}
          >
            <h3 className="text-sm font-medium text-sand-300 mb-4">
              Committee Discussion
              {comments.length > 0 && (
                <span className="ml-2 text-sand-500">({comments.length})</span>
              )}
            </h3>

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

function VoteTallyDetail({
  summary,
}: {
  summary: ApplicationWithVotes["vote_summary"];
}) {
  const total = summary.yes + summary.no + summary.waitlist;
  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="flex items-center gap-1">
        <ThumbsUp className="h-3 w-3 text-green-400" />
        <span className="text-green-400 font-medium">{summary.yes}</span>
      </div>
      <div className="flex items-center gap-1">
        <ThumbsDown className="h-3 w-3 text-red-400" />
        <span className="text-red-400 font-medium">{summary.no}</span>
      </div>
      <div className="flex items-center gap-1">
        <Hourglass className="h-3 w-3 text-blue-300" />
        <span className="text-blue-300 font-medium">{summary.waitlist}</span>
      </div>
      <span className="text-sand-500 ml-auto">{total} total</span>
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

function getVoterInitials(voter: {
  first_name: string | null;
  last_name: string | null;
  email: string;
}): string {
  if (voter.first_name && voter.last_name) {
    return `${voter.first_name[0]}${voter.last_name[0]}`.toUpperCase();
  }
  return voter.email.slice(0, 2).toUpperCase();
}

function getVoterName(voter: {
  first_name: string | null;
  last_name: string | null;
  playa_name: string | null;
  email: string;
}): string {
  if (voter.playa_name) return voter.playa_name;
  if (voter.first_name)
    return `${voter.first_name} ${voter.last_name || ""}`.trim();
  return voter.email;
}

function getInitials(author: ApplicationComment["author"]): string {
  if (author.first_name && author.last_name) {
    return `${author.first_name[0]}${author.last_name[0]}`.toUpperCase();
  }
  return author.email.slice(0, 2).toUpperCase();
}

function getAuthorName(author: ApplicationComment["author"]): string {
  if (author.playa_name) return author.playa_name;
  if (author.first_name)
    return `${author.first_name} ${author.last_name || ""}`.trim();
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
