import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { MessagesClient } from "./messages-client";
import type { CampMessage, UnreadMessage } from "@/lib/types/message";

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export default async function MessagesPage() {
  let isAdmin = false;
  let userId: string | null = null;

  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return <p className="text-sand-400">Not authenticated.</p>;
    userId = user.id;

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    isAdmin = !!(profile && ["admin", "super_admin"].includes(profile.role));
  } catch {
    return <p className="text-sand-400">Failed to load messages.</p>;
  }

  let sentMessages: CampMessage[] = [];
  let drafts: CampMessage[] = [];
  let myMessages: UnreadMessage[] = [];

  const admin = getAdmin();
  if (admin && userId) {
    try {
      if (isAdmin) {
        const [sentResult, draftsResult] = await Promise.all([
          admin.from("camp_messages").select("*").eq("status", "sent").order("sent_at", { ascending: false }),
          admin.from("camp_messages").select("*").eq("status", "draft").order("updated_at", { ascending: false }),
        ]);
        sentMessages = (sentResult.data || []) as unknown as CampMessage[];
        drafts = (draftsResult.data || []) as unknown as CampMessage[];
      }

      const { data: recipientRows } = await admin
        .from("message_recipients")
        .select("id, message_id, read_at")
        .eq("profile_id", userId)
        .order("created_at", { ascending: false });

      if (recipientRows && recipientRows.length > 0) {
        const messageIds = recipientRows.map((r) => r.message_id);
        const { data: messages } = await admin
          .from("camp_messages")
          .select("id, subject, body_html, sent_at, sent_by")
          .in("id", messageIds);

        const msgMap = new Map((messages || []).map((m) => [m.id, m]));

        const senderIds = [...new Set((messages || []).map((m) => m.sent_by).filter(Boolean))];
        const senderMap: Record<string, string> = {};
        if (senderIds.length > 0) {
          const { data: senders } = await admin
            .from("profiles")
            .select("id, first_name, last_name")
            .in("id", senderIds);
          for (const s of senders || []) {
            senderMap[s.id] = [s.first_name, s.last_name].filter(Boolean).join(" ") || "NODE Admin";
          }
        }

        myMessages = recipientRows.map((r) => {
          const msg = msgMap.get(r.message_id);
          return {
            id: r.id,
            message_id: r.message_id,
            subject: msg?.subject || "",
            body_html: msg?.body_html || "",
            sent_at: msg?.sent_at || "",
            sender_name: senderMap[msg?.sent_by || ""] || "NODE Admin",
            read_at: r.read_at,
          };
        });
      }
    } catch (e) {
      console.error("[MessagesPage] Data error:", e);
    }
  }

  return (
    <MessagesClient
      isAdmin={isAdmin}
      initialSentMessages={sentMessages}
      initialDrafts={drafts}
      initialMyMessages={myMessages}
    />
  );
}
