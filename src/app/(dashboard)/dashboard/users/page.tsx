import { getUsers, getCommitteeRequests } from "@/lib/actions/users";
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

  const committeeRequests = "error" in requestsResult ? [] : requestsResult;

  return (
    <UsersClient
      initialUsers={usersResult}
      initialCommitteeRequests={committeeRequests}
    />
  );
}
