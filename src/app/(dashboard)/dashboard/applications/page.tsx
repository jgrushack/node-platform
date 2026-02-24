import { getApplications } from "@/lib/actions/applications";
import { ApplicationReview } from "./application-review";

export default async function DashboardApplicationsPage() {
  const result = await getApplications();

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
          Review and manage membership applications.
          {pendingCount > 0 && (
            <span className="ml-2 inline-flex items-center rounded-full bg-amber/20 px-2.5 py-0.5 text-xs font-medium text-amber">
              {pendingCount} pending
            </span>
          )}
        </p>
      </div>

      <ApplicationReview applications={result} />
    </div>
  );
}
