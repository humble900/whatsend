"use client";
const CampaignSetup=dynamic(()=>import("@/components/CampaignSetup"));
const CampaignOptions=dynamic(()=>import("@/components/CampaignOptions"));
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState, useEffect, use, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import {
  ArrowLeft, BarChart2, Send, Calendar, Settings2,
  Play, Pause, CheckCircle2, XCircle, Clock,
  Loader2, Plus, X, AlertTriangle, Search,
  Users, ChevronRight, Trash2, MessageSquare, Download,
} from "lucide-react";
import type {ImportedContact} from "@/components/AddLeadsModal";
import dynamic from "next/dynamic";
const AddLeadsModal=dynamic(()=>import("@/components/AddLeadsModal"));

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = "analytics" | "leads" | "sequences" | "schedule" | "options";

interface Lead {
  id: string;
  phone: string;
  name?: string;
  waVerified?: "verified" | "unverified" | "invalid";
  leadStatus?: "new" | "replied" | "qualified" | "won" | "lost";
  messageStatus?: "sent" | "delivered" | "read" | "failed" | "queued" | null;
  source?: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  totalContacts: number;
  contactsProcessed: number;
  dailyLimitPerAccount: number;
  timezone: string;
  stopOnReply: boolean;
  delayMode: string;
  customDelayMin: number;
  customDelayMax: number;
  sendingWindows: { start: string; end: string }[];
  variants: any[];
  variantMode: string;
  createdAt: string;
  startedAt?: string;
  assignedAccounts: { id: string; name: string; phoneNumber: string | null; status: string }[];
  analytics: { total: number; sent: number; delivered:number; read:number; replied:number; skipped:number; cancelled:number; uncertain:number; processed:number; failed: number; queued: number; progress: number };
}

// ─── Lead Status Badges ───────────────────────────────────────────────────────

const LEAD_STATUS: Record<string, { label: string; cls: string }> = {
  new:       { label: "NEW",       cls: "bg-gray-100 text-gray-500 border-gray-200" },
  replied:   { label: "REPLIED",   cls: "bg-green-50 text-green-600 border-green-200" },
  qualified: { label: "QUALIFIED", cls: "bg-purple-50 text-purple-600 border-purple-200" },
  won:       { label: "WON",       cls: "bg-blue-50 text-blue-600 border-blue-200" },
  lost:      { label: "LOST",      cls: "bg-red-50 text-red-500 border-red-200" },
};

const MSG_STATUS: Record<string, { label: string; cls: string }> = {
  sent:      { label: "Sent",      cls: "text-green-600" },
  delivered: { label: "Delivered", cls: "text-blue-600" },
  read:      { label: "Read",      cls: "text-blue-700" },
  failed:    { label: "Failed", cls: "text-red-500" },
  queued:    { label: "Queued",    cls: "text-amber-600" },
};



const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "analytics", label: "Analytics", icon: BarChart2 },
  { key: "leads",     label: "Leads",     icon: Send },
  { key: "sequences", label: "Sequences", icon: MessageSquare },
  { key: "schedule",  label: "Schedule",  icon: Calendar },
  { key: "options",   label: "Options",   icon: Settings2 },
];

const STATUS_COLOR: Record<string, string> = {
  running:   "text-green-700 bg-green-50 border-green-200",
  paused:    "text-amber-700 bg-amber-50 border-amber-200",
  completed: "text-blue-700 bg-blue-50 border-blue-200",
  queued:    "text-purple-700 bg-purple-50 border-purple-200",
  draft:     "text-gray-500 bg-gray-100 border-gray-200",
};

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as Tab) || "analytics";

  const [tab, setTab] = useState<Tab>(initialTab);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [setupDirty,setSetupDirty]=useState(false);
  const changeTab=(next:Tab)=>{if(next===tab)return;if(setupDirty&&!window.confirm("Discard unsaved changes and switch tabs?"))return;setSetupDirty(false);setShowLaunch(false);setTab(next);};
  const [savingName, setSavingName] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");

  const [leads, setLeads] = useState<Lead[]>([]);
  const [leadFilter, setLeadFilter] = useState<"all" | "sent" | "replied" | "failed" | "opted_out">("all");
  const [leadSearch, setLeadSearch] = useState("");
  const [leadPage,setLeadPage]=useState(1);
  useEffect(()=>setLeadPage(1),[leadSearch,leadFilter,id]);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [showAddLeads, setShowAddLeads] = useState(false);
  const [showLaunch, setShowLaunch] = useState(false);

  const fetchVersion=useRef(0);
  const [loadingLeads,setLoadingLeads]=useState(initialTab==="leads");
  const fetchCampaign = useCallback(async () => {
    const version=++fetchVersion.current;
    if(tab==="leads")setLoadingLeads(true);
    try {
      const res = await authenticatedFetch(`/api/campaigns/${id}?includeLeads=${tab==="leads"}`, { headers: { } });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load");
      if(version!==fetchVersion.current)return;
      setError("");
      setCampaign(data.campaign);
      setLeads(data.leads || []);
      setDraftName(data.campaign.name);
    } catch (e: any) {
      if(version===fetchVersion.current)setError(e.message); } finally { if(version===fetchVersion.current){setLoading(false);setLoadingLeads(false);}
    }
  }, [id,tab]);

  useEffect(() => { void fetchCampaign(); }, [fetchCampaign]);
  useEffect(()=>{
    if(tab!=='analytics'||!campaign||campaign.status==='draft')return;
    let disposed=false,pending=false;
    const refresh=async()=>{if(pending||document.hidden)return;pending=true;try{const response=await authenticatedFetch(`/api/campaigns/${id}/analytics`);const data=await response.json();if(response.ok&&!disposed)setCampaign(previous=>previous?{...previous,analytics:data.analytics,status:data.status}:previous);}catch{/* Preserve the latest results while the network recovers. */}finally{pending=false;}};
    const timer=setInterval(()=>void refresh(),5000);return()=>{disposed=true;clearInterval(timer);};
  },[id,tab,campaign?.status]);

  const handleStatusChange = async (newStatus: string) => {
    setActionLoading(true);
    try {
      await authenticatedFetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ status: newStatus }),
      });
      await fetchCampaign();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not change campaign state."); } finally { setActionLoading(false); }
  };

  const saveName = async () => {
    if (!draftName.trim() || draftName === campaign?.name) { setEditingName(false); return; }
    setSavingName(true);
    try {
      await authenticatedFetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ name: draftName.trim() }),
      });
      setCampaign(c => c ? { ...c, name: draftName.trim() } : c);
    } catch { } finally { setSavingName(false); setEditingName(false); }
  };

  const removeLeads = async (ids:string[]) => {
    if (!ids.length) return;
    try { await authenticatedFetch(`/api/campaigns/${id}/leads`, {method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({ids})}); setSelectedLeads(new Set()); await fetchCampaign(); }
    catch(cause){setError(cause instanceof Error?cause.message:"Could not remove recipients.");}
  };
  const deleteCampaign = async () => {
    if(!confirm("Delete this campaign and its recipient setup? Conversation history is kept."))return;
    try {await authenticatedFetch(`/api/campaigns/${id}`,{method:"DELETE"});router.push("/dashboard/campaigns");}catch(cause){setError(cause instanceof Error?cause.message:"Could not delete campaign.");}
  };
  const filteredLeads = leads.filter(l => {
    if (leadSearch && !`${l.phone}${l.name || ""}`.toLowerCase().includes(leadSearch.toLowerCase())) return false;
    if (leadFilter === "sent") return ["sent", "delivered", "read"].includes(l.messageStatus || "");
    if (leadFilter === "replied") return l.leadStatus === "replied";
    if (leadFilter === "failed") return l.messageStatus === "failed";
    if (leadFilter === "opted_out") return l.leadStatus === "lost";
    return true;
  });

  const COUNTS = {
    all: leads.length,
    sent: leads.filter(l => ["sent", "delivered", "read"].includes(l.messageStatus || "")).length,
    replied: leads.filter(l => l.leadStatus === "replied").length,
    failed: leads.filter(l => l.messageStatus === "failed").length,
    opted_out: leads.filter(l => l.leadStatus === "lost").length,
  };

  // ── Loading / error ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-white">
        <Loader2 className="w-7 h-7 animate-spin text-gray-300" />
      </div>
    );
  }

  if (error || !campaign) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 bg-white">
        <AlertTriangle className="w-10 h-10 text-red-400" />
        <p className="text-gray-500 text-sm">{error || "Campaign not found"}</p>
        <Link href="/dashboard/campaigns" className="text-sm text-green-600 hover:underline">← Back to campaigns</Link>
      </div>
    );
  }

  const { analytics } = campaign;

  return (
    <div className="flex flex-col min-h-screen bg-white">

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-30 bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
        <Link
          href="/dashboard/campaigns"
          className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>

        {/* Editable name */}
        {editingName ? (
          <form onSubmit={e => { e.preventDefault(); saveName(); }} className="flex items-center gap-2 flex-1 min-w-0">
            <input
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={saveName}
              className="flex-1 min-w-0 border-b-2 border-green-500 bg-transparent text-sm font-semibold text-gray-900 focus:outline-none pb-0.5"
            />
            {savingName && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400 shrink-0" />}
          </form>
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="flex items-center gap-2 flex-1 min-w-0 group text-left"
            title="Click to rename"
          >
            <span className="font-semibold text-sm text-gray-900 truncate group-hover:text-green-700 transition-colors">
              {campaign.name}
            </span>
            <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wide ${STATUS_COLOR[campaign.status] || STATUS_COLOR.draft}`}>
              {campaign.status}
            </span>
          </button>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 ml-auto shrink-0">

          {campaign.status === "running" ? (
            <button onClick={() => handleStatusChange("paused")} disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors">
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Pause className="w-3.5 h-3.5" />}
              Pause
            </button>
          ) : campaign.status === "paused" ? (
            <button onClick={() => handleStatusChange("running")} disabled={actionLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors">
              {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
              Resume
            </button>
          ) : campaign.status === 'draft' ? (
            <button
              disabled={setupDirty}
              aria-disabled={setupDirty}
              title={setupDirty?"Save or discard your changes before reviewing launch.":undefined}
              onClick={() => setShowLaunch(previous=>!previous)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play className="w-3.5 h-3.5" fill="currentColor" /> Review &amp; Launch
            </button>
          ) : null}
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-100 bg-white px-6">
        <div className="flex items-center gap-0 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => changeTab(key)}
              className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium whitespace-nowrap transition-colors ${
                tab === key ? "text-gray-900" : "text-gray-400 hover:text-gray-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              {tab === key && (
                <motion.div layoutId="tab-line" className="absolute bottom-0 left-0 right-0 h-0.5 bg-green-600 rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-7 max-w-6xl mx-auto w-full">
        {showLaunch && campaign.status === "draft" && <CampaignSetup campaign={campaign} mode="launch" onSaved={fetchCampaign} />}
      <AnimatePresence mode="wait">

          {/* ═══ ANALYTICS ══════════════════════════════════════════════════ */}
          {tab === "analytics" && (
            <motion.div key="analytics" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {analytics.total > 0 && (
                <div className="mb-6 p-5 rounded-xl border border-gray-100 bg-gray-50">
                  <div className="flex justify-between text-sm mb-3">
                    <span className="font-semibold text-gray-700">Campaign Progress</span>
                    <span className="text-gray-400">{analytics.processed} / {analytics.total} processed</span>
                  </div>
                  <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${analytics.progress}%` }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      className="h-full bg-green-500 rounded-full"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1.5">{analytics.progress.toFixed(1)}% complete</p>
                </div>
              )}

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Total Leads", value: analytics.total || campaign.totalContacts, icon: Users, cls: "text-gray-900" },
                  { label: "Sent",        value: analytics.sent,   icon: Send,       cls: "text-green-600" },
                  { label: "Delivered", value: analytics.delivered, icon: CheckCircle2, cls: "text-green-600" },
                  { label: "Read", value: analytics.read, icon: CheckCircle2, cls: "text-green-600" },
                  { label: "Replied", value: analytics.replied, icon: MessageSquare, cls: "text-green-600" },
                  { label: "Skipped / cancelled", value: analytics.skipped+analytics.cancelled, icon: Clock, cls: "text-gray-500" },
                  { label: "Needs review", value: analytics.uncertain, icon: AlertTriangle, cls: "text-amber-600" },
                  { label: "Failed",      value: analytics.failed, icon: XCircle,    cls: "text-red-500" },
                  { label: "Queued",      value: analytics.queued, icon: Clock,      cls: "text-amber-600" },
                ].map(({ label, value, icon: Icon, cls }) => (
                  <div key={label} className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                      <Icon className={`w-4 h-4 ${cls}`} />
                    </div>
                    <p className={`text-3xl font-bold ${cls}`}>{value.toLocaleString()}</p>
                  </div>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-gray-800">Campaign Settings</p>
                  {[
                    ["Delay Mode", campaign.delayMode === "smart" ? "Smart (15–45s random)" : `Custom (${campaign.customDelayMin}–${campaign.customDelayMax}s)`],
                    ["Daily Limit", `${campaign.dailyLimitPerAccount} msg/account`],
                    ["Variant Mode", campaign.variantMode.replace("_", " ")],
                    ["Time zone", campaign.timezone],
                    ["Created", new Date(campaign.createdAt).toLocaleDateString()],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-medium text-gray-700 capitalize">{v}</span>
                    </div>
                  ))}
                </div>
                <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3">
                  <p className="text-sm font-semibold text-gray-800">Sending Windows</p>
                  {campaign.sendingWindows.length > 0 ? campaign.sendingWindows.map((w, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700">
                      <Clock className="w-3.5 h-3.5 text-green-500 shrink-0" />{w.start} – {w.end}
                    </div>
                  )) : <p className="text-sm text-gray-400">24/7 (instant mode)</p>}
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ LEADS ══════════════════════════════════════════════════════ */}
          {tab === "leads" && (
            <motion.div key="leads" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              {/* Header row */}
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Campaign Leads List</h2>
                  {leads.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">Targeting list: <span className="font-medium text-gray-600">{campaign.name}</span></p>
                  )}
                </div>
                {leads.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button className="text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors">Change List</button>
                    <button
                      onClick={() => { if (confirm("Remove all recipients from this draft?")) void removeLeads(leads.map(lead=>lead.id)); }}
                      className="text-xs px-3 py-1.5 rounded-lg text-red-500 border border-red-100 hover:bg-red-50 transition-colors"
                    >Remove</button>
                  </div>
                )}
              </div>

              {loadingLeads ? (<div className="flex justify-center p-8"><Loader2 className="animate-spin text-green-600" aria-label="Loading recipients" /></div>) : leads.length === 0 ? (
                /* Empty state */
                <div className="flex flex-col items-center justify-center py-24 text-center border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                  <div className="w-14 h-14 rounded-2xl bg-green-50 border border-green-100 flex items-center justify-center mb-5">
                    <Users className="w-7 h-7 text-green-500" />
                  </div>
                  <h3 className="font-semibold text-gray-800 mb-1.5">No leads added yet</h3>
                  <p className="text-sm text-gray-400 max-w-xs mb-7">
                    Import a CSV, paste phone numbers, or pick from your CRM to start.
                  </p>
                  <button
                    onClick={() => setShowAddLeads(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Add Leads
                  </button>
                </div>
              ) : (
                /* Leads table */
                <div className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                  {/* Toolbar */}
                  <div className="p-4 border-b border-gray-100 bg-white flex items-center gap-3 flex-wrap">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                      <input
                        type="text"
                        value={leadSearch}
                        onChange={e => setLeadSearch(e.target.value)}
                        placeholder="Search phone or name..."
                        className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none"
                      />
                    </div>

                    {/* Filter chips */}
                    <div className="flex items-center gap-1.5 overflow-x-auto">
                      {(["all", "sent", "replied", "failed", "opted_out"] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setLeadFilter(f)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                            leadFilter === f
                              ? "bg-green-600 text-white"
                              : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                          }`}
                        >
                          {f === "all" ? "All Leads" : f.charAt(0).toUpperCase() + f.slice(1).replace("_", " ")}
                          <span className={`text-[10px] font-bold px-1 rounded ${leadFilter === f ? "bg-white/20" : "bg-white/60"}`}>
                            {COUNTS[f]}
                          </span>
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setShowAddLeads(true)}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 transition-colors ml-auto shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" /> Add Leads
                    </button>
                  </div>

                  {/* Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          <th className="p-3 w-10">
                            <input type="checkbox"
                              checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                              onChange={e => setSelectedLeads(e.target.checked ? new Set(filteredLeads.map(l => l.id)) : new Set())}
                              className="rounded accent-green-600 w-4 h-4 border-gray-300"
                            />
                          </th>
                          <th className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-8">#</th>
                          {["Phone Number", "Name", "WhatsApp Verified", "Lead Status", "Message Status", "Source"].map(h => (
                            <th key={h} className="px-3 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                          ))}
                          <th className="w-10" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {filteredLeads.slice((leadPage-1)*50,leadPage*50).map((lead, i) => (
                          <tr key={lead.id} className={`hover:bg-gray-50/80 transition-colors ${selectedLeads.has(lead.id) ? "bg-green-50/40" : "bg-white"}`}>
                            <td className="p-3">
                              <input type="checkbox" checked={selectedLeads.has(lead.id)}
                                onChange={e => {
                                  const next = new Set(selectedLeads);
                                  e.target.checked ? next.add(lead.id) : next.delete(lead.id);
                                  setSelectedLeads(next);
                                }}
                                className="rounded accent-green-600 w-4 h-4 border-gray-300"
                              />
                            </td>
                            <td className="px-3 py-3.5 text-gray-300 text-xs font-medium">{i + 1}</td>
                            <td className="px-3 py-3.5 font-mono font-semibold text-gray-800 text-sm">+{lead.phone}</td>
                            <td className="px-3 py-3.5 text-gray-700 text-sm">{lead.name || <span className="text-gray-300">—</span>}</td>
                            <td className="px-3 py-3.5">
                              {lead.waVerified === "verified" ? (
                                <span className="flex items-center gap-1 text-xs text-green-600 font-medium"><CheckCircle2 className="w-3.5 h-3.5" /> Verified</span>
                              ) : lead.waVerified === "invalid" ? (
                                <span className="flex items-center gap-1 text-xs text-red-500"><XCircle className="w-3.5 h-3.5" /> Invalid</span>
                              ) : (
                                <span className="flex items-center gap-1 text-xs text-gray-400"><Clock className="w-3.5 h-3.5" /> Unverified</span>
                              )}
                            </td>
                            <td className="px-3 py-3.5">
                              {lead.leadStatus ? (
                                <span className={`text-[10px] px-2 py-0.5 rounded border font-bold uppercase ${LEAD_STATUS[lead.leadStatus]?.cls}`}>
                                  {LEAD_STATUS[lead.leadStatus]?.label}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-3.5">
                              {lead.messageStatus ? (
                                <span className={`text-xs font-medium ${MSG_STATUS[lead.messageStatus]?.cls}`}>
                                  {MSG_STATUS[lead.messageStatus]?.label}
                                </span>
                              ) : <span className="text-gray-300">—</span>}
                            </td>
                            <td className="px-3 py-3.5 text-xs text-gray-400">
                              <span className="flex items-center gap-1"><Users className="w-3 h-3" />{lead.source || "Manual Entry"}</span>
                            </td>
                            <td className="px-3 py-3.5">
                              <button
                                onClick={() => void removeLeads([lead.id])}
                                className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Bulk action bar */}
                  {selectedLeads.size > 0 && (
                    <div className="p-3 border-t border-gray-100 bg-green-50 flex items-center gap-3 text-sm">
                      <span className="font-semibold text-green-700">{selectedLeads.size} selected</span>
                      <button
                        onClick={() => void removeLeads([...selectedLeads])}
                        className="flex items-center gap-1 text-red-500 hover:underline text-xs font-medium"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove selected
                      </button>
                    </div>
                  )}

                  {/* Footer nav */}
                  <div className="p-4 border-t border-gray-100 bg-white flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3 text-xs text-gray-500"><span>{filteredLeads.length?Math.min((leadPage-1)*50+1,filteredLeads.length):0}–{Math.min(leadPage*50,filteredLeads.length)} of {filteredLeads.length}</span><button type="button" aria-label="Previous recipients" disabled={leadPage===1} onClick={()=>setLeadPage(page=>page-1)} className="disabled:opacity-40">Previous</button><button type="button" aria-label="Next recipients" disabled={leadPage*50>=filteredLeads.length} onClick={()=>setLeadPage(page=>page+1)} className="disabled:opacity-40">Next</button></div>
                    <button
                      onClick={() => changeTab("sequences")}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors"
                    >
                      Next: Sequences <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══ SEQUENCES ══════════════════════════════════════════════════ */}
          {tab === "sequences" && (
            <motion.div key="sequences" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div>
                <h2 className="text-base font-bold text-gray-900">Message Sequences</h2>
                <p className="text-sm text-gray-400 mt-0.5">Define message variants for A/B testing.</p>
              </div>
              {campaign.status === "draft" && <CampaignSetup key={campaign.id} campaign={campaign} mode="message" onSaved={fetchCampaign} onDirtyChange={setSetupDirty} />}
              {campaign.status !== "draft" && (campaign.variants && campaign.variants.length > 0 ? (
                <div className="space-y-3">
                  {campaign.variants.map((v: any, i: number) => (
                    <div key={v.id || i} className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded">{v.label || `Variant ${i + 1}`}</span>
                        {v.weight && <span className="text-xs text-gray-400">Weight {v.weight}</span>}
                      </div>
                      <p className="text-sm font-mono bg-gray-50 p-3 rounded-lg border border-gray-100 text-gray-600">{v.spintaxTemplate}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                  <MessageSquare className="w-10 h-10 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm text-gray-500 font-medium">No message sequences yet.</p>
                  <p className="text-xs text-gray-400 mt-1">Set up your campaign messages here.</p>
                </div>
              ))}
            </motion.div>
          )}

          {/* ═══ SCHEDULE ═══════════════════════════════════════════════════ */}
          {tab === "schedule" && (
            <motion.div key="schedule" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              {campaign.status === "draft" && <CampaignSetup key={campaign.id} campaign={campaign} mode="schedule" onSaved={fetchCampaign} onDirtyChange={setSetupDirty} />}
              <div>
                <h2 className="text-base font-bold text-gray-900">Schedule</h2>
                <p className="text-sm text-gray-400 mt-0.5">Configure when and how fast messages are sent.</p>
              </div>
              {campaign.status !== "draft" && <div className="grid sm:grid-cols-2 gap-4">
                <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3">
                  <p className="font-semibold text-sm text-gray-800">Sending Windows</p>
                  <p className="text-xs text-gray-500">Time zone: {campaign.timezone}</p>
                  {campaign.sendingWindows.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm p-3 bg-gray-50 rounded-lg border border-gray-100">
                      <Clock className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-gray-700">{w.start} – {w.end}</span>
                    </div>
                  ))}
                  {campaign.sendingWindows.length === 0 && <p className="text-sm text-gray-400">24/7 sending (instant mode)</p>}
                </div>
                <div className="p-5 rounded-xl border border-gray-100 bg-white shadow-sm space-y-3">
                  <p className="font-semibold text-sm text-gray-800">Speed Settings</p>
                  {[
                    ["Delay Mode", campaign.delayMode],
                    ["Min Delay", `${campaign.customDelayMin}s`],
                    ["Max Delay", `${campaign.customDelayMax}s`],
                    ["Daily Limit", `${campaign.dailyLimitPerAccount} msg / account`],
                  ].map(([k, v]) => (
                    <div key={k} className="flex justify-between text-sm">
                      <span className="text-gray-400">{k}</span>
                      <span className="font-medium text-gray-700 capitalize">{v}</span>
                    </div>
                  ))}
                </div>
              </div>}
            </motion.div>
          )}

          {/* ═══ OPTIONS ════════════════════════════════════════════════════ */}
          {tab === "options" && (
            <motion.div key="options" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-5">
              <div>

                <p className="text-sm text-gray-400 mt-0.5">Choose sending accounts, set limits, and manage replies.</p>
              </div>
              <CampaignOptions key={campaign.id} campaign={campaign} onSaved={fetchCampaign} onEditMessages={()=>changeTab("sequences")} onDirtyChange={setSetupDirty}/>
              <div className="p-5 rounded-xl border border-red-100 bg-red-50/50 space-y-4">
                <p className="font-semibold text-sm text-red-600">Danger Zone</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800">Delete Campaign</p>
                    <p className="text-xs text-gray-400">Removes the campaign and recipient setup. Conversation history is kept.</p>
                  </div>
                  <button onClick={() => void deleteCampaign()} className="px-4 py-2 rounded-lg border border-red-200 text-red-500 text-sm font-medium hover:bg-red-100 transition-colors">
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {error && <p role="alert" className="app-error">{error}</p>}
      {/* ── Add Leads Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showAddLeads && (
          <AddLeadsModal
            mode="leads"
            onClose={() => setShowAddLeads(false)}
            onAdd={async (contacts) => { await authenticatedFetch(`/api/campaigns/${id}/leads`, {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({contacts})}); await fetchCampaign(); }}
          />
        )}
      </AnimatePresence>

    </div>
  );
}
