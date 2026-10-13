"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Smartphone, BarChart3, TrendingUp, MessageSquare,
  ShieldCheck, ArrowUpRight, ArrowDownRight, Loader2,
  AlertTriangle, RefreshCw, Users, Zap, Activity,
} from "lucide-react";
import Link from "next/link";

interface DashboardStats {
  activeInstances: number;
  totalInstances: number;
  messagesSent24h: number;
  deliveryRate: string;
  failed24h: number;
  runningCampaigns: number;
  totalContacts: number;
  dailyCapacity: number;
  dailyUsed: number;
  totalMessagesSent: number;
}

interface RecentCampaign {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  contactsProcessed: number;
  progress: number;
  createdAt: string;
}

const STATUS_COLOR: Record<string, string> = {
  running: "bg-emerald-500/20 text-emerald-400",
  paused: "bg-amber-500/20 text-amber-400",
  completed: "bg-green-500/20 text-green-400",
  queued: "bg-green-600/20 text-green-500",
  draft: "bg-zinc-500/20 text-zinc-400",
};

const STATUS_BAR: Record<string, string> = {
  running: "bg-emerald-500",
  paused: "bg-amber-500",
  completed: "bg-green-500",
  queued: "bg-green-600",
  draft: "bg-zinc-500",
};

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as any },
  }),
};

function StatCardSkeleton() {
  return (
    <div className="glass-panel rounded-2xl p-6 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="w-10 h-10 bg-secondary/50 rounded-xl" />
        <div className="w-12 h-4 bg-secondary/50 rounded" />
      </div>
      <div className="w-20 h-8 bg-secondary/50 rounded" />
      <div className="w-28 h-3 bg-secondary/30 rounded" />
    </div>
  );
}

export default function DashboardOverview() {
  const [hourlyActivity, setHourlyActivity] = useState<{ timestamp: string; count: number }[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCampaigns, setRecentCampaigns] = useState<RecentCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setIsRefreshing(true);
    setError("");

    try {
      const res = await authenticatedFetch("/api/dashboard", {
        headers: { },
        // No cache — always fresh
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      setStats(data.stats);
      setHourlyActivity(data.hourlyActivity || []);
      setRecentCampaigns(data.recentCampaigns || []);
      setLastUpdated(new Date());
    } catch (e: any) {
      setError(e.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchStats(); }, [fetchStats]);

  // Auto-refresh every 30s when campaigns are running
  useEffect(() => {
    const hasRunning = recentCampaigns.some(c => c.status === "running");
    if (!hasRunning) return;
    const interval = setInterval(() => fetchStats(true), 30_000);
    return () => clearInterval(interval);
  }, [recentCampaigns, fetchStats]);

  const statCards = stats ? [
    {
      label: "Active Instances",
      value: stats.activeInstances.toString(),
      sub: `${stats.totalInstances} total`,
      change: `+${stats.activeInstances}`,
      trend: "up" as const,
      icon: Smartphone,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Messages Sent (24h)",
      value: stats.messagesSent24h.toLocaleString(),
      sub: `${stats.failed24h} failed`,
      change: stats.messagesSent24h > 0 ? `+${stats.messagesSent24h}` : "0",
      trend: "up" as const,
      icon: Send,
      color: "text-green-400",
      bgColor: "bg-green-500/10",
    },
    {
      label: "Delivery Rate",
      value: stats.deliveryRate,
      sub: stats.messagesSent24h > 0 ? `from ${stats.messagesSent24h} msgs` : "No msgs yet",
      change: stats.failed24h === 0 ? "Clean" : `${stats.failed24h} failed`,
      trend: stats.failed24h === 0 ? "up" as const : "down" as const,
      icon: BarChart3,
      color: "text-green-500",
      bgColor: "bg-green-600/10",
    },
    {
      label: "Running Campaigns",
      value: stats.runningCampaigns.toString(),
      sub: `${stats.totalContacts.toLocaleString()} contacts`,
      change: stats.runningCampaigns > 0 ? "Live" : "Idle",
      trend: "up" as const,
      icon: Activity,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
    },
  ] : [];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          
          <p className="text-muted-foreground text-sm sm:text-base">
            Your campaigns, customers, and messages.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchStats(true)}
            disabled={isRefreshing || loading}
            className="p-2 rounded-xl hover:bg-secondary/50 transition-colors disabled:opacity-50"
            title="Refresh stats"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin text-primary" : "text-muted-foreground"}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
            <button onClick={() => fetchStats()} className="ml-auto text-xs underline hover:no-underline">
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {loading ? (
          Array(4).fill(0).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          statCards.map((stat, i) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial="hidden"
                animate="visible"
                variants={fadeUp}
                custom={i}
                className="glass-panel rounded-2xl p-6 group hover:border-white/20 transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className={`w-10 h-10 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                    <Icon className={`w-5 h-5 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                {stat.sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{stat.sub}</p>}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Daily Capacity Bar */}
      {stats && stats.dailyCapacity > 0 && (
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={4} className="glass-panel rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-green-500" />
              <span className="text-sm font-semibold">Daily Sending Capacity</span>
            </div>
            <span className="text-sm font-mono font-bold">
              {stats.dailyUsed.toLocaleString()} / {stats.dailyCapacity.toLocaleString()}
            </span>
          </div>
          <div className="w-full bg-secondary h-2.5 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((stats.dailyUsed / stats.dailyCapacity) * 100, 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.4 }}
              className={`h-full rounded-full ${
                stats.dailyUsed / stats.dailyCapacity > 0.85
                  ? "bg-red-500"
                  : stats.dailyUsed / stats.dailyCapacity > 0.6
                  ? "bg-amber-500"
                  : "bg-emerald-500"
              }`}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.activeInstances} account{stats.activeInstances !== 1 ? "s" : ""} × {stats.dailyCapacity / Math.max(stats.activeInstances, 1)} msgs/day limit
          </p>
        </motion.div>
      )}

      {/* Activity Chart + Recent Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart (Decorative + Live hourly indicators) */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={5} className="lg:col-span-2 glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Message activity</h3>
              <p className="text-sm text-muted-foreground">Messages sent over the last 24 hours</p>
            </div>
            <div className="flex items-center gap-2">
              {stats?.runningCampaigns ? (
                <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Live
                </span>
              ) : null}
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
          </div>
          {loading ? (
            <div className="h-40 flex items-end gap-1.5">
              {Array(24).fill(0).map((_, i) => (
                <div key={i} className="flex-1 bg-secondary/30 rounded-sm animate-pulse" style={{ height: `${20 + Math.sin(i * 0.8) * 20 + (i % 3) * 8}%` }} />
              ))}
            </div>
          ) : (
            <div className="flex items-end gap-1.5 h-40">
              {hourlyActivity.map((hour) => {
                const peak = Math.max(1, ...hourlyActivity.map(item => item.count));
                return <div key={hour.timestamp} className="flex-1 bg-primary rounded-sm" style={{ height: hour.count ? `${Math.max(2, hour.count / peak * 100)}%` : "2px", opacity: hour.count ? 1 : 0.15 }} title={`${new Date(hour.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${hour.count} messages`} />;
              })}
            </div>
          )}
          <div className="flex justify-between text-xs text-muted-foreground mt-3">
            <span>{hourlyActivity[0] ? new Date(hourlyActivity[0].timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "24 hours ago"}</span>
            
            
            
            <span>Now</span>
          </div>
        </motion.div>

        {/* Recent Campaigns — LIVE */}
        <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={6} className="glass-panel rounded-2xl p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-lg">Recent Campaigns</h3>
            <Link href="/dashboard/campaigns" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>

          {loading ? (
            <div className="space-y-4">
              {Array(3).fill(0).map((_, i) => (
                <div key={i} className="p-4 bg-secondary/30 rounded-xl animate-pulse space-y-2">
                  <div className="flex justify-between">
                    <div className="w-32 h-4 bg-secondary/60 rounded" />
                    <div className="w-16 h-4 bg-secondary/60 rounded" />
                  </div>
                  <div className="w-full h-1.5 bg-secondary/60 rounded-full" />
                </div>
              ))}
            </div>
          ) : recentCampaigns.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground space-y-3">
              <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-sm">No campaigns yet.</p>
              <Link href="/dashboard/campaigns/create" className="text-primary text-sm hover:underline">
                Create your first →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCampaigns.map((c) => (
                <Link
                  key={c.id}
                  href={`/dashboard/campaigns/${c.id}`}
                  className="block p-4 bg-secondary/30 hover:bg-secondary/50 rounded-xl transition-colors group"
                >
                  <div className="flex items-center justify-between mb-2 gap-2">
                    <p className="font-medium text-sm truncate group-hover:text-primary transition-colors">{c.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase shrink-0 ${STATUS_COLOR[c.status] || STATUS_COLOR.draft}`}>
                      {c.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                    {c.contactsProcessed.toLocaleString()} / {c.totalContacts.toLocaleString()} sent
                  </div>
                  {c.totalContacts > 0 && (
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${c.progress}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className={`h-full rounded-full ${STATUS_BAR[c.status] || "bg-zinc-500"}`}
                      />
                    </div>
                  )}
                </Link>
              ))}
            </div>
          )}
        </motion.div>
      </div>

    </motion.div>
  );
}
