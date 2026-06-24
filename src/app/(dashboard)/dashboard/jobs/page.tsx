import { getJobsBoard } from "@/lib/actions/jobs";
import { JobsClient } from "./jobs-client";

// The board reads live signups/rosters, so render fresh on each request.
export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const initial = await getJobsBoard();
  return <JobsClient initial={initial} />;
}
