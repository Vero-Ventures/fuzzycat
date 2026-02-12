import { createClient } from '@supabase/supabase-js';

/**
 * Supabase admin client using the service role key.
 * Used for privileged operations: setting app_metadata, creating admin users.
 * NEVER expose this client to the browser.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
