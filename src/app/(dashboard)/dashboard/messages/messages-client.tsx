"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { toast } from "sonner";
import {
  Send,
  Loader2,
  Mail,
  Users,
  ChevronDown,
  ChevronUp,
  Eye,
  PenSquare,
  Save,
  FileText,
  Trash2,
  MonitorSmartphone,
  Bold,
  Italic,
  Underline,
  Heading1,
  Heading2,
  Link,
  Minus,
  Palette,
  List,
} from "lucide-react";
import type { CampMessage, AudienceFilter, RecipientPreview, UnreadMessage } from "@/lib/types/message";
import {
  previewRecipients,
  sendMessage,
  markMessageRead,
  saveDraft,
  updateDraft,
  deleteDraft,
  deleteMessage,
  getEmailPreview,
} from "@/lib/actions/messages";

const NODE_YEARS = [2017, 2018, 2019, 2022, 2023, 2024, 2025, 2026];

function audienceLabel(filter: AudienceFilter): string {
  if (filter.type === "all") return "All active members";
  if (filter.type === "custom") return `${filter.profile_ids?.length || 0} selected members`;
  const parts: string[] = [];
  if (filter.registration_years?.length) parts.push(`Years: ${filter.registration_years.join(", ")}`);
  if (filter.roles?.length) parts.push(`Roles: ${filter.roles.join(", ")}`);
  if (filter.is_committee_member) parts.push("Committee");
  if (filter.is_build_crew) parts.push("Build crew");
  if (filter.tenure) parts.push(filter.tenure === "og" ? "OG (7+)" : filter.tenure === "veteran" ? "Veteran (5+)" : "First-year");
  if (filter.onboarding_incomplete) parts.push("Onboarding incomplete");
  return parts.join(" \u00b7 ") || "Filtered";
}

export function MessagesClient({
  isAdmin,
  initialSentMessages,
  initialDrafts,
  initialMyMessages,
}: {
  isAdmin: boolean;
  initialSentMessages: CampMessage[];
  initialDrafts: CampMessage[];
  initialMyMessages: UnreadMessage[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"inbox" | "drafts" | "sent" | "compose">(isAdmin ? "drafts" : "inbox");
  const [sentMessages, setSentMessages] = useState(initialSentMessages);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [myMessages, setMyMessages] = useState(initialMyMessages);
  const [readingMessage, setReadingMessage] = useState<UnreadMessage | null>(null);

  // Compose state
  const editorRef = useRef<HTMLDivElement>(null);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [filterType, setFilterType] = useState<"all" | "filtered">("all");
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [isCommittee, setIsCommittee] = useState(false);
  const [isBuildCrew, setIsBuildCrew] = useState(false);
  const [tenure, setTenure] = useState<string>("");
  const [onboardingIncomplete, setOnboardingIncomplete] = useState(false);

  // Preview state
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<RecipientPreview[] | null>(null);
  const [previewExpanded, setPreviewExpanded] = useState(false);

  // Color picker
  const [colorPickerOpen, setColorPickerOpen] = useState(false);

  // Email preview
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string | null>(null);
  const [emailPreviewLoading, setEmailPreviewLoading] = useState(false);

  // Actions
  const [autosaveStatus, setAutosaveStatus] = useState<"saved" | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function buildFilter(): AudienceFilter {
    if (filterType === "all") return { type: "all" };
    return {
      type: "filtered",
      registration_years: selectedYears.length ? selectedYears : undefined,
      roles: selectedRoles.length ? selectedRoles as AudienceFilter["roles"] : undefined,
      is_committee_member: isCommittee || undefined,
      is_build_crew: isBuildCrew || undefined,
      tenure: (tenure || undefined) as AudienceFilter["tenure"],
      onboarding_incomplete: onboardingIncomplete || undefined,
    };
  }

  function loadDraftIntoCompose(draft: CampMessage) {
    setEditingDraftId(draft.id);
    setSubject(draft.subject);
    // Use requestAnimationFrame to ensure editor is mounted when switching to compose tab
    requestAnimationFrame(() => setEditorContent(draft.body_html));
    const f = draft.audience_filter;
    setFilterType(f.type === "filtered" ? "filtered" : "all");
    setSelectedYears(f.registration_years || []);
    setSelectedRoles(f.roles || []);
    setIsCommittee(f.is_committee_member || false);
    setIsBuildCrew(f.is_build_crew || false);
    setTenure(f.tenure || "");
    setOnboardingIncomplete(f.onboarding_incomplete || false);
    setPreviewResult(null);
    setTab("compose");
  }

  function resetCompose() {
    setEditingDraftId(null);
    setSubject("");
    setEditorContent("");
    setFilterType("all");
    setSelectedYears([]);
    setSelectedRoles([]);
    setIsCommittee(false);
    setIsBuildCrew(false);
    setTenure("");
    setOnboardingIncomplete(false);
    setPreviewResult(null);
  }

  async function handlePreview() {
    setPreviewing(true);
    setPreviewResult(null);
    const result = await previewRecipients(buildFilter());
    setPreviewing(false);
    if ("error" in result) { toast.error(result.error); return; }
    setPreviewResult(result.recipients);
    setPreviewExpanded(false);
  }

  async function handleEmailPreview() {
    if (!subject.trim() && !bodyHtml.trim()) { toast.error("Add a subject or message first."); return; }
    setEmailPreviewLoading(true);
    const result = await getEmailPreview(subject || "(No subject)", bodyHtml || "");
    setEmailPreviewLoading(false);
    if ("error" in result) { toast.error(result.error); return; }
    setEmailPreviewHtml(result.html);
  }

  /** Update the local drafts list to reflect current compose state */
  function upsertLocalDraft(id: string) {
    const now = new Date().toISOString();
    const draftData: CampMessage = {
      id,
      subject,
      body_html: bodyHtml,
      audience_filter: buildFilter(),
      sent_by: "",
      recipient_count: 0,
      status: "draft",
      sent_at: now,
      created_at: now,
      updated_by: null,
      updated_at: now,
    };
    setDrafts((prev) => {
      const exists = prev.some((d) => d.id === id);
      if (exists) return prev.map((d) => d.id === id ? { ...d, ...draftData } : d);
      return [draftData, ...prev];
    });
  }

  async function handleSaveDraft() {
    setSaving(true);
    const payload = { subject, body_html: bodyHtml, audience_filter: buildFilter() };
    if (editingDraftId) {
      const result = await updateDraft(editingDraftId, payload);
      setSaving(false);
      if ("error" in result) { toast.error(result.error); return; }
      upsertLocalDraft(editingDraftId);
      toast.success("Draft updated");
    } else {
      const result = await saveDraft(payload);
      setSaving(false);
      if ("error" in result) { toast.error(result.error); return; }
      setEditingDraftId(result.id);
      upsertLocalDraft(result.id);
      toast.success("Draft saved");
    }
  }

  async function handleSend() {
    setConfirmOpen(false);
    setSending(true);
    const result = await sendMessage(
      { subject, body_html: bodyHtml, audience_filter: buildFilter() },
      editingDraftId || undefined
    );
    setSending(false);
    if ("error" in result) { toast.error(result.error); return; }
    toast.success(`Message sent to ${result.sent} recipient${result.sent !== 1 ? "s" : ""}${result.failed ? ` (${result.failed} failed)` : ""}`);
    // Remove from drafts if it was a draft
    if (editingDraftId) {
      setDrafts((prev) => prev.filter((d) => d.id !== editingDraftId));
    }
    // Add to sent list locally
    const now = new Date().toISOString();
    setSentMessages((prev) => [{
      id: result.messageId,
      subject,
      body_html: bodyHtml,
      audience_filter: buildFilter(),
      sent_by: "",
      recipient_count: result.sent,
      status: "sent" as const,
      sent_at: now,
      created_at: now,
      updated_by: null,
      updated_at: now,
    }, ...prev]);
    resetCompose();
    setTab("sent");
  }

  async function handleDeleteDraft(id: string) {
    setDeletingId(id);
    const result = await deleteDraft(id);
    setDeletingId(null);
    if ("error" in result) { toast.error(result.error); return; }
    setDrafts((prev) => prev.filter((d) => d.id !== id));
    if (editingDraftId === id) resetCompose();
    toast.success("Draft deleted");
  }

  async function handleDeleteMessage(id: string) {
    setDeletingId(id);
    const result = await deleteMessage(id);
    setDeletingId(null);
    if ("error" in result) { toast.error(result.error); return; }
    setSentMessages((prev) => prev.filter((m) => m.id !== id));
    toast.success("Message deleted");
  }

  async function handleReadMessage(msg: UnreadMessage) {
    setReadingMessage(msg);
    if (!msg.read_at) {
      await markMessageRead(msg.id);
      setMyMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, read_at: new Date().toISOString() } : m)));
    }
  }

  function toggleYear(year: number) { setSelectedYears((prev) => prev.includes(year) ? prev.filter((y) => y !== year) : [...prev, year]); setPreviewResult(null); }
  function toggleRole(role: string) { setSelectedRoles((prev) => prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]); setPreviewResult(null); }

  /** Sync React state from contentEditable */
  const syncEditor = useCallback(() => {
    if (editorRef.current) setBodyHtml(editorRef.current.innerHTML);
  }, []);

  /** Run an execCommand on the contentEditable editor (preserves undo) */
  const execCmd = useCallback((cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    if (editorRef.current) setBodyHtml(editorRef.current.innerHTML);
  }, []);

  /** Set editor content when loading a draft — content is admin-authored (trusted) */
  const setEditorContent = useCallback((html: string) => {
    if (editorRef.current) {
      // Safe: content is authored by admins, stored in our DB
      const el = editorRef.current;
      el.textContent = "";
      if (html) {
        const range = document.createRange();
        const frag = range.createContextualFragment(html);
        el.appendChild(frag);
      }
    }
    setBodyHtml(html);
  }, []);

  const unreadCount = myMessages.filter((m) => !m.read_at).length;

  // Autosave draft every 3 seconds after changes (only on compose tab)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef({ subject: "", bodyHtml: "" });

  useEffect(() => {
    if (tab !== "compose" || !isAdmin) return;
    if (!subject.trim() && !bodyHtml.trim()) return;
    // Skip if nothing changed since last save
    if (subject === lastSavedRef.current.subject && bodyHtml === lastSavedRef.current.bodyHtml) return;

    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(async () => {
      const payload = { subject, body_html: bodyHtml, audience_filter: buildFilter() };
      if (editingDraftId) {
        await updateDraft(editingDraftId, payload);
        upsertLocalDraft(editingDraftId);
      } else {
        const result = await saveDraft(payload);
        if ("success" in result) {
          setEditingDraftId(result.id);
          upsertLocalDraft(result.id);
        }
      }
      lastSavedRef.current = { subject, bodyHtml };
      setAutosaveStatus("saved");
      setTimeout(() => setAutosaveStatus(null), 2000);
    }, 3000);

    return () => { if (autosaveTimer.current) clearTimeout(autosaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, bodyHtml, tab]);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl font-bold text-sand-100">Messages</h1>
        <p className="mt-1 text-sand-400">{isAdmin ? "Compose, draft, and send messages to camp members." : "Messages from NODE camp leadership."}</p>
      </motion.div>

      {/* Tab bar */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" className={tab === "inbox" ? "bg-pink-500/15 text-pink-400 border-transparent" : "text-sand-400 border-transparent hover:text-sand-200"} onClick={() => setTab("inbox")}>
          <Mail className="mr-1.5 h-3.5 w-3.5" /> Inbox {unreadCount > 0 && <Badge className="ml-1.5 bg-pink-500/20 text-pink-400 text-[10px]">{unreadCount}</Badge>}
        </Button>
        {isAdmin && (<>
          <Button variant="outline" size="sm" className={tab === "drafts" ? "bg-pink-500/15 text-pink-400 border-transparent" : "text-sand-400 border-transparent hover:text-sand-200"} onClick={() => setTab("drafts")}>
            <FileText className="mr-1.5 h-3.5 w-3.5" /> Drafts {drafts.length > 0 && <Badge className="ml-1.5 bg-amber/20 text-amber text-[10px]">{drafts.length}</Badge>}
          </Button>
          <Button variant="outline" size="sm" className={tab === "sent" ? "bg-pink-500/15 text-pink-400 border-transparent" : "text-sand-400 border-transparent hover:text-sand-200"} onClick={() => setTab("sent")}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Sent ({sentMessages.length})
          </Button>
          <Button variant="outline" size="sm" className={tab === "compose" ? "bg-pink-500/15 text-pink-400 border-transparent" : "text-sand-400 border-transparent hover:text-sand-200"} onClick={() => { resetCompose(); setTab("compose"); }}>
            <PenSquare className="mr-1.5 h-3.5 w-3.5" /> New Message
          </Button>
        </>)}
      </div>

      {/* ── INBOX ── */}
      {tab === "inbox" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          {myMessages.length === 0 ? (
            <Card className="glass-card border-0"><CardContent className="py-12 text-center text-sand-500">No messages yet.</CardContent></Card>
          ) : myMessages.map((msg) => {
            const isRead = !!msg.read_at;
            return (
              <Card key={msg.id} className={`glass-card border-0 cursor-pointer transition-colors hover:bg-pink-500/5 ${!isRead ? "border-l-2 border-l-pink-500/50" : ""}`}>
                <CardContent className="flex items-center gap-4 p-4">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${isRead ? "bg-transparent" : "bg-pink-500"}`} onClick={() => handleReadMessage(msg)} />
                  <div className="min-w-0 flex-1" onClick={() => handleReadMessage(msg)}>
                    <p className={`text-sm truncate ${isRead ? "text-sand-300" : "text-sand-100 font-semibold"}`}>{msg.subject}</p>
                    <p className="text-xs text-sand-500 mt-0.5">From {msg.sender_name} &middot; {new Date(msg.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                  </div>
                  {!isRead && <Badge className="shrink-0 bg-pink-500/20 text-pink-400 text-[10px]">New</Badge>}
                  {isAdmin && (
                    <Button variant="ghost" size="sm" className="h-7 shrink-0 text-sand-400 hover:text-red-400" onClick={(e) => { e.stopPropagation(); handleDeleteMessage(msg.message_id); setMyMessages((prev) => prev.filter((m) => m.message_id !== msg.message_id)); }} disabled={deletingId === msg.message_id}>
                      {deletingId === msg.message_id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </motion.div>
      )}

      {/* ── DRAFTS ── */}
      {tab === "drafts" && isAdmin && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card border-0 overflow-hidden">
            {drafts.length === 0 ? (
              <CardContent className="py-12 text-center text-sand-500">No drafts. Click &quot;New Message&quot; to start composing.</CardContent>
            ) : (
              <div className="divide-y divide-pink-500/10">
                {drafts.map((draft) => (
                  <div key={draft.id} className="flex items-center gap-4 px-4 py-3 hover:bg-pink-500/5 transition-colors">
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => loadDraftIntoCompose(draft)}>
                      <p className="text-sm font-medium text-sand-100 truncate">{draft.subject || "(No subject)"}</p>
                      <p className="text-xs text-sand-500 mt-0.5">
                        {audienceLabel(draft.audience_filter)}
                        {draft.updater && ` \u00b7 Last edited by ${[draft.updater.first_name, draft.updater.last_name].filter(Boolean).join(" ")}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <p className="text-xs text-sand-500">{new Date(draft.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</p>
                      <Button variant="ghost" size="sm" className="h-7 text-sand-400 hover:text-pink-400" onClick={() => loadDraftIntoCompose(draft)}>
                        <PenSquare className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-sand-400 hover:text-red-400" onClick={() => handleDeleteDraft(draft.id)} disabled={deletingId === draft.id}>
                        {deletingId === draft.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── SENT ── */}
      {tab === "sent" && isAdmin && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-card border-0 overflow-hidden">
            {sentMessages.length === 0 ? (
              <CardContent className="py-12 text-center text-sand-500">No messages sent yet.</CardContent>
            ) : (
              <div className="divide-y divide-pink-500/10">
                {sentMessages.map((msg) => (
                  <div key={msg.id} className="flex items-center gap-4 px-4 py-3 hover:bg-pink-500/5 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-sand-100 truncate">{msg.subject}</p>
                      <p className="text-xs text-sand-500 mt-0.5">{audienceLabel(msg.audience_filter)} &middot; {msg.recipient_count} recipient{msg.recipient_count !== 1 ? "s" : ""}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-sand-500">{new Date(msg.sent_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                        <p className="text-[10px] text-sand-600">by {msg.sender ? [msg.sender.first_name, msg.sender.last_name].filter(Boolean).join(" ") : "Admin"}</p>
                      </div>
                      <Button variant="ghost" size="sm" className="h-7 text-sand-400 hover:text-red-400" onClick={() => handleDeleteMessage(msg.id)} disabled={deletingId === msg.id}>
                        {deletingId === msg.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      )}

      {/* ── COMPOSE ── */}
      {tab === "compose" && isAdmin && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {editingDraftId && (
            <div className="flex items-center gap-2 text-sm text-amber">
              <FileText className="h-4 w-4" />
              <span>Editing draft</span>
              <Button variant="ghost" size="sm" className="h-6 text-xs text-sand-400 hover:text-sand-200" onClick={() => { resetCompose(); }}>Start fresh</Button>
            </div>
          )}

          <Card className="glass-card border-0">
            <CardHeader className="pb-3"><CardTitle className="text-sm font-medium text-sand-400">Compose Message</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-sand-300">Subject</Label>
                <Input placeholder="e.g. Build Week Update, Dues Reminder..." value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
              </div>
              <div className="space-y-0">
                <Label className="text-sand-300 mb-2 block">Message</Label>
                {/* Formatting toolbar — onMouseDown preventDefault keeps focus in editor */}
                <div className="flex flex-wrap items-center gap-1 rounded-t-lg border border-b-0 border-pink-500/20 bg-pink-500/5 px-2 py-1.5">
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("bold"); }} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Bold (Ctrl+B)"><Bold className="h-4 w-4" /></button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("italic"); }} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Italic (Ctrl+I)"><Italic className="h-4 w-4" /></button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("underline"); }} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Underline (Ctrl+U)"><Underline className="h-4 w-4" /></button>
                  <div className="w-px h-5 bg-pink-500/20 mx-1" />
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("fontSize", "5"); }} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Large text"><Heading1 className="h-4 w-4" /></button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("fontSize", "4"); }} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Medium text"><Heading2 className="h-4 w-4" /></button>
                  <div className="w-px h-5 bg-pink-500/20 mx-1" />
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); const url = prompt("Enter URL:"); if (url) execCmd("createLink", url); }} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Insert link"><Link className="h-4 w-4" /></button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("insertUnorderedList"); }} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Bullet list"><List className="h-4 w-4" /></button>
                  <button type="button" onMouseDown={(e) => { e.preventDefault(); execCmd("insertHorizontalRule"); }} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Horizontal rule"><Minus className="h-4 w-4" /></button>
                  <div className="w-px h-5 bg-pink-500/20 mx-1" />
                  <div className="relative">
                    <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => setColorPickerOpen(!colorPickerOpen)} className="rounded p-1.5 text-sand-400 hover:bg-pink-500/15 hover:text-sand-100 transition-colors" title="Text color"><Palette className="h-4 w-4" /></button>
                    {colorPickerOpen && (
                      <div className="absolute top-full right-0 mt-2 z-50 w-[240px] rounded-xl border border-pink-500/20 bg-[rgba(36,3,68,0.97)] backdrop-blur-xl p-4 shadow-2xl">
                        <p className="text-[10px] text-sand-500 mb-3 uppercase tracking-wider font-medium">Text Color</p>
                        <div className="grid grid-cols-5 gap-3">
                          {[
                            { color: "#F90077", label: "Pink" },
                            { color: "#FFB800", label: "Gold" },
                            { color: "#F97316", label: "Orange" },
                            { color: "#EF4444", label: "Red" },
                            { color: "#22C55E", label: "Green" },
                            { color: "#3B82F6", label: "Blue" },
                            { color: "#A855F7", label: "Purple" },
                            { color: "#F9EDD8", label: "Sand" },
                            { color: "#FFFFFF", label: "White" },
                            { color: "#94A3B8", label: "Gray" },
                          ].map((c) => (
                            <button
                              key={c.color}
                              type="button"
                              title={c.label}
                              onMouseDown={(e) => { e.preventDefault(); execCmd("foreColor", c.color); setColorPickerOpen(false); }}
                              className="h-9 w-9 rounded-full border-2 border-white/10 hover:border-white/50 hover:scale-110 transition-all shadow-sm"
                              style={{ backgroundColor: c.color }}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                {/* Rich text editor (contentEditable) */}
                <div
                  ref={editorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={syncEditor}
                  onBlur={syncEditor}
                  data-placeholder="Write your message here..."
                  className="min-h-[200px] max-h-[500px] overflow-y-auto rounded-b-lg border border-pink-500/20 bg-transparent px-3 py-2 text-sm text-sand-200 leading-relaxed outline-none focus:ring-2 focus:ring-pink-500/30 [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:my-1 [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:my-1 [&_li]:my-0.5 [&_a]:text-pink-400 [&_a]:underline [&_hr]:border-pink-500/20 [&_hr]:my-3 empty:before:content-[attr(data-placeholder)] empty:before:text-sand-500"
                />
              </div>
            </CardContent>
          </Card>

          {/* Audience */}
          <Card className="glass-card border-0">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-sand-400"><Users className="h-4 w-4" /> Audience</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Button variant="outline" size="sm" className={filterType === "all" ? "bg-pink-500/15 text-pink-400 border-transparent" : "text-sand-400 border-transparent"} onClick={() => { setFilterType("all"); setPreviewResult(null); }}>All Active Members</Button>
                <Button variant="outline" size="sm" className={filterType === "filtered" ? "bg-pink-500/15 text-pink-400 border-transparent" : "text-sand-400 border-transparent"} onClick={() => { setFilterType("filtered"); setPreviewResult(null); }}>Filter Audience</Button>
              </div>

              {filterType === "filtered" && (
                <div className="space-y-4 rounded-xl bg-pink-500/5 border border-pink-500/10 p-4">
                  <div className="space-y-2">
                    <Label className="text-sand-400 text-xs uppercase tracking-wider">Registration Year</Label>
                    <div className="flex flex-wrap gap-2">
                      {NODE_YEARS.map((year) => (
                        <button key={year} onClick={() => toggleYear(year)} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedYears.includes(year) ? "bg-amber/20 text-amber border border-amber/30" : "bg-sand-700/20 text-sand-400 border border-transparent hover:text-sand-200"}`}>{year}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sand-400 text-xs uppercase tracking-wider">Role</Label>
                    <div className="flex flex-wrap gap-3">
                      {(["lead", "admin", "super_admin"] as const).map((role) => (
                        <label key={role} className="flex items-center gap-2 text-sm text-sand-300 cursor-pointer">
                          <Checkbox checked={selectedRoles.includes(role)} onCheckedChange={() => toggleRole(role)} className="border-sand-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500" />
                          {role === "super_admin" ? "Super Admin" : role.charAt(0).toUpperCase() + role.slice(1)}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sand-400 text-xs uppercase tracking-wider">Member Flags</Label>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      <label className="flex items-center gap-2 text-sm text-sand-300 cursor-pointer"><Checkbox checked={isCommittee} onCheckedChange={(v) => { setIsCommittee(!!v); setPreviewResult(null); }} className="border-sand-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500" /> Committee Members</label>
                      <label className="flex items-center gap-2 text-sm text-sand-300 cursor-pointer"><Checkbox checked={isBuildCrew} onCheckedChange={(v) => { setIsBuildCrew(!!v); setPreviewResult(null); }} className="border-sand-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500" /> Build Crew</label>
                      <label className="flex items-center gap-2 text-sm text-sand-300 cursor-pointer"><Checkbox checked={onboardingIncomplete} onCheckedChange={(v) => { setOnboardingIncomplete(!!v); setPreviewResult(null); }} className="border-sand-500 data-[state=checked]:bg-pink-500 data-[state=checked]:border-pink-500" /> Onboarding Incomplete</label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sand-400 text-xs uppercase tracking-wider">Tenure</Label>
                    <div className="flex flex-wrap gap-2">
                      {([{ value: "", label: "Any" }, { value: "first_year", label: "First Year" }, { value: "veteran", label: "Veteran (5+)" }, { value: "og", label: "OG (7+)" }] as const).map((opt) => (
                        <button key={opt.value} onClick={() => { setTenure(opt.value); setPreviewResult(null); }} className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${tenure === opt.value ? "bg-amber/20 text-amber border border-amber/30" : "bg-sand-700/20 text-sand-400 border border-transparent hover:text-sand-200"}`}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-[11px] text-sand-500">Members marked &quot;Not Invited Back&quot; or &quot;Reapply&quot; are automatically excluded.</p>

              <Separator className="bg-pink-500/10" />
              <div className="space-y-3">
                <Button variant="outline" size="sm" className="border-pink-500/20 text-pink-400 hover:bg-pink-500/10" onClick={handlePreview} disabled={previewing}>
                  {previewing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Eye className="mr-1.5 h-3.5 w-3.5" />} Preview Recipients
                </Button>
                {previewResult && (
                  <div className="rounded-xl bg-pink-500/5 border border-pink-500/10 p-3">
                    <button className="flex w-full items-center justify-between text-sm" onClick={() => setPreviewExpanded(!previewExpanded)}>
                      <span className="text-sand-200 font-medium">{previewResult.length} recipient{previewResult.length !== 1 ? "s" : ""}</span>
                      {previewExpanded ? <ChevronUp className="h-4 w-4 text-sand-400" /> : <ChevronDown className="h-4 w-4 text-sand-400" />}
                    </button>
                    {previewExpanded && (
                      <div className="mt-2 max-h-48 overflow-y-auto space-y-1">
                        {previewResult.map((r) => (
                          <div key={r.id} className="flex items-center gap-2 text-xs text-sand-400 py-0.5">
                            <span className="text-sand-200">{[r.first_name, r.last_name].filter(Boolean).join(" ") || r.email}</span>
                            {r.playa_name && <span className="text-pink-400">&quot;{r.playa_name}&quot;</span>}
                            <span className="ml-auto text-sand-500">{r.email}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" className="border-pink-500/20 text-sand-300 hover:text-sand-100" onClick={handleSaveDraft} disabled={saving || (!subject.trim() && !bodyHtml.trim())}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} {saving ? "Saving..." : editingDraftId ? "Update Draft" : "Save Draft"}
            </Button>
            {autosaveStatus === "saved" && <span className="text-xs text-sand-500">Autosaved</span>}
            <Button variant="outline" className="border-pink-500/20 text-sand-300 hover:text-sand-100" onClick={handleEmailPreview} disabled={emailPreviewLoading || (!subject.trim() && !bodyHtml.trim())}>
              {emailPreviewLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MonitorSmartphone className="mr-2 h-4 w-4" />} Preview Email
            </Button>
            <Button className="rounded-full bg-pink-500 text-white hover:bg-pink-600 glow-pink" onClick={() => setConfirmOpen(true)} disabled={!subject.trim() || !bodyHtml.trim() || sending}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />} {sending ? "Sending..." : "Send Now"}
            </Button>
          </div>

          {/* Confirm send dialog */}
          <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <DialogContent className="glass border-pink-500/10 sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-sand-100"><Send className="h-5 w-5 text-pink-400" /> Confirm Send</DialogTitle>
                <DialogDescription className="text-sand-400">This will send an email to {previewResult?.length ?? "all matching"} member{(previewResult?.length ?? 0) !== 1 ? "s" : ""} and create an in-app notification.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="rounded-lg bg-pink-500/5 p-3">
                  <p className="text-sm font-medium text-sand-200">{subject}</p>
                  <p className="text-xs text-sand-500 mt-1 line-clamp-3">{bodyHtml.replace(/<[^>]+>/g, "").slice(0, 200)}</p>
                </div>
                <div className="flex gap-3">
                  <Button className="flex-1 bg-pink-500 text-white hover:bg-pink-600" onClick={handleSend} disabled={sending}>{sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Send Now</Button>
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)} className="text-sand-400 hover:text-sand-200">Cancel</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Email preview dialog — admin-authored content (trusted) rendered in iframe */}
          <Dialog open={!!emailPreviewHtml} onOpenChange={(open) => !open && setEmailPreviewHtml(null)}>
            <DialogContent className="glass border-pink-500/10 sm:max-w-2xl max-h-[85vh] p-0 overflow-hidden">
              <DialogHeader className="px-6 pt-6 pb-3">
                <DialogTitle className="flex items-center gap-2 text-sand-100"><MonitorSmartphone className="h-5 w-5 text-pink-400" /> Email Preview</DialogTitle>
                <DialogDescription className="text-sand-400">This is how the email will appear to recipients.</DialogDescription>
              </DialogHeader>
              {emailPreviewHtml && (
                <div className="px-6 pb-6">
                  <iframe
                    srcDoc={emailPreviewHtml}
                    className="w-full h-[60vh] rounded-lg border border-pink-500/10 bg-white"
                    sandbox="allow-same-origin"
                    title="Email preview"
                  />
                </div>
              )}
            </DialogContent>
          </Dialog>
        </motion.div>
      )}

      {/* Message reading sheet */}
      <Sheet open={!!readingMessage} onOpenChange={(open) => !open && setReadingMessage(null)}>
        <SheetContent className="glass w-full sm:max-w-lg border-l-pink-500/10 p-0">
          {readingMessage && (<>
            <SheetHeader className="border-b border-pink-500/10 px-6 py-4">
              <SheetTitle className="text-sand-100">{readingMessage.subject}</SheetTitle>
              <p className="text-xs text-sand-500">From {readingMessage.sender_name} &middot; {new Date(readingMessage.sent_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </SheetHeader>
            <ScrollArea className="h-[calc(100vh-140px)]">
              <div className="px-6 py-5 text-sm text-sand-200 leading-relaxed whitespace-pre-wrap">{readingMessage.body_html}</div>
            </ScrollArea>
          </>)}
        </SheetContent>
      </Sheet>
    </div>
  );
}
