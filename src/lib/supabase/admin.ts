import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        throw new Error(`Missing required env var: ${key}`);
    }
    return value;
}

/**
 * Creates a Supabase client using the Service Role Key.
 * BYPASSES ROW LEVEL SECURITY (RLS).
 * USE WITH EXTREME CAUTION AND ONLY ON THE SERVER.
 */
export function createAdminClient() {
    return createClient(
        getEnv("NEXT_PUBLIC_SUPABASE_URL"),
        getEnv("SUPABASE_SERVICE_ROLE_KEY"),
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        }
    );
}
