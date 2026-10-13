import { supabase } from "./supabase";
export class AuthenticatedRequestError extends Error {
  constructor(message: string, public status: number, public data: Record<string, unknown>) { super(message); }
}

/** Always use the current Supabase session, including automatically refreshed tokens. */
export async function authenticatedFetch(input: string, init: RequestInit = {}) {
  if (!input.startsWith("/api/")) throw new Error("Authenticated requests must target this app.");
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) throw new Error("Please sign in to continue.");
  const headers = new Headers(init.headers);
  const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  const performRequest = async () => {
    try { return await fetch(input, { ...init, headers, signal, cache: "no-store" }); }
    catch (error) {
      if (signal.aborted) throw new Error("The connection timed out. Please check your network.");
      throw error;
    }
  };
  let response = await performRequest();
  // A session can expire between reading it and server verification. Refresh
  // once and retry the same request; send request IDs remain unchanged.
  if (response.status === 401) {
    const refreshed = await supabase.auth.refreshSession();
    if (!refreshed.error && refreshed.data.session) {
      headers.set("Authorization", `Bearer ${refreshed.data.session.access_token}`);
      response = await performRequest();
    }
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new AuthenticatedRequestError(body.error || `Request failed (${response.status}).`, response.status, body);
  }
  return response;
}
