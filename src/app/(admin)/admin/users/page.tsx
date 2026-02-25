import { getUsers } from "@/lib/actions/users";
import { UsersClient } from "./users-client";

export default async function UsersPage() {
  const result = await getUsers();

  if ("error" in result) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-red-400">{result.error}</p>
      </div>
    );
  }

  return <UsersClient initialUsers={result} />;
}
