import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Please sign in to view the flyer.", { status: 401 });

  const { data, error } = await supabase.rpc("get_nodesgiving_flyer");
  if (error) return new Response("The flyer could not be loaded.", { status: 503 });
  if (!data) return new Response("The flyer is not available yet.", { status: 404 });
  return new Response(new Uint8Array(Buffer.from(data, "base64")), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
