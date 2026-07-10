"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { WikiSuggestion } from "@/lib/wiki";

const createSchema = z.object({
  pageSlug: z.string().min(1),
  pageTitle: z.string().min(1),
  sectionTitle: z.string().nullish(),
  kind: z.enum(["comment", "edit", "delete"]),
  body: z.string().max(5000).nullish(),
  selectedText: z.string().max(5000).nullish(),
  suggestedText: z.string().max(5000).nullish(),
});

type CreateWikiSuggestionInput = z.infer<typeof createSchema>;

export async function createWikiSuggestion(input: CreateWikiSuggestionInput) {
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid input" };
  const d = parsed.data;

  // Comments and edits need some content; a delete suggestion can be bare.
  if (
    (d.kind === "comment" || d.kind === "edit") &&
    !d.body?.trim() &&
    !d.suggestedText?.trim()
  ) {
    return { error: "Please add a note." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const authorName =
    (user.user_metadata?.full_name as string | undefined) || user.email || "Member";

  const { error } = await supabase.from("wiki_suggestions").insert({
    page_slug: d.pageSlug,
    page_title: d.pageTitle,
    section_title: d.sectionTitle ?? null,
    kind: d.kind,
    body: d.body?.trim() || null,
    selected_text: d.selectedText?.trim() || null,
    suggested_text: d.suggestedText?.trim() || null,
    author_id: user.id,
    author_name: authorName,
  });
  if (error) return { error: error.message };

  revalidatePath("/dashboard/wiki");
  revalidatePath("/dashboard/wiki/review");
  return { ok: true };
}

export async function listWikiSuggestions(): Promise<WikiSuggestion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("wiki_suggestions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return [];
  return (data ?? []) as WikiSuggestion[];
}

export async function setWikiSuggestionStatus(
  id: string,
  status: "open" | "resolved"
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You must be signed in." };

  const patch =
    status === "resolved"
      ? { status, resolved_at: new Date().toISOString(), resolved_by: user.id }
      : { status, resolved_at: null, resolved_by: null };

  const { error } = await supabase
    .from("wiki_suggestions")
    .update(patch)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/wiki");
  revalidatePath("/dashboard/wiki/review");
  return { ok: true };
}

export async function deleteWikiSuggestion(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("wiki_suggestions")
    .delete()
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/dashboard/wiki");
  revalidatePath("/dashboard/wiki/review");
  return { ok: true };
}
