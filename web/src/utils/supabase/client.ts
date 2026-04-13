import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // Ensure the env vars are actually populated; standard Next.js behavior.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
