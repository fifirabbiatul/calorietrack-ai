import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Konfigurasi Supabase belum diisi di environment deployment.");
  }
  return createBrowserClient(supabaseUrl, supabasePublishableKey);
}
