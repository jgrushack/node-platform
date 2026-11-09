import Link from "next/link";
import { getNodesgiving } from "@/lib/actions/nodesgiving";
import { NodesgivingClient } from "./nodesgiving-client";

export default async function NodesgivingPage() {
  const result = await getNodesgiving();
  if ("error" in result) return (
    <div className="space-y-4 text-sand-200">
      <h1 className="text-3xl font-bold">Nodesgiving</h1>
      <p role="alert">{result.error}</p>
      <Link className="text-pink-400 underline" href="/dashboard/nodesgiving">Try again</Link>
    </div>
  );
  return <NodesgivingClient initial={result} />;
}
