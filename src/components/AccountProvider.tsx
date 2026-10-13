"use client";

import { createContext, useContext, useEffect, useCallback, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

export interface Account {
  id: string; email: string; pendingEmail: string | null; fullName: string;
  jobTitle: string; contactPhone: string; role: string; createdAt: string; providers: string[];
  workspace: { id: string; name: string; plan: string | null };
}
interface AccountContextValue { account: Account | null; loading: boolean; error: string; refresh: () => Promise<void>; signOut: () => Promise<void>; }
const AccountContext = createContext<AccountContextValue | null>(null);
export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error("Account context is unavailable.");
  return context;
}
export function AccountProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestVersion = useRef(0);
  const accountId = account?.id;
  const refresh = useCallback(async () => {
    const version = ++requestVersion.current;
    setError("");
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (!session) { setAccount(null); router.replace("/auth"); return; }
      const response = await authenticatedFetch("/api/account");
      const next = await response.json();
      if (version === requestVersion.current) setAccount(next);
    } catch (cause) {
      if (version === requestVersion.current) setError(cause instanceof Error ? cause.message : "Couldn’t load your account.");
    } finally { if (version === requestVersion.current) setLoading(false); }
  }, [router]);
  const signOut = useCallback(async () => {
    const { error: logoutError } = await supabase.auth.signOut({ scope: "local" });
    if (logoutError) throw logoutError;
    ++requestVersion.current;
    localStorage.removeItem("token");
    setAccount(null);
    router.replace("/auth");
    router.refresh();
  }, [router]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase also emits SIGNED_IN on tab focus. The same loaded account
      // needs no extra profile request; token and user updates still refresh.
      if(event === "SIGNED_IN" && accountId && accountId === session?.user.id)return;
      if (event === "SIGNED_OUT") {
        ++requestVersion.current; setAccount(null); setLoading(false); router.replace("/auth");
      } else if (["SIGNED_IN", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) {
        // Run outside the auth callback to avoid holding Supabase's session lock.
        clearTimeout(timer); timer = setTimeout(() => { void refresh(); }, 0);
      }
    });
    if(!accountId) void refresh();
    return () => { clearTimeout(timer); subscription.unsubscribe(); ++requestVersion.current; };
  }, [refresh, router, accountId]);
  return <AccountContext.Provider value={{ account, loading, error, refresh, signOut }}>{children}</AccountContext.Provider>;
}
