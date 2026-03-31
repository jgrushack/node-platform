import { getMessages, getDrafts, getMyMessages } from "@/lib/actions/messages";
import { createClient } from "@/lib/supabase/server";
import { MessagesClient } from "./messages-client";
import type { CampMessage, UnreadMessage } from "@/lib/types/message";

export default async function MessagesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <p className="text-sand-400">Not authenticated.</p>;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile && ["admin", "super_admin"].includes(profile.role);

  let sentMessages: CampMessage[] = [];
  let drafts: CampMessage[] = [];
  let myMessages: UnreadMessage[] = [];

  try {
    if (isAdmin) {
      const [sentResult, draftsResult] = await Promise.all([getMessages(), getDrafts()]);
      sentMessages = sentResult && !("error" in sentResult) ? sentResult : [];
      drafts = draftsResult && !("error" in draftsResult) ? draftsResult : [];
    }

    const myResult = await getMyMessages();
    myMessages = myResult && !("error" in myResult) ? myResult : [];
  } catch (e) {
    console.error("[MessagesPage] Error loading data:", e);
  }

  return (
    <MessagesClient
      isAdmin={!!isAdmin}
      initialSentMessages={sentMessages}
      initialDrafts={drafts}
      initialMyMessages={myMessages}
    />
  );
}
