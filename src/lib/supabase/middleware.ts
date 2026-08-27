import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getEnv("NEXT_PUBLIC_SUPABASE_URL"),
    getEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // A dead refresh token (revoked session, ancient PWA cookie) makes
  // getUser throw/err on every request. Treat it as logged-out instead of
  // erroring, and clear the stale sb-* cookies so the client stops
  // re-sending the dead token and gets a clean login instead of a
  // half-broken dashboard.
  let user = null;
  let authDead = false;
  try {
    const { data, error } = await supabase.auth.getUser();
    user = data.user;
    if (error) authDead = true;
  } catch {
    authDead = true;
  }

  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    const redirect = NextResponse.redirect(url);
    if (authDead) {
      for (const c of request.cookies.getAll()) {
        if (c.name.startsWith("sb-")) redirect.cookies.delete(c.name);
      }
    }
    return redirect;
  }

  return supabaseResponse;
}
