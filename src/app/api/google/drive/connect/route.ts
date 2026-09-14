import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildDriveConsentUrl } from "@/lib/google/drive";

// Admin-only: one-time Google OAuth consent to connect the account that owns
// (or can edit) the NODE Photos Drive folder. Mirrors the calendar connect.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || !["admin", "super_admin"].includes(profile.role)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  try {
    const state = `${randomUUID()}.${user.id}`;
    const redirectUri = `${request.nextUrl.origin}/api/google/drive/callback`;
    const response = NextResponse.redirect(buildDriveConsentUrl(redirectUri, state));
    response.cookies.set("gdrive_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (e) {
    console.error("[gdrive connect]", e);
    return NextResponse.redirect(new URL("/dashboard?gdrive=misconfigured", request.url));
  }
}
