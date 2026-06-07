import { type NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { buildConsentUrl } from "@/lib/google/calendar";

// Admin-only: kicks off the one-time Google OAuth consent to connect the camp
// calendar account. Redirects the admin to Google's consent screen.
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

  let consentUrl: string;
  try {
    // Bind the CSRF state to the initiating admin so a callback can't complete
    // the flow for a different user (login-CSRF defense-in-depth).
    const state = `${randomUUID()}.${user.id}`;
    const redirectUri = `${request.nextUrl.origin}/api/google/calendar/callback`;
    consentUrl = buildConsentUrl(redirectUri, state);

    const response = NextResponse.redirect(consentUrl);
    response.cookies.set("gcal_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (e) {
    console.error("[gcal connect]", e);
    return NextResponse.redirect(
      new URL("/dashboard/calendar?gcal=misconfigured", request.url)
    );
  }
}
