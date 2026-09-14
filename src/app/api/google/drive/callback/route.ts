import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  exchangeDriveCode,
  fetchDriveAccountEmail,
  storeDriveConfig,
} from "@/lib/google/drive";

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
  const back = (status: string) => new URL(`/dashboard?gdrive=${status}`, request.url);

  if (url.searchParams.get("error")) return NextResponse.redirect(back("denied"));

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const savedState = request.cookies.get("gdrive_oauth_state")?.value;
  if (!code || !state || !savedState || state !== savedState || !state.endsWith(`.${user.id}`)) {
    return NextResponse.redirect(back("error"));
  }

  try {
    const redirectUri = `${url.origin}/api/google/drive/callback`;
    const { refreshToken, accessToken } = await exchangeDriveCode(code, redirectUri);
    const accountEmail = await fetchDriveAccountEmail(accessToken);
    await storeDriveConfig({ refreshToken, accountEmail, connectedBy: user.id });
    const response = NextResponse.redirect(back("connected"));
    response.cookies.delete("gdrive_oauth_state");
    return response;
  } catch (e) {
    console.error("[gdrive callback]", e);
    return NextResponse.redirect(back("error"));
  }
}
