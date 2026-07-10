"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  MessageSquarePlus,
  PencilLine,
  Trash2,
  ListChecks,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { WikiSection, WikiSuggestion } from "@/lib/wiki";
import { createWikiSuggestion } from "@/lib/actions/wiki-suggestions";

type Kind = "comment" | "edit" | "delete";

const PROSE =
  "max-w-none text-[15px] leading-relaxed text-sand-200 " +
  "[&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-sand-100 " +
  "[&_h4]:mt-4 [&_h4]:mb-1 [&_h4]:font-semibold [&_h4]:text-sand-100 " +
  "[&_p]:my-3 " +
  "[&_ul]:my-3 [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:my-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1 " +
  "[&_a]:text-pink-400 [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-pink-300 " +
  "[&_strong]:font-semibold [&_strong]:text-sand-100 [&_em]:italic " +
  "[&_blockquote]:my-3 [&_blockquote]:border-l-2 [&_blockquote]:border-pink-500/40 [&_blockquote]:pl-4 [&_blockquote]:text-sand-300 " +
  "[&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_table]:text-sm " +
  "[&_th]:border [&_th]:border-pink-500/20 [&_th]:bg-pink-500/5 [&_th]:p-2 [&_th]:text-left [&_th]:text-sand-100 " +
  "[&_td]:border [&_td]:border-pink-500/10 [&_td]:p-2 [&_td]:align-top " +
  "[&_hr]:my-6 [&_hr]:border-pink-500/10 " +
  "[&_code]:rounded [&_code]:bg-white/5 [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-pink-300 " +
  "[&_input]:mr-2 [&_input]:align-middle";

function kindClass(kind: Kind) {
  return kind === "delete"
    ? "bg-red-500/20 text-red-300"
    : kind === "edit"
      ? "bg-blue-500/20 text-blue-300"
      : "bg-pink-500/20 text-pink-300";
}

export default function WikiClient({
  sections,
  suggestions,
  initialSlug,
}: {
  sections: WikiSection[];
  suggestions: WikiSuggestion[];
  initialSlug: string | null;
}) {
  const router = useRouter();

  const pages = useMemo(
    () =>
      sections.flatMap((s) =>
        s.pages.map((p) => ({ ...p, section: s.title }))
      ),
    [sections]
  );

  const [activeSlug, setActiveSlug] = useState<string>(
    initialSlug && pages.some((p) => p.slug === initialSlug)
      ? initialSlug
      : pages[0]?.slug ?? ""
  );
  const active = pages.find((p) => p.slug === activeSlug) ?? pages[0];

  const [dialogKind, setDialogKind] = useState<Kind | null>(null);
  const [body, setBody] = useState("");
  const [selectedText, setSelectedText] = useState("");
  const [suggestedText, setSuggestedText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const byPage = useMemo(() => {
    const m: Record<string, WikiSuggestion[]> = {};
    for (const s of suggestions) (m[s.page_slug] ??= []).push(s);
    return m;
  }, [suggestions]);

  const openCount = suggestions.filter((s) => s.status === "open").length;
  const pageSuggestions = byPage[active?.slug ?? ""] ?? [];

  function openDialog(kind: Kind) {
    setDialogKind(kind);
    setBody("");
    setSelectedText("");
    setSuggestedText("");
  }

  function selectPage(slug: string) {
    setActiveSlug(slug);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  async function submit() {
    if (!active || !dialogKind) return;
    setSubmitting(true);
    const res = await createWikiSuggestion({
      pageSlug: active.slug,
      pageTitle: active.title,
      sectionTitle: active.section,
      kind: dialogKind,
      body,
      selectedText,
      suggestedText,
    });
    setSubmitting(false);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(dialogKind === "delete" ? "Delete suggested" : "Suggestion added");
    setDialogKind(null);
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-sand-100">Camp Wiki</h1>
          <p className="text-sm text-sand-300">
            Draft for review. On any page you can comment, suggest an edit, or flag it for deletion.
          </p>
        </div>
        <Link href="/dashboard/wiki/review">
          <Button variant="outline" className="gap-2">
            <ListChecks className="h-4 w-4" />
            Review suggestions
            {openCount > 0 && (
              <Badge className="ml-1 bg-pink-500/20 text-pink-300">{openCount}</Badge>
            )}
          </Button>
        </Link>
      </div>

      {/* Mobile page picker */}
      <div className="mb-4 md:hidden">
        <select
          value={activeSlug}
          onChange={(e) => selectPage(e.target.value)}
          className="w-full rounded-lg border border-pink-500/20 bg-transparent px-3 py-2 text-sand-100"
        >
          {sections.map((s) => (
            <optgroup key={s.id} label={s.title}>
              {s.pages.map((p) => (
                <option key={p.slug} value={p.slug} className="bg-black text-sand-100">
                  {p.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <div className="grid gap-6 md:grid-cols-[240px_1fr]">
        {/* Sidebar nav */}
        <nav className="hidden md:block">
          <div className="sticky top-4 space-y-4">
            {sections.map((s) => (
              <div key={s.id}>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-sand-300">
                  {s.title}
                </p>
                <ul className="space-y-0.5">
                  {s.pages.map((p) => {
                    const n = (byPage[p.slug] ?? []).filter(
                      (x) => x.status === "open"
                    ).length;
                    const isActive = p.slug === activeSlug;
                    return (
                      <li key={p.slug}>
                        <button
                          onClick={() => selectPage(p.slug)}
                          className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
                            isActive
                              ? "bg-pink-500/15 text-pink-300"
                              : "text-sand-300 hover:bg-pink-500/5 hover:text-sand-100"
                          }`}
                        >
                          <span>{p.title}</span>
                          {n > 0 && (
                            <span className="rounded-full bg-pink-500/20 px-1.5 text-[10px] text-pink-300">
                              {n}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>

        {/* Content */}
        <div className="min-w-0">
          {active && (
            <>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <h2 className="mr-auto text-xl font-bold text-sand-100">
                  {active.title}
                </h2>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openDialog("comment")}
                >
                  <MessageSquarePlus className="h-4 w-4" /> Comment
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => openDialog("edit")}
                >
                  <PencilLine className="h-4 w-4" /> Suggest edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-red-300 hover:text-red-200"
                  onClick={() => openDialog("delete")}
                >
                  <Trash2 className="h-4 w-4" /> Suggest delete
                </Button>
              </div>

              {active.needsUpdate > 0 && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber/30 bg-amber/10 px-3 py-2 text-sm text-amber">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {active.needsUpdate} spot{active.needsUpdate !== 1 ? "s" : ""} on this
                  page still need current info (look for [NEEDS UPDATE]).
                </div>
              )}

              <article
                className={PROSE}
                dangerouslySetInnerHTML={{ __html: active.html }}
              />

              {/* Existing suggestions on this page */}
              <div className="mt-8 border-t border-pink-500/10 pt-4">
                <h3 className="mb-3 text-sm font-semibold text-sand-200">
                  Suggestions on this page ({pageSuggestions.length})
                </h3>
                {pageSuggestions.length === 0 ? (
                  <p className="text-sm text-sand-300">No suggestions yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {pageSuggestions.map((s) => (
                      <li
                        key={s.id}
                        className="rounded-lg border border-pink-500/10 bg-white/[0.02] p-3"
                      >
                        <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-sand-300">
                          <Badge className={kindClass(s.kind)}>{s.kind}</Badge>
                          {s.status === "resolved" && (
                            <Badge className="bg-emerald-500/20 text-emerald-300">
                              resolved
                            </Badge>
                          )}
                          <span>{s.author_name ?? "Member"}</span>
                          <span>&middot;</span>
                          <span>{new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                        {s.kind === "edit" && (s.selected_text || s.suggested_text) && (
                          <div className="mb-1 space-y-0.5 text-sm">
                            {s.selected_text && (
                              <p className="text-sand-300 line-through">
                                {s.selected_text}
                              </p>
                            )}
                            {s.suggested_text && (
                              <p className="text-sand-100">{s.suggested_text}</p>
                            )}
                          </div>
                        )}
                        {s.body && (
                          <p className="whitespace-pre-wrap text-sm text-sand-200">
                            {s.body}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Suggestion dialog */}
      <Dialog
        open={dialogKind !== null}
        onOpenChange={(o) => !o && setDialogKind(null)}
      >
        <DialogContent className="glass">
          <DialogHeader>
            <DialogTitle>
              {dialogKind === "comment" && "Add a comment"}
              {dialogKind === "edit" && "Suggest an edit"}
              {dialogKind === "delete" && "Suggest deleting this page"}
            </DialogTitle>
          </DialogHeader>
          <p className="-mt-1 text-sm text-sand-300">{active?.title}</p>

          {dialogKind === "edit" ? (
            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-sand-300">
                  Text to change (optional)
                </label>
                <Textarea
                  value={selectedText}
                  onChange={(e) => setSelectedText(e.target.value)}
                  placeholder="Paste the wording you want changed"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-sand-300">
                  Proposed replacement
                </label>
                <Textarea
                  value={suggestedText}
                  onChange={(e) => setSuggestedText(e.target.value)}
                  placeholder="What it should say instead"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-sand-300">
                  Why (optional)
                </label>
                <Textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Reason or context"
                />
              </div>
            </div>
          ) : (
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder={
                dialogKind === "delete"
                  ? "Why should this page be removed? (optional)"
                  : "Your comment..."
              }
            />
          )}

          <div className="mt-2 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialogKind(null)}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={submitting}>
              {submitting
                ? "Saving..."
                : dialogKind === "delete"
                  ? "Suggest delete"
                  : "Submit"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
