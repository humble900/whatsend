import { createClient } from "@supabase/supabase-js";

// Validate env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase environment variables. Falling back to dummy values for build.");
}

const makeClient=()=>createClient(
  supabaseUrl || "https://dummy.supabase.co", 
  supabaseAnonKey || "dummy-key",
  { global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(15000)]) : AbortSignal.timeout(15000) }) } }
);
// Keep one browser auth client and refresh timer through development reloads.
// Never share browser sessions across server requests.
const state=globalThis as typeof globalThis & {whatsendAuthClient?:ReturnType<typeof makeClient>};
export const supabase=typeof window==='undefined'?makeClient():(state.whatsendAuthClient??=makeClient());
