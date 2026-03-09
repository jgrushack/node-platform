/**
 * One-off script to send welcome invite emails to specific members.
 * Usage: npx tsx scripts/send-invites.ts
 */
import { config } from "dotenv";
config({ path: ".env.local" });

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const resend = new Resend(process.env.RESEND_API_KEY!);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "NODE <noreply@node.family>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://nodev0.vercel.app";

// Members to invite — remaining from rate-limited batch
const SEARCH_NAMES = [
  { first: "REDACTED", last: "REDACTED" },
  { first: "REDACTED", last: "REDACTED" },
  { first: "REDACTED", last: "REDACTED" },
  { first: "REDACTED", last: "REDACTED" },
  { first: "REDACTED", last: "REDACTED" },
  { first: "REDACTED", last: "REDACTED" },
  { first: "REDACTED", last: "REDACTED" },
  { first: "REDACTED", last: "REDACTED" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // Find all matching profiles
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, email")
    .order("first_name");

  if (error || !profiles) {
    console.error("Failed to fetch profiles:", error);
    process.exit(1);
  }

  const matched: typeof profiles = [];

  for (const search of SEARCH_NAMES) {
    const found = profiles.filter((p) => {
      const firstMatch = p.first_name?.toLowerCase().startsWith(search.first);
      if (!firstMatch) return false;
      if ("last" in search) {
        return p.last_name?.toLowerCase().startsWith(search.last);
      }
      return true;
    });

    if (found.length === 0) {
      console.warn(`⚠ No match for: ${search.first} ${(search as any).last || (search as any).lastInitial || ""}`);
    } else if (found.length > 1) {
      console.warn(`⚠ Multiple matches for "${search.first}":`);
      found.forEach((p) => console.warn(`   - ${p.first_name} ${p.last_name} (${p.email})`));
      console.warn(`   → Including all matches`);
    }
    matched.push(...found);
  }

  if (matched.length === 0) {
    console.log("No members found. Exiting.");
    process.exit(0);
  }

  console.log(`\nFound ${matched.length} member(s) to invite:\n`);
  matched.forEach((p) =>
    console.log(`  ${p.first_name} ${p.last_name} — ${p.email}`)
  );
  console.log("");

  for (let i = 0; i < matched.length; i++) {
    if (i > 0) await sleep(1000); // respect Resend 2 req/sec rate limit
    const profile = matched[i];
    const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || profile.email.split("@")[0];

    // Generate magic link
    const { data: linkData, error: linkError } =
      await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: profile.email,
        options: {
          redirectTo: `${SITE_URL}/auth/callback?next=/dashboard`,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      console.error(`✗ ${name} — failed to generate link:`, linkError?.message);
      continue;
    }

    const magicLink = linkData.properties.action_link;

    // Import the email template inline to avoid Next.js module issues
    const { error: sendError } = await resend.emails.send({
      from: FROM_EMAIL,
      to: profile.email,
      subject: "Welcome to the NODE Portal",
      html: buildEmailHtml(profile.first_name || name, magicLink),
    });

    if (sendError) {
      console.error(`✗ ${name} (${profile.email}) — send failed:`, sendError.message);
    } else {
      console.log(`✓ ${name} (${profile.email}) — invite sent!`);
    }
  }

  console.log("\nDone!");
}

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(firstName: string, magicLink: string): string {
  const safeName = esc(firstName);
  const safeLink = esc(magicLink);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#1e1b4b;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#1e1b4b;padding:40px 20px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
  <tr><td align="center" style="padding:30px 40px;border-radius:16px 16px 0 0;background:linear-gradient(135deg,#312e81,#1e1b4b);">
    <svg xmlns="http://www.w3.org/2000/svg" width="120" height="48" viewBox="0 0 120 48">
      <defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#FBA52C"/><stop offset="100%" stop-color="#EF335D"/></linearGradient></defs>
      <text x="60" y="36" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="36" fill="url(#g)">NODE</text>
    </svg>
  </td></tr>
  <tr><td style="background-color:#1e1b4b;padding:40px;border-radius:0 0 16px 16px;border:1px solid #312e81;border-top:none;">
    <h1 style="color:#f8fafc;font-size:24px;margin:0 0 16px;">Welcome to the NODE Portal!</h1>
    <p style="color:#c7d2fe;font-size:16px;line-height:1.6;margin:0 0 16px;">
      Hey ${safeName},
    </p>
    <p style="color:#c7d2fe;font-size:16px;line-height:1.6;margin:0 0 24px;">
      Your NODE member portal is ready. Click below to sign in and set up your profile — add your photo, bio, skills, and more.
    </p>
    <table cellpadding="0" cellspacing="0" style="margin:0 auto 24px;"><tr><td align="center" style="border-radius:12px;background:linear-gradient(135deg,#ec4899,#f97316);">
      <a href="${safeLink}" style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:bold;text-decoration:none;border-radius:12px;">
        Sign In to NODE
      </a>
    </td></tr></table>
    <p style="color:#818cf8;font-size:13px;line-height:1.5;margin:0 0 16px;">
      This link expires in 1 hour. If it doesn't work, copy and paste this URL into your browser:
    </p>
    <p style="color:#818cf8;font-size:12px;line-height:1.4;word-break:break-all;margin:0 0 24px;">
      ${safeLink}
    </p>
    <hr style="border:none;border-top:1px solid #312e81;margin:24px 0;">
    <p style="color:#6366f1;font-size:12px;margin:0;text-align:center;">
      NODE 2026 — See you in the dust
    </p>
  </td></tr>
</table>
</td></tr></table>
</body>
</html>`;
}

main().catch(console.error);
