import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const ALLOWED_REDIRECTS = ["/dashboard", "/dashboard/jobs", "/dashboard/profile", "/admin", "/admin/applications", "/admin/jobs"];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next") ?? "/dashboard";

  // Validate redirect target to prevent open redirect attacks
  const next = ALLOWED_REDIRECTS.includes(rawNext) ? rawNext : "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if user has a profile — if not, try to create one from an approved application
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          // No profile yet — check for an approved application with this email
          try {
            const adminClient = createAdminClient();
            const { data: application } = await adminClient
              .from("applications")
              .select("id, email, first_name, last_name, playa_name, phone, skills")
              .eq("email", user.email!)
              .eq("status", "approved")
              .single();

            if (application) {
              await adminClient.rpc("create_profile_from_application", {
                p_user_id: user.id,
                p_email: application.email,
                p_first_name: application.first_name,
                p_last_name: application.last_name,
                p_playa_name: application.playa_name,
                p_phone: application.phone,
                p_skills: application.skills,
              });

              // Link application to profile
              await adminClient
                .from("applications")
                .update({ profile_id: user.id })
                .eq("id", application.id);
            }
          } catch (e) {
            console.error("[auth/callback] Profile creation error:", e);
          }
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=link_expired`);
}
