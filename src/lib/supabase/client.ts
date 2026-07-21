import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client (only used when NEXT_PUBLIC_APP_MODE=supabase).
 * Returns null when Supabase env vars are absent so the app can run in local
 * mode without any cloud configuration.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createBrowserClient(url, key);
}

export const isSupabaseMode = () =>
  process.env.NEXT_PUBLIC_APP_MODE === "supabase" &&
  !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
  !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
