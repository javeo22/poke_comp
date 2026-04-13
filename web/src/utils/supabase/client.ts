import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Auth is deferred — return null when Supabase env vars aren't configured
  if (!url || !key) return null;

  return createBrowserClient(url, key);
}
