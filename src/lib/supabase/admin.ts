import { createClient } from "@supabase/supabase-js";

function getEnv(key: string): string {
    const value = process.env[key];
    if (!value) {
        console.warn(`Missing env var: ${key}. Some admin functions will fail.`);
        return "";
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
