"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Play, Pause, MoreHorizontal, Settings, Trash2, ChevronDown, Check } from "lucide-react";
import Link from "next/link";

const mockCampaigns = [
  { id: "1", name: "Black Friday 2024 (UK)", list: "UK Shoppers", cap: 250, status: "running", progress: 68, sent: 154, replied: 12 },
  { id: "2", name: "Lead Nurture Sequence", list: "Newsletter Subs", cap: 50, status: "draft", progress: 0, sent: 0, replied: 0 },
  { id: "3", name: "Re-engagement Push", list: "Churned Users", cap: 500, status: "completed", progress: 100, sent: 500, replied: 45 },
];

export default function CampaignsListPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const getStatusBadgeStyle = (status: string) => {
    switch (status) {
      case "running": return "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20";
      case "paused": return "bg-amber-500/10 text-amber-500 border border-amber-500/20";
      case "completed": return "bg-blue-500/10 text-blue-500 border border-blue-500/20";
      default: return "bg-zinc-500/10 text-zinc-400 border border-zinc-500/20";
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 max-w-6xl"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 flex items-center gap-2">
            Campaigns
            <span className="text-xs font-normal text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
              1 active
            </span>
          </h1>
          <p className="text-muted-foreground text-sm">Manage and track your automated outreach sequences.</p>
        </div>

        <Link href="/dashboard/campaigns/create" className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all text-sm shrink-0">
          <Plus className="w-4 h-4" /> Add New
        </Link>
      </div>

      {/* Toolbar */}
      <div className="space-y-3 border-b border-border/50 pb-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center">
          <div className="relative flex-1 max-w-full sm:max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 h-10 text-sm bg-secondary/50 border border-border/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary transition-all"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {(["all", "running", "paused", "draft", "completed"]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-all whitespace-nowrap flex items-center gap-1.5 cursor-pointer border ${
                  statusFilter === s
                    ? "bg-primary text-white border-primary shadow-lg shadow-primary/20"
                    : "bg-secondary/30 text-muted-foreground hover:bg-secondary/80 border-transparent"
                }`}
              >
                <span className="capitalize">{s}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Campaigns Feed / Table */}
      <div className="w-full relative space-y-3">
        {/* Desktop Table Headers */}
        <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50 items-center">
          <div className="col-span-3">Name</div>
          <div className="col-span-2 text-center">Status</div>
          <div className="col-span-3 text-center">Progress</div>
          <div className="col-span-1 text-center">Sent</div>
          <div className="col-span-1 text-center">Replied</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        {/* Rows */}
        <div className="space-y-3 mt-3">
          {mockCampaigns.map((c, index) => (
            <motion.div 
              key={c.id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="bg-card hover:shadow-lg hover:border-primary/20 transition-all border border-border/50 rounded-xl overflow-hidden glass-panel"
            >
              {/* DESKTOP ROW */}
              <div className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 items-center">
                <div className="col-span-3 min-w-0">
                  <span className="font-semibold text-sm hover:text-primary transition-colors block truncate">
                    {c.name}
                  </span>
                  <span className="text-xs text-muted-foreground block truncate mt-0.5">
                    List: {c.list} · Cap: {c.cap}/day
                  </span>
                </div>

                <div className="col-span-2 flex justify-center items-center">
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider select-none ${getStatusBadgeStyle(c.status)}`}>
                    {c.status}
                  </span>
                </div>

                <div className="col-span-3 text-center space-y-1.5 px-4">
                  <div className="flex justify-between items-center text-xs font-mono font-semibold">
                    <span>Progress</span>
                    <span>{c.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${c.status === "running" ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </div>

                <div className="col-span-1 text-center font-mono text-sm font-semibold">
                  {c.sent}
                </div>

                <div className="col-span-1 text-center font-mono text-sm font-semibold text-emerald-500">
                  {c.replied}
                </div>

                <div className="col-span-2 flex justify-end items-center gap-2">
                  {c.status === "running" ? (
                    <button className="p-1.5 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors" title="Pause">
                      <Pause className="w-4 h-4" />
                    </button>
                  ) : (
                    <button className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Resume">
                      <Play className="w-4 h-4" />
                    </button>
                  )}
                  <button className="p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-lg transition-colors" title="Settings">
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* MOBILE CARD */}
              <div className="md:hidden p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <span className="font-semibold text-sm leading-tight block truncate">
                      {c.name}
                    </span>
                    <div className="text-xs text-muted-foreground mt-1 truncate">
                      {c.list} · {c.cap}/day
                    </div>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 ${getStatusBadgeStyle(c.status)}`}>
                    {c.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Progress</span>
                    <span className="font-mono font-bold">{c.progress}%</span>
                  </div>
                  <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 ${c.status === "running" ? "bg-emerald-500" : "bg-primary"}`}
                      style={{ width: `${c.progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Sent</div>
                    <div className="text-sm font-mono font-bold">{c.sent}</div>
                  </div>
                  <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                    <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Replied</div>
                    <div className="text-sm font-mono font-bold text-emerald-500">{c.replied}</div>
                  </div>
                </div>
                
                <div className="pt-2 border-t border-border/50 flex justify-between gap-2">
                  {c.status === "running" ? (
                    <button className="flex-1 py-1.5 text-xs font-semibold text-amber-500 bg-amber-500/10 rounded-lg flex items-center justify-center gap-1.5">
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  ) : (
                    <button className="flex-1 py-1.5 text-xs font-semibold text-emerald-500 bg-emerald-500/10 rounded-lg flex items-center justify-center gap-1.5">
                      <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                  )}
                  <Link href="/dashboard/campaigns/create" className="flex-1 py-1.5 text-xs font-semibold bg-secondary/50 hover:bg-secondary/80 rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                    <Settings className="w-3.5 h-3.5" /> Edit
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}
