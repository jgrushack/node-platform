import { wikiSections } from "@/lib/wiki";
import { listWikiSuggestions } from "@/lib/actions/wiki-suggestions";
import WikiReviewClient from "./wiki-review-client";

export const metadata = { title: "Wiki Suggestions | NODE" };

export default async function WikiReviewPage() {
  const suggestions = await listWikiSuggestions();
  return <WikiReviewClient suggestions={suggestions} sections={wikiSections} />;
}
