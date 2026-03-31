import { getMessages } from "@/lib/actions/messages";
import { getMyMessages } from "@/lib/actions/messages";
import { createClient } from "@/lib/supabase/server";
import { MessagesClient } from "./messages-client";

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

  // Admins see sent messages history; everyone sees their received messages
  let sentMessages: Awaited<ReturnType<typeof getMessages>> = [];
  if (isAdmin) {
    const result = await getMessages();
    sentMessages = "error" in result ? [] : result;
  }

  const myResult = await getMyMessages();
  const myMessages = "error" in myResult ? [] : myResult;

  return (
    <MessagesClient
      isAdmin={!!isAdmin}
      initialSentMessages={sentMessages as Exclude<typeof sentMessages, { error: string }>}
      initialMyMessages={myMessages}
    />
  );
}
