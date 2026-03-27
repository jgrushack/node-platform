import { config } from "dotenv";
config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const TEST_PASSWORD = "TestNode2026!";

const TEST_USERS = [
  {
    email: "JGrushack+member@gmail.com",
    first_name: "Test",
    last_name: "Member",
    playa_name: "Dusty Tester",
    role: "member",
    is_committee_member: false,
  },
  {
    email: "Jgrushack+committee@gmail.com",
    first_name: "Test",
    last_name: "Committee",
    playa_name: "Committee Cat",
    role: "member",
    is_committee_member: true,
  },
  {
    email: "JGrushack+Admin@gmail.com",
    first_name: "Test",
    last_name: "Admin",
    playa_name: "Admin Ant",
    role: "admin",
    is_committee_member: false,
  },
];

async function seedTestUsers() {
  for (const user of TEST_USERS) {
    console.log(`\n--- Setting up ${user.email} (${user.role}${user.is_committee_member ? " + committee" : ""}) ---`);

    // Check if auth user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users.find(
      (u) => u.email?.toLowerCase() === user.email.toLowerCase()
    );

    let userId: string;

    if (existing) {
      console.log(`  Auth user already exists (${existing.id})`);
      userId = existing.id;
    } else {
      // Create auth user with password (skip email confirmation)
      const { data: newUser, error: authError } =
        await supabase.auth.admin.createUser({
          email: user.email,
          password: TEST_PASSWORD,
          email_confirm: true,
        });

      if (authError) {
        console.error(`  Failed to create auth user: ${authError.message}`);
        continue;
      }

      userId = newUser.user.id;
      console.log(`  Created auth user (${userId})`);
    }

    // Upsert profile with the desired role
    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: userId,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        playa_name: user.playa_name,
        role: user.role,
        is_committee_member: user.is_committee_member,
      },
      { onConflict: "id" }
    );

    if (profileError) {
      console.error(`  Failed to upsert profile: ${profileError.message}`);
      continue;
    }

    console.log(`  Profile ready: role=${user.role}, committee=${user.is_committee_member}`);
  }

  console.log("\n=== Done ===");
  console.log(`All test accounts use password: ${TEST_PASSWORD}`);
  console.log("Log in at /login with email + password (no magic link needed).\n");
}

seedTestUsers();
