import { createBrowserClient } from "@supabase/ssr";
import { getEnv } from "@/lib/env";

/** Supabase client for Client Components. Uses only the public (anon) key; RLS protects the data. */
export function createClient() {
  const env = getEnv();
  if (!env) throw new Error("Supabase is not configured. Copy .env.example to .env.local and fill it in.");
  return createBrowserClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
