"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (live && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session) { setReady(true); setChecking(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (!live) return;
      setReady(!!data.session && !error); setChecking(false);
    });
    return () => { live = false; subscription.unsubscribe(); };
  }, []);
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError("");
    if (password !== confirmation) { setError("The passwords don’t match."); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      router.replace("/dashboard/profile");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Couldn’t update your password."); }
    finally { setSaving(false); }
  };
  const input = "w-full rounded-lg border border-[#dde4da] bg-[#fafbf7] p-3 text-base text-[#14251d]";
  return <main className="min-h-screen bg-[#fafbf7] text-[#14251d] flex items-center justify-center p-6"><div className="w-full max-w-md bg-white border border-[#dde4da] rounded-xl p-7"><Link href="/" className="font-bold text-xl">Whatsend</Link><h1 className="text-2xl font-semibold mt-7 mb-3">Set a new password</h1>{checking ? <p role="status">Checking your reset link…</p> : ready ? <form onSubmit={save} className="space-y-5"><p className="text-sm text-[#62705e]">Choose a password with at least 8 characters.</p><div><label htmlFor="new-password" className="block text-sm mb-2">New password</label><input id="new-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={input} value={password} onChange={event => setPassword(event.target.value)} /></div><div><label htmlFor="confirm-password" className="block text-sm mb-2">Confirm password</label><input id="confirm-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required className={input} value={confirmation} onChange={event => setConfirmation(event.target.value)} /></div>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<button disabled={saving} className="w-full rounded-lg bg-[#146c43] text-white py-3 font-semibold disabled:opacity-50">{saving ? "Updating…" : "Update password"}</button></form> : <><p className="text-sm text-[#62705e] mb-5">This reset link has expired or is invalid. Return to sign in and request another password reset email.</p><Link href="/auth" className="text-[#146c43] underline">Back to sign in</Link></>}</div></main>;
}
