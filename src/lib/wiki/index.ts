import content from "./wiki-content.json";

export type WikiPage = {
  slug: string;
  title: string;
  html: string;
  needsUpdate: number;
  todos: number;
};

export type WikiSection = {
  id: number;
  title: string;
  pages: WikiPage[];
};

export type WikiContent = {
  generatedAt: string;
  sectionCount: number;
  pageCount: number;
  sections: WikiSection[];
};

// A review suggestion left on a wiki page. Defined here (not in the "use server"
// actions file) because server-action modules may only export async functions.
export type WikiSuggestion = {
  id: string;
  page_slug: string;
  page_title: string;
  section_title: string | null;
  kind: "comment" | "edit" | "delete";
  body: string | null;
  selected_text: string | null;
  suggested_text: string | null;
  status: "open" | "resolved";
  author_id: string | null;
  author_name: string | null;
  created_at: string;
  resolved_at: string | null;
  resolved_by: string | null;
};

export const wikiContent = content as WikiContent;
export const wikiSections = wikiContent.sections;
