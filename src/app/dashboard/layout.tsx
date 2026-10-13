import { Suspense, type ReactNode } from "react";
import DashboardShell from "@/components/DashboardShell";
import { AccountProvider } from "@/components/AccountProvider";
import "./dashboard.css";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="app-loading" role="status">Loading your workspace…</div>}><AccountProvider><DashboardShell>{children}</DashboardShell></AccountProvider></Suspense>;
}
