import {
  getApplicationsWithVotes,
  getCurrentUserProfile,
  getApplicationSummary,
  getMyCommitteeRequest,
} from "@/lib/actions/applications";
import { ApplicationReview } from "./application-review";
import { ApplicationSummary } from "./application-summary";

export default async function DashboardApplicationsPage() {
  const profile = await getCurrentUserProfile();
  const isCommittee = profile
    ? profile.isCommitteeMember || ["admin", "super_admin"].includes(profile.role)
    : false;

  if (!isCommittee) {
    let summary = null;
    let existingRequest = null;

    try {
      const [summaryResult, requestResult] = await Promise.all([
        getApplicationSummary(),
        getMyCommitteeRequest(),
      ]);

      summary =
        summaryResult && !("error" in summaryResult) ? summaryResult : null;
      existingRequest =
        requestResult && !("error" in requestResult) ? requestResult : null;
    } catch (e) {
      console.error("[DashboardApplicationsPage] Error loading data:", e);
    }

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-sand-100">Applications</h1>
          <p className="mt-1 text-sand-400">
            Membership application overview for NODE 2026.
          </p>
        </div>
        <ApplicationSummary summary={summary} existingRequest={existingRequest} />
      </div>
    );
  }

  const result = await getApplicationsWithVotes();

  if ("error" in result) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-sand-100">Applications</h1>
          <p className="mt-1 text-red-400">{result.error}</p>
        </div>
      </div>
    );
  }

  const pendingCount = result.filter((a) => a.status === "pending").length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-sand-100">Applications</h1>
        <p className="mt-1 text-sand-400">
          Review and vote on membership applications.
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-medium text-amber">
              {pendingCount} pending
            </span>
          )}
        </p>
      </div>

      <ApplicationReview applications={result} userRole={profile!.role} />
    </div>
  );
}
