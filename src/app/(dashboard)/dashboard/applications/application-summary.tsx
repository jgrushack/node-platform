"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { FileText, CheckCircle, Users, Loader2, HandHeart } from "lucide-react";
import type { ApplicationSummaryData, CommitteeRequest } from "@/lib/types/application";
import { requestCommitteeMembership } from "@/lib/actions/applications";

export function ApplicationSummary({
  summary,
  existingRequest,
}: {
  summary: ApplicationSummaryData | null;
  existingRequest: CommitteeRequest | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [request, setRequest] = useState(existingRequest);

  function handleRequestJoin() {
    startTransition(async () => {
      const result = await requestCommitteeMembership();
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Request submitted! An admin will review it.");
      setRequest({ id: "", profile_id: "", status: "pending", created_at: new Date().toISOString() });
      router.refresh();
    });
  }

  const stats = [
    {
      label: "Applications Processing",
      value: summary?.pendingCount ?? "—",
      icon: FileText,
      color: "text-amber",
      bgColor: "bg-amber/10",
    },
    {
      label: "New Nodes Approved",
      value: summary?.approvedCount ?? "—",
      icon: CheckCircle,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      label: "of 60 Slots Remaining",
      value: summary?.slotsRemaining ?? "—",
      icon: Users,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="glass-card rounded-2xl p-6 flex items-start gap-4"
          >
            <div className={`rounded-xl p-2.5 ${stat.bgColor}`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-sand-100">{stat.value}</p>
              <p className="text-sm text-sand-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <HandHeart className="h-5 w-5 text-pink-400" />
          <h2 className="text-lg font-semibold text-sand-100">
            Membership Committee
          </h2>
        </div>
        <p className="text-sm text-sand-300">
          The membership committee reviews applications and votes on new members.
          Committee members can see full application details, cast votes, and
          participate in discussions about prospective members.
        </p>

        {request ? (
          <div className="flex items-center gap-2 rounded-xl bg-pink-500/10 px-4 py-3">
            <CheckCircle className="h-4 w-4 text-pink-400" />
            <span className="text-sm text-pink-300">
              {request.status === "pending"
                ? "Your request to join the committee has been submitted."
                : request.status === "approved"
                ? "You are a committee member! Refresh the page to access reviews."
                : "Your request was not approved at this time."}
            </span>
          </div>
        ) : (
          <Button
            onClick={handleRequestJoin}
            disabled={isPending}
            className="bg-pink-500 text-white hover:bg-pink-600"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <HandHeart className="mr-2 h-4 w-4" />
            )}
            Ask to Join Membership Committee
          </Button>
        )}
      </div>
    </div>
  );
}
