import { getApplications } from "@/lib/actions/applications";
import { ApplicationsTable } from "./applications-table";

export default async function ApplicationsPage() {
  const applications = await getApplications();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-sand-100">Applications</h1>
        <p className="mt-1 text-sand-400">
          Review and manage membership applications.
        </p>
      </div>

      <ApplicationsTable applications={applications} />
    </div>
  );
}
