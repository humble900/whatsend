"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAccount } from "@/components/AccountProvider";
import { initials } from "@/components/DashboardShell";
import { supabase } from "@/lib/supabase";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

interface Feedback { text: string; error: boolean; }
function Notice({ value }: { value: Feedback | null }) { return value ? <p className="profile-feedback" data-error={value.error} role={value.error ? "alert" : "status"}>{value.text}</p> : null; }
function message(cause: unknown) { return cause instanceof Error ? cause.message : "Something went wrong. Please try again."; }

export default function ProfilePage() {
  const { account, refresh, signOut } = useAccount();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [workspace, setWorkspace] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Record<string, Feedback | null>>({});
  useEffect(() => {
    if (!account) return;
    setName(account.fullName); setPhone(account.contactPhone); setJobTitle(account.jobTitle);
    setWorkspace(account.workspace.name); setEmail(account.email);
  }, [account?.id]);
  if (!account) return null;
  const notice = (key: string, text: string, error = false) => setFeedback(previous => ({ ...previous, [key]: { text, error } }));
  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy("profile"); setFeedback(previous => ({ ...previous, profile: null }));
    try {
      const { error } = await supabase.auth.updateUser({ data: { full_name: name.trim(), contact_phone: phone.trim(), job_title: jobTitle.trim() } });
      if (error) throw error;
      await refresh(); notice("profile", "Your profile has been saved.");
    } catch (cause) { notice("profile", message(cause), true); }
    finally { setBusy(null); }
  };
  const saveWorkspace = async (event: FormEvent) => {
    event.preventDefault(); setBusy("workspace");
    try { await authenticatedFetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ workspaceName: workspace }) }); await refresh(); notice("workspace", "Workspace name saved."); }
    catch (cause) { notice("workspace", message(cause), true); }
    finally { setBusy(null); }
  };
  const changeEmail = async (event: FormEvent) => {
    event.preventDefault(); setBusy("email");
    try {
      const { error } = await supabase.auth.updateUser({ email: email.trim() }, { emailRedirectTo: `${window.location.origin}/auth/callback` });
      if (error) throw error;
      await refresh(); notice("email", "Check your inbox to confirm the change. You may need to confirm it from both your current and new email addresses.");
    } catch (cause) { notice("email", message(cause), true); }
    finally { setBusy(null); }
  };
  const resetPassword = async () => {
    setBusy("security");
    try { const { error } = await supabase.auth.resetPasswordForEmail(account.email, { redirectTo: `${window.location.origin}/auth/reset-password` }); if (error) throw error; notice("security", "Password reset email sent. Follow the link to choose a new password."); }
    catch (cause) { notice("security", message(cause), true); }
    finally { setBusy(null); }
  };
  const logout = async () => { setBusy("logout"); try { await signOut(); } catch (cause) { notice("logout", message(cause), true); setBusy(null); } };
  return <div className="profile-page">
    <p className="profile-subtitle">Manage your details, sign-in email, and workspace.</p>
    <div className="profile-summary"><span className="app-avatar">{initials(account.fullName || account.email)}</span><div><h2>{account.fullName || account.email.split("@")[0]}</h2><p>{account.email}</p></div></div>
    <section className="profile-card"><h2>Personal details</h2><p>Your name appears in your account menu. Contact details are for your profile, not your connected WhatsApp numbers.</p>
      <form onSubmit={saveProfile}><div className="profile-field"><label htmlFor="profile-name">Full name</label><input id="profile-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required maxLength={150} /></div><div className="profile-fields"><div className="profile-field"><label htmlFor="profile-job">Job title</label><input id="profile-job" autoComplete="organization-title" value={jobTitle} onChange={event => setJobTitle(event.target.value)} maxLength={100} /></div><div className="profile-field"><label htmlFor="profile-phone">Contact phone (optional)</label><input id="profile-phone" type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} maxLength={40} /></div></div><button className="profile-button" disabled={!!busy}>{busy === "profile" ? "Saving…" : "Save profile"}</button><Notice value={feedback.profile} /></form>
    </section>
    <section className="profile-card"><h2>Sign-in email</h2><p>You’ll need to confirm a new address before it becomes your sign-in email.</p><form onSubmit={changeEmail}><div className="profile-field"><label htmlFor="profile-email">Email address</label><input id="profile-email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required maxLength={255} />{account.pendingEmail && <small>Pending confirmation: {account.pendingEmail}</small>}</div><button className="profile-button profile-secondary" disabled={!!busy || email.trim() === account.email}>{busy === "email" ? "Sending confirmation…" : "Change email"}</button><Notice value={feedback.email} /></form></section>
    <section className="profile-card"><h2>Workspace</h2><p>{account.role === "admin" ? "As an admin, you can change the workspace name." : "Your workspace details are managed by an admin."}</p><form onSubmit={saveWorkspace}><div className="profile-field"><label htmlFor="profile-workspace">Workspace name</label><input id="profile-workspace" value={workspace} onChange={event => setWorkspace(event.target.value)} disabled={account.role !== "admin"} required maxLength={150} /></div><dl className="profile-details"><div><dt>Your access</dt><dd>{account.role === "admin" ? "Admin" : "Member"}</dd></div><div><dt>Plan</dt><dd>{account.workspace.plan || "Not assigned"}</dd></div></dl>{account.role === "admin" && <button className="profile-button" disabled={!!busy || workspace.trim() === account.workspace.name}>{busy === "workspace" ? "Saving…" : "Save workspace"}</button>}<Notice value={feedback.workspace} /></form></section>
    <section className="profile-card"><h2>Account security</h2><p>Reset your password by email. If you use Google, you can keep signing in with Google.</p><dl className="profile-details"><div><dt>Sign-in methods</dt><dd>{account.providers.map(provider => provider === "email" ? "Email" : provider === "google" ? "Google" : provider).join(", ") || "Not available"}</dd></div><div><dt>Account created</dt><dd>{new Date(account.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</dd></div></dl><button type="button" className="profile-button profile-secondary" onClick={() => void resetPassword()} disabled={!!busy}>{busy === "security" ? "Sending…" : "Send password reset email"}</button><Notice value={feedback.security} /></section>
    <section className="profile-card"><h2>Log out</h2><p>Sign out of Whatsend on this device.</p><button className="profile-button profile-secondary" onClick={() => void logout()} disabled={!!busy}>{busy === "logout" ? "Logging out…" : "Log out"}</button><Notice value={feedback.logout} /></section>
  </div>;
}
