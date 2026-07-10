"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Check, RotateCcw, Trash2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { WikiSection, WikiSuggestion } from "@/lib/wiki";
import {
  setWikiSuggestionStatus,
  deleteWikiSuggestion,
} from "@/lib/actions/wiki-suggestions";

type Filter = "open" | "resolved" | "all";

function kindClass(kind: WikiSuggestion["kind"]) {
  return kind === "delete"
    ? "bg-red-500/20 text-red-300"
    : kind === "edit"
      ? "bg-blue-500/20 text-blue-300"
      : "bg-pink-500/20 text-pink-300";
}

export default function WikiReviewClient({
  suggestions,
  sections,
}: {
  suggestions: WikiSuggestion[];
  sections: WikiSection[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("open");
  const [busy, setBusy] = useState<string | null>(null);

  const order = useMemo(
    () => sections.flatMap((s) => s.pages.map((p) => p.slug)),
    [sections]
  );

  const groups = useMemo(() => {
    const filtered = suggestions.filter((s) =>
      filter === "all" ? true : s.status === filter
    );
    const m: Record<string, WikiSuggestion[]> = {};
    for (const s of filtered) (m[s.page_slug] ??= []).push(s);
    return Object.entries(m).sort(
      (a, b) => order.indexOf(a[0]) - order.indexOf(b[0])
    );
  }, [suggestions, filter, order]);

  const counts = {
    open: suggestions.filter((s) => s.status === "open").length,
    resolved: suggestions.filter((s) => s.status === "resolved").length,
    all: suggestions.length,
  };

  async function toggle(id: string, status: "open" | "resolved") {
    setBusy(id);
    const res = await setWikiSuggestionStatus(id, status);
    setBusy(null);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    router.refresh();
  }

  async function remove(id: string) {
    setBusy(id);
    const res = await deleteWikiSuggestion(id);
    setBusy(null);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success("Deleted");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/wiki"
          className="mb-1 flex w-fit items-center gap-1 text-sm text-sand-300 hover:text-sand-100"
        >
          <ArrowLeft className="h-4 w-4" /> Back to wiki
        </Link>
        <h1 className="text-2xl font-bold text-sand-100">Wiki suggestions</h1>
        <p className="text-sm text-sand-300">
          Comments, edit proposals, and delete requests from members.
        </p>
      </div>

      <div className="mb-5 flex gap-2">
        {(["open", "resolved", "all"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-sm capitalize transition-colors ${
              filter === f
                ? "bg-pink-500/20 text-pink-300"
                : "text-sand-300 hover:bg-pink-500/5"
            }`}
          >
            {f} ({counts[f]})
          </button>
        ))}
      </div>

      {groups.length === 0 ? (
        <p className="text-sand-300">
          No {filter === "all" ? "" : filter} suggestions yet.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(([slug, items]) => (
            <div key={slug}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-sm font-semibold text-sand-200">
                  {items[0]?.page_title ?? slug}
                </h2>
                <Link
                  href={`/dashboard/wiki?p=${slug}`}
                  className="text-sand-300 hover:text-pink-300"
                  title="Open this page"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>
              <ul className="space-y-2">
                {items.map((s) => (
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
                      <p className="mb-2 whitespace-pre-wrap text-sm text-sand-200">
                        {s.body}
                      </p>
                    )}

                    <div className="flex gap-2">
                      {s.status === "open" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          disabled={busy === s.id}
                          onClick={() => toggle(s.id, "resolved")}
                        >
                          <Check className="h-3.5 w-3.5" /> Resolve
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="gap-1.5"
                          disabled={busy === s.id}
                          onClick={() => toggle(s.id, "open")}
                        >
                          <RotateCcw className="h-3.5 w-3.5" /> Reopen
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="gap-1.5 text-red-300 hover:text-red-200"
                        disabled={busy === s.id}
                        onClick={() => remove(s.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
