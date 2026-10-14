"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Plus, Play, Pause, Settings, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import {useRouter} from "next/navigation";

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  contactsProcessed: number;
  messagesSent: number;
  dailyLimitPerAccount: number;
  createdAt: string;
}

const STATUS_STYLE: Record<string, string> = {
  running: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  paused: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  completed: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  queued: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  draft: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
};

export default function CampaignsListPage() {
  const router=useRouter();
  const [actionId,setActionId]=useState<string|null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchCampaigns = async () => {
      try {
        const res = await authenticatedFetch("/api/campaigns", {
          headers: { },
        });
        const data = await res.json();
        if (data.campaigns) setCampaigns(data.campaigns);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCampaigns();
  }, []);

  const changeStatus=async(id:string,status:string)=>{
    setActionId(id);setError('');
    try{await authenticatedFetch('/api/campaigns/'+id,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});setCampaigns(previous=>previous.map(campaign=>campaign.id===id?{...campaign,status}:campaign));}
    catch(cause){setError(cause instanceof Error?cause.message:'Could not update campaign.');}
    finally{setActionId(null);}
  };
  const filtered = campaigns.filter((c) => {
    const matchSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const progress = (c: Campaign) =>
    c.totalContacts > 0 ? Math.round((c.contactsProcessed / c.totalContacts) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          
          <p className="text-muted-foreground text-sm">Manage and track your automated outreach sequences.</p>
        </div>
        <Link
          href="/dashboard/campaigns/create"
          className="bg-primary hover:bg-primary/90 text-white px-4 py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 shadow-lg shadow-primary/25 transition-all text-sm shrink-0"
        >
          <Plus className="w-4 h-4" /> New Campaign
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
            {["all", "running", "paused", "queued", "completed", "draft"].map((s) => (
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

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-7 h-7 animate-spin text-primary" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto">
            <Plus className="w-7 h-7 opacity-40" />
          </div>
          <p className="font-medium">{campaigns.length === 0 ? "No campaigns yet" : "No campaigns match your filters"}</p>
          {campaigns.length === 0 && (
            <Link href="/dashboard/campaigns/create" className="text-primary text-sm hover:underline">
              Create your first campaign →
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table Header */}
          <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/50">
            <div className="col-span-4">Name</div>
            <div className="col-span-2 text-center">Status</div>
            <div className="col-span-3 text-center">Progress</div>
            <div className="col-span-1 text-center">Contacts</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          <div className="space-y-3">
            {filtered.map((c, index) => (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Desktop Row */}
                <Link
                  href={`/dashboard/campaigns/${c.id}`}
                  className="hidden md:grid md:grid-cols-12 gap-4 px-6 py-4 items-center bg-card hover:shadow-lg hover:border-primary/20 transition-all border border-border/50 rounded-xl glass-panel group cursor-pointer"
                >
                  <div className="col-span-4 min-w-0">
                    <span className="font-semibold text-sm group-hover:text-primary transition-colors block truncate">{c.name}</span>
                    <span className="text-xs text-muted-foreground block truncate mt-0.5">
                      Cap: {c.dailyLimitPerAccount}/day · Created {new Date(c.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="col-span-2 flex justify-center">
                    <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border ${STATUS_STYLE[c.status] || STATUS_STYLE.draft}`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="col-span-3 px-4 space-y-1.5">
                    <div className="flex justify-between text-xs font-mono font-semibold">
                      <span>{c.messagesSent.toLocaleString()} sent</span>
                      <span>{progress(c)}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${c.status === "running" ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${progress(c)}%` }}
                      />
                    </div>
                  </div>

                  <div className="col-span-1 text-center font-mono text-sm font-semibold">
                    {c.totalContacts.toLocaleString()}
                  </div>

                  <div className="col-span-2 flex justify-end items-center gap-1.5" onClick={(e) => e.preventDefault()}>
                    {c.status === "running" ? (
                      <button className="p-1.5 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors" title="Pause" aria-label={`Pause ${c.name}`} disabled={actionId===c.id} onClick={()=>void changeStatus(c.id,"paused")}>
                        <Pause className="w-4 h-4" />
                      </button>
                    ) : c.status === "paused" ? (
                      <button className="p-1.5 text-muted-foreground hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg transition-colors" title="Resume" aria-label={`Resume ${c.name}`} disabled={actionId===c.id} onClick={()=>void changeStatus(c.id,"running")}>
                        <Play className="w-4 h-4" />
                      </button>
                    ) : null}
                    <button className="p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-lg transition-colors" title="Settings" aria-label={`Options for ${c.name}`} onClick={()=>router.push(`/dashboard/campaigns/${c.id}?tab=options`)}>
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </Link>

                {/* Mobile Card */}
                <Link
                  href={`/dashboard/campaigns/${c.id}`}
                  className="md:hidden block p-4 space-y-3 bg-card hover:shadow-lg hover:border-primary/20 transition-all border border-border/50 rounded-xl glass-panel"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="font-semibold text-sm leading-tight block truncate">{c.name}</span>
                      <div className="text-xs text-muted-foreground mt-1">{c.dailyLimitPerAccount}/day cap</div>
                    </div>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider shrink-0 border ${STATUS_STYLE[c.status] || STATUS_STYLE.draft}`}>
                      {c.status}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-mono font-bold">{progress(c)}%</span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-500 ${c.status === "running" ? "bg-emerald-500" : "bg-primary"}`}
                        style={{ width: `${progress(c)}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Sent</div>
                      <div className="text-sm font-mono font-bold">{c.messagesSent.toLocaleString()}</div>
                    </div>
                    <div className="bg-secondary/30 rounded-lg p-2.5 text-center">
                      <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-0.5">Total</div>
                      <div className="text-sm font-mono font-bold">{c.totalContacts.toLocaleString()}</div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
