"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, MessageSquare, Send, Settings, Smartphone, Users, X, LogOut, UserRound, ChevronDown } from "lucide-react";
import { useAccount } from "./AccountProvider";

const destinations = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: Send },
  { name: "Inbox", href: "/dashboard/inbox", icon: MessageSquare },
  { name: "Contacts", href: "/dashboard/contacts", icon: Users },
  { name: "Numbers", href: "/dashboard/instances", icon: Smartphone },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];
export function initials(name: string) { return name.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U"; }

export default function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { account, loading, error, refresh, signOut } = useAccount();
  const menu = useRef<HTMLDialogElement>(null);
  const [logoutError, setLogoutError] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const active = (href: string) => href === "/dashboard" ? pathname === href : pathname.startsWith(href);
  const close = () => menu.current?.close();
  useEffect(() => { close(); }, [pathname]);
  const logout = async () => {
    setLoggingOut(true); setLogoutError("");
    try { await signOut(); close(); }
    catch (cause) { setLogoutError(cause instanceof Error ? cause.message : "Couldn’t log out. Try again."); }
    finally { setLoggingOut(false); }
  };
  if (loading) return <div className="app-loading" role="status">Loading your workspace…</div>;
  if (!account) return <div className="app-loading"><p role="alert">{error || "Checking your session…"}</p>{error && <div className="app-actions"><button onClick={() => void refresh()}>Retry</button><button onClick={() => void logout()} disabled={loggingOut}>Log out</button></div>}{logoutError && <p role="alert">{logoutError}</p>}</div>;
  const displayName = account.fullName || account.email.split("@")[0];
  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/dashboard" className="app-brand"><span className="app-logo" aria-hidden="true">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/icon.svg" alt="" width={32} height={32} /></span>Whatsend</Link>
        <div className="app-workspace" title={account.workspace.name}>{account.workspace.name}</div>
        <nav aria-label="Workspace navigation">{destinations.map(({ name, href, icon: Icon }) => <Link key={href} href={href} className={active(href) ? "app-nav-active" : ""} aria-current={active(href) ? "page" : undefined}><Icon size={20} />{name}</Link>)}</nav>
        <button className="app-account" aria-label="Open account menu" aria-haspopup="dialog" onClick={() => menu.current?.showModal()}><span className="app-avatar">{initials(displayName)}</span><span className="app-account-copy"><strong>{displayName}</strong><small>{account.email}</small></span><ChevronDown size={17} /></button>
      </aside>
      <header className="app-mobile-header"><Link href="/dashboard" className="app-brand"><span className="app-logo" aria-hidden="true">{/* eslint-disable-next-line @next/next/no-img-element */}<img src="/icon.svg" alt="" width={32} height={32} /></span>Whatsend</Link><button className="app-avatar" aria-label="Open account menu" aria-haspopup="dialog" onClick={() => menu.current?.showModal()}>{initials(displayName)}</button></header>
      <main className="app-main" key={account.id}><div className="app-content">{error && <div className="app-error" role="alert">{error}<button onClick={() => void refresh()}>Retry</button></div>}{children}</div></main>
      <nav className="app-bottom-nav" aria-label="Mobile navigation">{destinations.slice(0, 4).map(({ name, href, icon: Icon }) => <Link key={href} href={href} aria-current={active(href) ? "page" : undefined} className={active(href) ? "app-nav-active" : ""}><Icon size={21} /><span>{name}</span></Link>)}</nav>
      <dialog ref={menu} className="app-account-dialog" aria-labelledby="account-menu-title" onClick={event => { if (event.target === event.currentTarget) close(); }}>
        <div className="app-dialog-heading"><div><h2 id="account-menu-title">Your account</h2><p>{account.email}</p></div><button aria-label="Close account menu" onClick={close}><X size={21} /></button></div>
        <p className="app-dialog-workspace">{account.workspace.name}</p>
        <nav aria-label="Account navigation"><Link href="/dashboard/profile" onClick={close}><UserRound size={20} />Profile</Link><Link href="/dashboard/instances" onClick={close}><Smartphone size={20} />WhatsApp numbers</Link><Link href="/dashboard/settings" onClick={close}><Settings size={20} />Workspace settings</Link></nav>
        {logoutError && <p className="app-error" role="alert">{logoutError}</p>}
        <button className="app-logout" onClick={() => void logout()} disabled={loggingOut}><LogOut size={20} />{loggingOut ? "Logging out…" : "Log out"}</button>
      </dialog>
    </div>
  );
}
