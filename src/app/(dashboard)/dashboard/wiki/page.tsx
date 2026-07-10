import { wikiSections } from "@/lib/wiki";
import { listWikiSuggestions } from "@/lib/actions/wiki-suggestions";
import WikiClient from "./wiki-client";

export const metadata = { title: "Camp Wiki | NODE" };

export default async function WikiPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const [sp, suggestions] = await Promise.all([
    searchParams,
    listWikiSuggestions(),
  ]);
  return (
    <WikiClient
      sections={wikiSections}
      suggestions={suggestions}
      initialSlug={sp?.p ?? null}
    />
  );
}
