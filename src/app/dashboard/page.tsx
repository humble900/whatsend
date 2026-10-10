"use client";

import { motion } from "framer-motion";
import {
  Send,
  Smartphone,
  BarChart3,
  TrendingUp,
  MessageSquare,
  ShieldCheck,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import Link from "next/link";

const stats = [
  {
    label: "Active Instances",
    value: "24",
    change: "+3",
    trend: "up" as const,
    icon: Smartphone,
    color: "text-blue-400",
    bgColor: "bg-blue-500/10",
  },
  {
    label: "Messages Sent (24h)",
    value: "12,847",
    change: "+18%",
    trend: "up" as const,
    icon: Send,
    color: "text-green-400",
    bgColor: "bg-green-500/10",
  },
  {
    label: "Delivery Rate",
    value: "99.7%",
    change: "+0.2%",
    trend: "up" as const,
    icon: BarChart3,
    color: "text-purple-400",
    bgColor: "bg-purple-500/10",
  },
  {
    label: "Ban Incidents",
    value: "0",
    change: "0",
    trend: "down" as const,
    icon: ShieldCheck,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/10",
  },
];

const recentCampaigns = [
  { name: "UK Summer Sale", contacts: 2450, delivered: 2438, status: "completed" },
  { name: "Product Launch US", contacts: 5200, delivered: 4102, status: "running" },
  { name: "Re-engagement Wave", contacts: 1800, delivered: 0, status: "queued" },
];

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

export default function DashboardOverview() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2">Dashboard</h1>
        <p className="text-muted-foreground text-sm sm:text-lg">
          Your WhatsApp infrastructure at a glance.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
        {stats.map((stat, i) => {
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
                <div className={`flex items-center gap-1 text-sm font-medium ${
                  stat.trend === "up" ? "text-green-400" : "text-zinc-400"
                }`}>
                  {stat.trend === "up" ? (
                    <ArrowUpRight className="w-4 h-4" />
                  ) : (
                    <ArrowDownRight className="w-4 h-4" />
                  )}
                  {stat.change}
                </div>
              </div>
              <p className="text-3xl font-bold tracking-tight">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      {/* Activity Chart + Recent Campaigns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={5}
          className="lg:col-span-2 glass-panel rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-semibold text-lg">Dispatch Activity</h3>
              <p className="text-sm text-muted-foreground">Messages sent over the last 24 hours</p>
            </div>
            <TrendingUp className="w-5 h-5 text-primary" />
          </div>
          <div className="flex items-end gap-1.5 h-40">
            {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88, 50, 72, 82, 68, 92, 78, 84, 62, 76, 88, 94, 70].map(
              (h, i) => (
                <motion.div
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: 0.5 + i * 0.03, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
                  className="flex-1 bg-gradient-to-t from-primary to-purple-500 rounded-sm opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                />
              )
            )}
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-3">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>Now</span>
          </div>
        </motion.div>

        {/* Recent Campaigns */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={fadeUp}
          custom={6}
          className="glass-panel rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-semibold text-lg">Recent Campaigns</h3>
            <Link href="/dashboard/campaigns" className="text-sm text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="space-y-4">
            {recentCampaigns.map((campaign) => (
              <div key={campaign.name} className="p-4 bg-secondary/30 rounded-xl">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium text-sm">{campaign.name}</p>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    campaign.status === "completed"
                      ? "bg-green-500/20 text-green-400"
                      : campaign.status === "running"
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-yellow-500/20 text-yellow-400"
                  }`}>
                    {campaign.status}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {campaign.delivered.toLocaleString()} / {campaign.contacts.toLocaleString()} delivered
                </div>
                {campaign.contacts > 0 && (
                  <div className="mt-2 h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${
                        campaign.status === "completed" ? "bg-green-500" :
                        campaign.status === "running" ? "bg-blue-500" : "bg-yellow-500"
                      }`}
                      style={{ width: `${(campaign.delivered / campaign.contacts) * 100}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
