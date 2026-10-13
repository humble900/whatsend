import "server-only";
import { createClient } from "@supabase/supabase-js";
import { trustedServerRequest } from "./evolution-request";
let serviceClient: ReturnType<typeof createClient> | undefined;

export function getServiceSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase server authentication is not configured.");
  serviceClient ||= createClient(url,key,{
    auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false},
    global:{fetch:async(input,init)=>trustedServerRequest(typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url,init,10000,"Sign-in service timed out.")},
  });
  return serviceClient;
}
