"use client";

import { createContext, useContext, useEffect, useCallback, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch,AuthenticatedRequestError } from "@/lib/authenticated-fetch";

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
  const refreshing=useRef<Promise<void>|null>(null);
  const mounted=useRef(true);
  const accountId = account?.id;
  const refresh = useCallback(() => {
    if(refreshing.current)return refreshing.current;
    const task=(async()=>{
    const version = ++requestVersion.current;
    setError("");
    try {
      const response = await authenticatedFetch("/api/account");
      const next = await response.json();
      if (mounted.current&&version === requestVersion.current) setAccount(next);
    } catch (cause) {
      if(mounted.current&&version===requestVersion.current){
        if(cause instanceof AuthenticatedRequestError&&cause.status===401||cause instanceof Error&&cause.message==='Please sign in to continue.'){setAccount(null);router.replace('/auth');}
        else setError(cause instanceof Error ? cause.message : "Couldn’t load your account.");
      }
    } finally { if (mounted.current&&version === requestVersion.current) setLoading(false); }
    })();
    refreshing.current=task;
    void task.finally(()=>{if(refreshing.current===task)refreshing.current=null;});
    return task;
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
    mounted.current=true;
    let timer: ReturnType<typeof setTimeout>;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // Supabase also emits SIGNED_IN on tab focus. The same loaded account
      // needs no extra profile request; token and user updates still refresh.
      if(event === "SIGNED_IN" && accountId && accountId === session?.user.id)return;
      if(event==='SIGNED_IN'&&accountId&&session?.user.id&&accountId!==session.user.id){++requestVersion.current;refreshing.current=null;setAccount(null);setLoading(true);}
      if (event === "SIGNED_OUT") {
        ++requestVersion.current; setAccount(null); setLoading(false); router.replace("/auth");
      } else if (["SIGNED_IN", "USER_UPDATED", "TOKEN_REFRESHED"].includes(event)) {
        // Run outside the auth callback to avoid holding Supabase's session lock.
        clearTimeout(timer); timer = setTimeout(() => { void refresh(); }, 0);
      }
    });
    if(!accountId) void refresh();
    return () => { mounted.current=false;clearTimeout(timer); subscription.unsubscribe(); };
  }, [refresh, router, accountId]);
  return <AccountContext.Provider value={{ account, loading, error, refresh, signOut }}>{children}</AccountContext.Provider>;
}
