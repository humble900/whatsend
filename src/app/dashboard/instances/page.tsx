"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Plus, Smartphone, ShieldCheck, Zap, MoreVertical, Wifi, WifiOff, 
  CheckCircle2, Loader2, X, Cloud, Phone, SlidersHorizontal, Activity, Settings, Trash2
} from "lucide-react";

// Mock data
const mockInstances = [
  { id: "1", name: "Enterprise Support Line", phone: "+44 7911 123456", status: "connected", transport: "whatsapp_web", limit: 250, sent: 142 },
  { id: "2", name: "Global Sales Team", phone: "+1 555 0198", status: "syncing", transport: "direct_meta", limit: 1000, sent: 512 },
];

const providerStats = {
  whatsapp_web: 1,
  direct_meta: 1,
  twilio: 0,
};

export default function InstancesPage() {
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null);
  const [connectionMethod, setConnectionMethod] = useState<"qr" | "pairing">("qr");
  const [generating, setGenerating] = useState(false);

  const [instanceLabel, setInstanceLabel] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [qrcodeBase64, setQrcodeBase64] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const res = await fetch("/api/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceName: instanceLabel,
          phoneNumber: connectionMethod === "pairing" ? phoneNumber : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create instance");

      if (data.qrcodeBase64) setQrcodeBase64(data.qrcodeBase64);
      if (data.pairingCode) setPairingCode(data.pairingCode);

    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  };

  const openConnect = (provider: string) => {
    setSelectedProvider(provider);
    setConnectionMethod("qr");
    setConnectModalOpen(true);
  };

  const closeConnect = () => {
    setConnectModalOpen(false);
    setTimeout(() => {
      setSelectedProvider(null);
      setGenerating(false);
      setInstanceLabel("");
      setPhoneNumber("");
      setQrcodeBase64(null);
      setPairingCode(null);
      setError(null);
    }, 300);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-5xl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2 flex items-center gap-2">
            <Zap className="w-6 h-6 sm:w-8 sm:h-8 text-primary" />
            Connections
          </h1>
          <p className="text-muted-foreground text-sm sm:text-lg">
            Connect and manage your WhatsApp devices and Cloud API endpoints.
          </p>
        </div>
      </div>

      {/* ── Section 1: Active Connections ── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Active Workspace Connections</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockInstances.map((instance, index) => (
            <motion.div
              key={instance.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className="glass-panel p-5 rounded-2xl relative overflow-hidden group text-left flex flex-col justify-between space-y-4 hover:shadow-lg transition-all border border-border/50"
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-sm font-bold flex items-center gap-2 mb-1">
                    {instance.name}
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full select-none ${
                      instance.status === "connected" ? "bg-emerald-500/10 text-emerald-500" : "bg-yellow-500/10 text-yellow-500"
                    }`}>
                      {instance.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 font-mono">
                    {instance.transport === "whatsapp_web" ? <Smartphone className="w-3.5 h-3.5 text-emerald-500" /> : <Cloud className="w-3.5 h-3.5 text-blue-500" />}
                    <span>{instance.phone}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button className="p-1.5 text-muted-foreground hover:bg-secondary/50 rounded-lg transition-colors" title="Settings">
                    <Settings className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 text-muted-foreground hover:bg-red-500/20 hover:text-red-500 rounded-lg transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="border-t border-border/50 pt-3 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-primary" />
                    <span className="font-semibold">Today's sends</span>
                    <span className="text-muted-foreground">{instance.sent} / {instance.limit}</span>
                  </div>
                </div>
                <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${(instance.sent / instance.limit) * 100}%` }}
                    transition={{ duration: 1 }}
                    className="h-full bg-primary"
                  />
                </div>
              </div>
            </motion.div>
          ))}
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
                  Link a standard WhatsApp Web account instantly using a QR code or Pairing code. Best for fast template-free message sending. High ban protection using proxy sharding.
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
                  Connect official Meta Business accounts directly via Graph API. Requires pre-approved template messages.
                </p>
              </div>
            </div>
            <div className="shrink-0 self-start sm:self-center">
              <button onClick={() => openConnect("direct_meta")} className="px-3 py-1.5 text-xs font-medium border border-border/50 rounded-lg hover:bg-secondary/50 transition-colors">
                Add New
              </button>
            </div>
          </div>

        </div>
      </div>

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
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-[#18181b] border border-border/50 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col"
            >
              {/* Header */}
              <div className="p-4 border-b border-border/50 flex items-center justify-between bg-white/5">
                <h3 className="font-semibold flex items-center gap-2">
                  {selectedProvider === "whatsapp_web" && <Smartphone className="w-5 h-5 text-emerald-500" />}
                  {selectedProvider === "direct_meta" && <Cloud className="w-5 h-5 text-blue-500" />}
                  Connect {selectedProvider === "whatsapp_web" ? "WhatsApp Web" : "Cloud API"}
                </h3>
                <button onClick={closeConnect} className="text-muted-foreground hover:text-white transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 space-y-4">
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
                        className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      />
                    </div>

                    {connectionMethod === "qr" ? (
                      <>
                        <p className="text-sm text-muted-foreground">
                          Generate a QR code to scan with your WhatsApp app. This provisions an isolated API worker for this number.
                        </p>
                        {qrcodeBase64 ? (
                          <div className="bg-white rounded-xl p-4 flex justify-center items-center aspect-square animate-in fade-in zoom-in duration-300">
                            {/* Live QR Code */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={qrcodeBase64} alt="WhatsApp QR Code" className="w-full h-full object-contain" />
                          </div>
                        ) : (
                          <button 
                            onClick={handleCreateInstance}
                            disabled={generating}
                            className="w-full bg-primary hover:bg-primary/90 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center transition-colors mt-2"
                          >
                            {generating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                            Generate QR Code
                          </button>
                        )}
                      </>
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
                              type="text" 
                              placeholder="+1 234 567 8900"
                              value={phoneNumber}
                              onChange={(e) => setPhoneNumber(e.target.value)}
                              className="w-full pl-9 bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground">Include country code (e.g., 44, 1)</p>
                        </div>
                        {pairingCode ? (
                          <div className="bg-secondary/30 border border-border/50 rounded-xl p-6 text-center space-y-3 animate-in fade-in zoom-in duration-300">
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
                        <input type="text" className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">WABA ID</label>
                        <input type="text" className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono" />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">System Access Token</label>
                        <input type="password" className="w-full bg-secondary/50 border border-border/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary font-mono" />
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
    </motion.div>
  );
}
