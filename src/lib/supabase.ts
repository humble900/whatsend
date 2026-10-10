import { createClient } from "@supabase/supabase-js";

// Validate env vars
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Missing Supabase environment variables. Falling back to dummy values for build.");
}

export const supabase = createClient(
  supabaseUrl || "https://dummy.supabase.co", 
  supabaseAnonKey || "dummy-key"
);

/**
 * Service Role Client for Server-side Admin Operations (Creating Tenants, Overriding RLS)
 */
export const getServiceSupabase = () => {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceKey) throw new Error("Missing Supabase Service Role Key");
  return createClient(supabaseUrl, serviceKey);
};
