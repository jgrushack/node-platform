import { getJobsBoard } from "@/lib/actions/jobs";
import { DaySheetClient } from "./day-sheet-client";

// Attendance is live data — always render fresh.
export const dynamic = "force-dynamic";

export default async function DaySheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const initial = await getJobsBoard();
  const requested =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
  const resolvedDate =
    requested ?? ("error" in initial ? "" : initial.todayPlaya);
  return <DaySheetClient initial={initial} date={resolvedDate} />;
}
