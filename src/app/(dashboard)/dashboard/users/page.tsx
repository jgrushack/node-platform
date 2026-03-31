import { getUsers, getCommitteeRequests } from "@/lib/actions/users";
import { createClient } from "@/lib/supabase/server";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const [usersResult, requestsResult] = await Promise.all([
    getUsers(),
    getCommitteeRequests(),
  ]);

  if ("error" in usersResult) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-400">{usersResult.error}</p>
      </div>
    );
  }

  // Fetch registration years per user
  const supabase = await createClient();
  const { data: regs } = await supabase
    .from("registrations")
    .select("profile_id, camp_years(year)")
    .neq("status", "cancelled");

  const yearsByUser: Record<string, number[]> = {};
  for (const r of regs || []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const year = (r as any).camp_years?.year;
    if (year) {
      if (!yearsByUser[r.profile_id]) yearsByUser[r.profile_id] = [];
      if (!yearsByUser[r.profile_id].includes(year)) yearsByUser[r.profile_id].push(year);
    }
  }

  const committeeRequests = "error" in requestsResult ? [] : requestsResult;

  return (
    <UsersClient
      initialUsers={usersResult}
      initialCommitteeRequests={committeeRequests}
      yearsByUser={yearsByUser}
    />
  );
}
