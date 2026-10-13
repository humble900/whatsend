import { createClient } from "@supabase/supabase-js";

// Validate env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase environment variables. Falling back to dummy values for build.");
}

export const supabase = createClient(
  supabaseUrl || "https://dummy.supabase.co", 
  supabaseAnonKey || "dummy-key",
  { global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) } }
);
