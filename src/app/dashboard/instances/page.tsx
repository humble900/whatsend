"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Smartphone, ShieldCheck, Zap, MoreVertical, Wifi, WifiOff, 
  CheckCircle2, Loader2, X, Cloud, Phone, SlidersHorizontal, Activity, Settings, Trash2, Search, Filter, QrCode
} from "lucide-react";

export default function InstancesPage() {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<"qr" | "pairing">("qr");
  const [generating, setGenerating] = useState(false);
  const [instances, setInstances] = useState<any[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [visibleLimit,setVisibleLimit]=useState(50);
  useEffect(()=>setVisibleLimit(50),[searchQuery,filterStatus]);

  const providerStats = {
    whatsapp_web: instances.filter(i => i.status === "connected").length, // Simplification for now, all current instances are WA Web
    direct_meta: 0, // Direct Meta is not yet fully implemented
    twilio: 0,
  };

  const [instanceLabel, setInstanceLabel] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [qrcodeBase64, setQrcodeBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<any | null>(null);
  const [editDailyLimit, setEditDailyLimit] = useState(25);

  const fetchingInstances=useRef(false);
  const fetchInstances = async () => {
    if(fetchingInstances.current)return;
    fetchingInstances.current=true;
    try {
      const res = await authenticatedFetch("/api/instances", {
        headers: { }
      });
      const data = await res.json();
      if (data.instances) {
        setInstances(data.instances);
        // Connection webhooks maintain these statuses. Only a number being
        // paired needs live provider polling; do not fan out over every account.
        setError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load connections.");
    } finally {
      setLoadingInstances(false);
      fetchingInstances.current=false;
    }
  };

  useEffect(() => {
    fetchInstances();
    const interval = setInterval(() => { if (!document.hidden) void fetchInstances(); }, 15000);
    return () => { clearInterval(interval); stopPolling(); };
    // Connection detection is handled by the polling mechanism in startPolling()
    // which queries Evolution API directly via /api/instances/[id]/status
  }, []);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [currentInstanceDbId, setCurrentInstanceDbId] = useState<string | null>(null);

  // Stop polling when modal closes or component unmounts
  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Poll Evolution API to detect connection success (works even without webhooks)
  const startPolling = (dbInstanceId: string) => {
    stopPolling();
    
    pollingRef.current = setInterval(async () => {
      try {
        const res = await authenticatedFetch(`/api/instances/${dbInstanceId}/status`, {
          headers: { }
        });
        const data = await res.json();
        
        // Duplicate phone number blocked — show error and stop
        if (data.duplicateBlocked) {
          stopPolling();
          setError(data.error);
          setQrcodeBase64(null);
          setPairingCode(null);
          fetchInstances();
          return;
        }

        if (data.status === "connected") {
          stopPolling();
          setConnectModalOpen(false);
          setQrcodeBase64(null);
          setPairingCode(null);
          fetchInstances();
        }
      } catch (err) {
        console.warn("Polling error:", err);
      }
    }, 4000);
  };

  const handleCreateInstance = async () => {
    if (!instanceLabel.trim()) {
      setError("Instance Label is required.");
      return;
    }
    if (connectionMethod === "pairing" && !phoneNumber.trim()) {
      setError("Phone number is required for pairing code.");
      return;
    }

    setError(null);
    setGenerating(true);

    try {
      const res = await authenticatedFetch("/api/instances", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          },
        body: JSON.stringify({
          instanceName: instanceLabel,
          phoneNumber: connectionMethod === "pairing" ? phoneNumber : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create instance");

      if (data.connected) { setConnectModalOpen(false); await fetchInstances(); return; }
      if (data.qrcodeBase64) {
        const hasPrefix = data.qrcodeBase64.startsWith("data:image");
        setQrcodeBase64(hasPrefix ? data.qrcodeBase64 : `data:image/png;base64,${data.qrcodeBase64}`);
      }
      if (data.pairingCode) setPairingCode(data.pairingCode);

      // Use the DB ID returned directly from the API for polling
      if (data.dbId) {
        setCurrentInstanceDbId(data.dbId);
        startPolling(data.dbId);
      }

      fetchInstances(); // Refresh the list in background

    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const openConnect = (provider: string, initialName = "") => {
    setSelectedProvider(provider);
    setConnectionMethod("qr");
    setInstanceLabel(initialName);
    setConnectModalOpen(true);
  };

  const closeConnect = () => {
    stopPolling();
    setConnectModalOpen(false);
    setTimeout(() => {
      setSelectedProvider(null);
      setGenerating(false);
      setInstanceLabel("");
      setPhoneNumber("");
      setQrcodeBase64(null);
      setPairingCode(null);
      setError(null);
      setCurrentInstanceDbId(null);
    }, 300);
  };

  const handleReconnect = async (instance: any) => {
    openConnect("whatsapp_web", instance.name);
    setGenerating(true);
    setError(null);
    try {
      const res = await authenticatedFetch("/api/instances", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          },
        body: JSON.stringify({ instanceName: instance.name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reconnect");
      if (data.connected) {setConnectModalOpen(false);await fetchInstances();return;}
      
      if (data.qrcodeBase64) {
        const hasPrefix = data.qrcodeBase64.startsWith("data:image");
        setQrcodeBase64(hasPrefix ? data.qrcodeBase64 : `data:image/png;base64,${data.qrcodeBase64}`);
      } else {
        setError("No QR code received. Please try again.");
        return;
      }
      
      // Use dbId from API response (or fallback to instance.id)
      const pollId = data.dbId || instance.id;
      setCurrentInstanceDbId(pollId);
      startPolling(pollId);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleLogout = async (instanceId: string) => {
    try {
      await authenticatedFetch(`/api/instances/${instanceId}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          },
        body: JSON.stringify({ action: "logout" })
      });
      fetchInstances();
    } catch (err) {
      console.error("Failed to logout instance", err);
    }
  };

  const handleDelete = (instance: any) => {
    setDeleteTarget({ id: instance.id, name: instance.name });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    // Optimistic UI: remove from list immediately
    setInstances(prev => prev.filter(i => i.id !== deleteTarget.id));
    setDeleteTarget(null);
    try {
      await authenticatedFetch(`/api/instances/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { }
      });
    } catch (err) {
      console.error("Failed to delete instance", err);
      fetchInstances(); // Revert on failure
    } finally {
      setDeleting(false);
    }
  };

  const filteredInstances = instances.filter((inst) => {
    const matchesSearch = inst.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = filterStatus === "all" || inst.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          
          <p className="text-muted-foreground text-sm sm:text-lg">
            Connect and manage your WhatsApp devices and Cloud API endpoints.
          </p>
        </div>
      </div>

      {/* ── Section 2: Integrations Directory ── */}
      <div className="space-y-3">
        <div className="flex justify-between items-center border-b border-border/50 pb-2">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Available Channel Providers</h2>
        </div>

        <div className="border border-border/50 rounded-xl overflow-hidden glass-panel divide-y divide-border/50">
          
          {/* Integration 1: WhatsApp Web */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors text-left">
            <div className="flex items-start gap-4">
               <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl mt-0.5 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-xl text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">WhatsApp Web (Evolution API)</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-500 rounded">Recommended</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Link a standard WhatsApp Web account instantly using a QR code or Pairing code. Supports direct conversations through a linked device. This connection uses WhatsApp Web through Evolution API.
                </p>
              </div>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              {providerStats.whatsapp_web > 0 ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Connected ({providerStats.whatsapp_web})
                  </span>
                  <button onClick={() => openConnect("whatsapp_web")} className="px-3 py-1.5 text-xs font-medium border border-border/50 rounded-lg hover:bg-secondary/50 transition-colors">
                    Add New
                  </button>
                </div>
              ) : (
                <button onClick={() => openConnect("whatsapp_web")} className="px-4 py-2 bg-primary text-white text-xs font-bold rounded-lg shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all">
                  Connect
                </button>
              )}
            </div>
          </div>

          {/* Integration 2: Direct Meta */}
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors text-left">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl mt-0.5 shrink-0">
                <Cloud className="w-6 h-6" />
              </div>
              <div className="space-y-1 max-w-xl text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">Direct Meta WhatsApp (Cloud API)</span>
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-blue-500/10 text-blue-500 rounded">Official</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Official Cloud API messaging needs a separate template and webhook integration. Current connections use Evolution.
                </p>
              </div>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              <span className="text-xs text-muted-foreground">Not enabled</span>
            </div>
          </div>

        </div>
      </div>

      {/* ── Section 1: Active Connections ── */}
      <div className="space-y-4 pt-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Active Workspace Connections</h2>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search accounts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-4 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors w-full sm:w-64"
              />
            </div>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-1.5 bg-secondary/50 border border-border/50 rounded-lg text-sm focus:outline-none focus:border-primary transition-colors appearance-none"
            >
              <option value="all">All Statuses</option>
              <option value="connected">Connected</option>
              <option value="banned">Banned</option>
              <option value="syncing">Syncing</option>
              <option value="disconnected">Disconnected</option>
            </select>
          </div>
        </div>

        <div className="glass-panel rounded-2xl overflow-hidden border border-border/50">
          {loadingInstances ? (
            <div className="text-center p-8 text-muted-foreground flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredInstances.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mb-4 border border-border/50">
                <WifiOff className="w-8 h-8 opacity-50" />
              </div>
              <p className="text-base font-semibold text-foreground mb-1">No Connections Found</p>
              <p className="text-sm max-w-sm mb-6">
                You haven't connected any WhatsApp accounts matching your criteria yet.
              </p>
              {searchQuery || filterStatus !== "all" ? (
                <button 
                  onClick={() => { setSearchQuery(""); setFilterStatus("all"); }}
                  className="px-4 py-2 bg-secondary text-foreground text-sm font-semibold rounded-lg border border-border hover:bg-secondary/80 transition-colors"
                >
                  Clear Filters
                </button>
              ) : (
                <button 
                  onClick={() => openConnect("whatsapp_web")}
                  className="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-lg shadow-lg shadow-primary/25 hover:bg-primary/90 transition-colors"
                >
                  Connect an Account
                </button>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredInstances.slice(0,visibleLimit).map((instance, index) => (
                <motion.div
                  key={instance.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-secondary/20 transition-colors"
                >
                  <div className="flex items-start sm:items-center gap-4">
                    <div className={`p-2.5 rounded-xl shrink-0 ${
                      instance.status === "connected" ? "bg-emerald-500/10 text-emerald-500" :
                      instance.status === "banned" ? "bg-red-500/10 text-red-500" :
                      "bg-yellow-500/10 text-yellow-500"
                    }`}>
                      <Smartphone className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-sm">{instance.name}</span>
                        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full select-none ${
                          instance.status === "connected" ? "bg-emerald-500/10 text-emerald-500" : 
                          instance.status === "banned" ? "bg-red-500/10 text-red-500" : 
                          "bg-yellow-500/10 text-yellow-500"
                        }`}>
                          {instance.status}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-2 font-mono">
                        <Activity className="w-3.5 h-3.5 text-primary" />
                        <span>{instance.messagesSentToday || 0} / {instance.dailyLimit || 25} sent today</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 self-end sm:self-auto">
                    {instance.status !== "connected" && (
                      <button 
                        onClick={() => handleReconnect(instance)}
                        className="px-3 py-1.5 text-xs font-semibold bg-emerald-500/10 text-emerald-500 rounded-lg hover:bg-emerald-500/20 transition-colors"
                      >
                        Reconnect
                      </button>
                    )}
                    {instance.status === "connected" && (
                      <button 
                        onClick={() => handleLogout(instance.id)}
                        className="px-3 py-1.5 text-xs font-semibold bg-yellow-500/10 text-yellow-500 rounded-lg hover:bg-yellow-500/20 transition-colors"
                      >
                        Disconnect
                      </button>
                    )}
                    <button 
                      onClick={() => { setSettingsTarget(instance); setEditDailyLimit(instance.dailyLimit || 25); }}
                      className="p-2 text-muted-foreground hover:bg-secondary/50 rounded-lg transition-colors" title="Settings"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(instance)}
                      className="p-2 text-muted-foreground hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors" 
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {filteredInstances.length>visibleLimit&&<div className="flex items-center justify-between text-sm"><span>Showing {visibleLimit} of {filteredInstances.length} accounts</span><button type="button" onClick={()=>setVisibleLimit(limit=>limit+50)} className="profile-button">Show more accounts</button></div>}
      {/* ── Connect Modal ── */}
      <AnimatePresence>
        {connectModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={closeConnect}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md max-h-[90vh] glass-panel bg-white/95 dark:bg-[#131318]/95 backdrop-blur-2xl border border-border/50 rounded-2xl shadow-2xl shadow-black/20 z-50 flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-secondary/30">
                <h3 className="font-semibold flex items-center gap-2 text-foreground">
                  {selectedProvider === "whatsapp_web" && <Smartphone className="w-5 h-5 text-emerald-500" />}
                  {selectedProvider === "direct_meta" && <Cloud className="w-5 h-5 text-blue-500" />}
                  Connect {selectedProvider === "whatsapp_web" ? "WhatsApp Web" : "Cloud API"}
                </h3>
                <button onClick={closeConnect} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4 overflow-y-auto">
                {selectedProvider === "whatsapp_web" ? (
                  <>
                    <div className="flex bg-secondary/50 p-1 rounded-xl">
                      <button 
                        onClick={() => { setConnectionMethod("qr"); setGenerating(false); }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${connectionMethod === "qr" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        QR Code
                      </button>
                      <button 
                        onClick={() => { setConnectionMethod("pairing"); setGenerating(false); }}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${connectionMethod === "pairing" ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                      >
                        Pairing Code
                      </button>
                    </div>

                    {error && (
                      <div className="bg-red-500/10 text-red-500 text-xs p-3 rounded-lg border border-red-500/20">
                        {error}
                      </div>
                    )}

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-muted-foreground">Instance Label</label>
                      <input 
                        type="text" 
                        placeholder="e.g. Sales Team B"
                        value={instanceLabel}
                        onChange={(e) => setInstanceLabel(e.target.value)}
                        className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                      />
                    </div>

                    {connectionMethod === "qr" ? (
                      <div className="flex flex-col md:flex-row gap-6 items-start mt-4">
                        <div className="flex-1 space-y-4">
                          <h3 className="font-semibold text-foreground text-sm">
                            Use WhatsApp on Whatsend
                          </h3>
                          <ol className="text-[13px] text-muted-foreground text-left space-y-2 list-decimal list-inside font-medium leading-relaxed">
                            <li>Open WhatsApp on your phone</li>
                            <li>
                              Tap <strong className="text-foreground font-semibold">Menu</strong> on Android, or <strong className="text-foreground font-semibold">Settings</strong> on iPhone
                            </li>
                            <li>
                              Tap <strong className="text-foreground font-semibold">Linked Devices</strong> and then <strong className="text-foreground font-semibold">Link a Device</strong>
                            </li>
                            <li>Point your phone to this screen to capture the code</li>
                          </ol>
                          
                          {!qrcodeBase64 && (
                            <button 
                              onClick={handleCreateInstance}
                              disabled={generating || !instanceLabel}
                              className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors mt-4"
                            >
                              {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <QrCode className="w-4 h-4 mr-2" />}
                              {generating ? "Generating QR..." : "Generate QR Code"}
                            </button>
                          )}
                        </div>

                        <div className="flex-shrink-0 flex items-center justify-center w-full md:w-auto">
                          <div className="relative w-[240px] h-[240px] flex items-center justify-center">
                            {generating ? (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-white rounded-2xl border border-black/5 shadow-sm">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <span className="mt-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Loading...</span>
                              </div>
                            ) : qrcodeBase64 ? (
                              <div className="relative bg-white rounded-2xl p-4 flex justify-center items-center aspect-square animate-in fade-in zoom-in duration-500 shadow-[0_8px_24px_rgba(0,0,0,0.08)] border border-black/5">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={qrcodeBase64} alt="WhatsApp QR Code" className="w-full h-full object-contain [image-rendering:pixelated]" />
                              </div>
                            ) : (
                              <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-900/50 rounded-2xl border border-dashed border-zinc-200 dark:border-zinc-800">
                                <QrCode className="w-8 h-8 opacity-20 mb-3" />
                                <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Ready to scan</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Connect instantly using an 8-digit pairing code. Enter the phone number of the WhatsApp account you want to link.
                        </p>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-muted-foreground">WhatsApp Phone Number</label>
                          <div className="relative">
                            <Phone className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                            <input 
                              type="tel" 
                              placeholder="e.g. 2348012345678 or 447911123456"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="w-full pl-9 bg-background border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            Enter full number with country code, no + or spaces (e.g. Nigeria: 234..., UK: 44..., US: 1..., India: 91...)
                          </p>
                        </div>
                        {pairingCode ? (
                          <div className="bg-secondary/50 border border-border/50 rounded-xl p-6 text-center space-y-3 animate-in fade-in zoom-in duration-300">
                            <p className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Your Pairing Code</p>
                            <div className="text-3xl font-mono font-black text-primary tracking-[0.2em]">
                              {pairingCode.match(/.{1,4}/g)?.join("-") || pairingCode}
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Open WhatsApp {">"} Linked Devices {">"} Link with Phone Number and enter this code.
                            </p>
                          </div>
                        ) : (
                          <button 
                            onClick={handleCreateInstance}
                            disabled={generating}
                            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors mt-2"
                          >
                            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Get Pairing Code
                          </button>
                        )}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Phone Number ID</label>
                        <input type="text" className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">WABA ID</label>
                        <input type="text" className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">System Access Token</label>
                        <input type="password" className="w-full bg-background border border-border/50 rounded-xl px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/40 font-mono" />
                      </div>
                      <button className="w-full bg-primary hover:bg-primary/90 text-white py-2.5 rounded-xl text-sm font-semibold mt-2 transition-colors">
                        Save Connection
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Delete Confirmation Modal ── */}
      <AnimatePresence>
        {deleteTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              onClick={() => setDeleteTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-md"
            >
              <div className="bg-white rounded-2xl border-2 border-red-200 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-red-100 text-red-600 rounded-xl">
                    <Trash2 className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">Delete Connection</h3>
                    <p className="text-sm text-gray-500">This action cannot be undone</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600 leading-relaxed">
                  Are you sure you want to permanently delete <span className="font-semibold text-gray-900">"{deleteTarget.name}"</span>? 
                  This will disconnect the WhatsApp session and remove all associated data from the platform.
                </p>
                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => setDeleteTarget(null)}
                    className="flex-1 px-4 py-2.5 text-sm font-semibold border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={deleting}
                    className="flex-1 px-4 py-2.5 text-sm font-bold bg-red-500 text-white rounded-xl hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Instance Settings Modal ── */}
      <AnimatePresence>
        {settingsTarget && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60]"
              onClick={() => setSettingsTarget(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[61] w-full max-w-md px-4"
            >
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-5 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary/10 text-primary rounded-xl">
                      <Settings className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{settingsTarget.name}</h3>
                      <p className="text-sm text-gray-500">Instance Settings</p>
                    </div>
                  </div>
                  <button onClick={() => setSettingsTarget(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                    <X className="w-5 h-5 text-gray-500" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">Daily Message Limit</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min="10" max="200" step="5"
                        value={editDailyLimit}
                        onChange={(e) => setEditDailyLimit(Number(e.target.value))}
                        className="flex-1 accent-primary"
                      />
                      <span className="text-sm font-bold text-gray-900 min-w-[3rem] text-center bg-gray-100 px-2 py-1 rounded-lg">{editDailyLimit}</span>
                    </div>
                    <p className="text-xs text-gray-400">Higher limits increase ban risk. Recommended: 25-50 for new accounts, 100-200 for warmed-up accounts.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Status</label>
                    <div className="flex items-center gap-2">
                      <div className={`w-2.5 h-2.5 rounded-full ${settingsTarget.status === 'connected' ? 'bg-emerald-500' : 'bg-red-400'}`} />
                      <span className="text-sm text-gray-600 capitalize">{settingsTarget.status}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-sm font-semibold text-gray-700">Instance ID</label>
                    <p className="text-xs text-gray-400 font-mono bg-gray-50 p-2 rounded-lg break-all">{settingsTarget.id}</p>
                  </div>

                  {settingsTarget.phoneNumber && (
                    <div className="space-y-1">
                      <label className="text-sm font-semibold text-gray-700">Phone Number</label>
                      <p className="text-sm text-gray-600 font-mono bg-gray-50 p-2 rounded-lg">+{settingsTarget.phoneNumber}</p>
                    </div>
                  )}
                </div>

                <button
                  onClick={async () => {
                    try {
                      await authenticatedFetch(`/api/instances/${settingsTarget.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json", },
                        body: JSON.stringify({ action: "updateSettings", dailyLimit: editDailyLimit })
                      });
                      setInstances(prev => prev.map(i => i.id === settingsTarget.id ? { ...i, dailyLimit: editDailyLimit } : i));
                      setSettingsTarget(null);
                    } catch (err) {
                      console.error("Failed to update settings", err);
                    }
                  }}
                  className="w-full px-4 py-2.5 text-sm font-bold bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
                >
                  Save Settings
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
