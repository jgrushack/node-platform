import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeCodeForTokens,
  fetchAccountEmail,
  storeCalendarConfig,
} from "@/lib/google/calendar";

// OAuth callback: verifies the CSRF state, exchanges the code for a refresh
// token, and stores it (service-role-only). Admin-gated.
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

  const url = request.nextUrl;
  const calendarUrl = (status: string) =>
    new URL(`/dashboard/calendar?gcal=${status}`, request.url);

  if (url.searchParams.get("error")) {
    return NextResponse.redirect(calendarUrl("denied"));
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = request.cookies.get("gcal_oauth_state")?.value;

  // State must match the cookie AND be bound to the current admin (set at connect).
  if (
    !code ||
    !state ||
    !savedState ||
    state !== savedState ||
    !state.endsWith(`.${user.id}`)
  ) {
    return NextResponse.redirect(calendarUrl("error"));
  }

  try {
    const redirectUri = `${url.origin}/api/google/calendar/callback`;
    const { refreshToken, accessToken } = await exchangeCodeForTokens(code, redirectUri);
    const accountEmail = await fetchAccountEmail(accessToken);
    await storeCalendarConfig({ refreshToken, accountEmail, connectedBy: user.id });

    const response = NextResponse.redirect(calendarUrl("connected"));
    response.cookies.delete("gcal_oauth_state");
    return response;
  } catch (e) {
    console.error("[gcal callback]", e);
    return NextResponse.redirect(calendarUrl("error"));
  }
}
