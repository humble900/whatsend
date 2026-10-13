"use client";

import { authenticatedFetch } from "@/lib/authenticated-fetch";



import { useState, useEffect } from "react";

import Link from "next/link";

import { motion, AnimatePresence } from "framer-motion";

import {

  CheckCircle2, AlertTriangle, Loader2, ExternalLink,

  Copy, Eye, EyeOff, Trash2, ShieldCheck, Bell,

  MessageSquare, Webhook, ChevronDown, ChevronUp,

  Link2, Check, Settings,

} from "lucide-react";



// â”€â”€â”€ Meta logo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MetaLogo = () => (

  <svg viewBox="0 0 40 40" className="w-7 h-7" fill="none" xmlns="http://www.w3.org/2000/svg">

    <rect width="40" height="40" rx="10" fill="#0866FF"/>

    <path d="M8 24.5C8 26.985 9.567 28.5 11.5 28.5C12.467 28.5 13.25 28.15 14.283 27.033L19.5 21.5L14.367 15.967C13.283 14.817 12.467 14.5 11.5 14.5C9.567 14.5 8 16.015 8 18.5V24.5Z" fill="white"/>

    <path d="M32 24.5C32 26.985 30.433 28.5 28.5 28.5C27.533 28.5 26.75 28.15 25.717 27.033L20.5 21.5L25.633 15.967C26.717 14.817 27.533 14.5 28.5 14.5C30.433 14.5 32 16.015 32 18.5V24.5Z" fill="white"/>

    <path d="M14.283 27.033C15.35 28.183 16.983 28.5 20 28.5C23.017 28.5 24.65 28.183 25.717 27.033L20 21L14.283 27.033Z" fill="white"/>

    <path d="M14.367 15.967L20 22L25.633 15.967C24.55 14.783 22.933 14.5 20 14.5C17.067 14.5 15.45 14.783 14.367 15.967Z" fill="white"/>

  </svg>

);



const WhatsAppIcon = () => (

  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" xmlns="http://www.w3.org/2000/svg">

    <rect width="24" height="24" rx="6" fill="#25D366"/>

    <path d="M12 4.8C8.024 4.8 4.8 8.024 4.8 12C4.8 13.367 5.173 14.646 5.814 15.748L4.859 19.141L8.329 18.201C9.396 18.792 10.659 19.14 12 19.14C15.976 19.14 19.2 15.916 19.2 11.94C19.2 7.964 15.976 4.8 12 4.8Z" fill="white"/>

    <path d="M15.445 13.892C15.272 14.289 14.61 14.646 14.226 14.697C13.842 14.748 13.358 14.768 12.824 14.584C12.509 14.48 12.104 14.342 11.59 14.122C9.654 13.259 8.407 11.317 8.314 11.19C8.22 11.064 7.559 10.199 7.559 9.302C7.559 8.405 8.034 7.963 8.22 7.765C8.407 7.567 8.627 7.518 8.754 7.518C8.881 7.518 9.008 7.52 9.118 7.525C9.236 7.531 9.399 7.481 9.557 7.861C9.74 8.251 10.132 9.148 10.182 9.247C10.232 9.346 10.265 9.462 10.199 9.589C10.134 9.715 10.1 9.792 10.002 9.907C9.904 10.021 9.796 10.162 9.707 10.252C9.608 10.35 9.508 10.457 9.62 10.655C9.734 10.848 10.128 11.473 10.7 11.987C11.438 12.65 12.059 12.86 12.252 12.958C12.445 13.057 12.556 13.041 12.67 12.91C12.783 12.778 13.158 12.336 13.284 12.143C13.41 11.951 13.538 11.984 13.71 12.047C13.882 12.107 14.776 12.55 14.962 12.649C15.148 12.748 15.273 12.797 15.322 12.877C15.372 12.955 15.372 13.351 15.445 13.892Z" fill="#25D366"/>

  </svg>

);



// â”€â”€â”€ Reusable section card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Section({ title, subtitle, icon, children }: {

  title: string; subtitle?: string;

  icon: React.ReactNode; children: React.ReactNode;

}) {

  return (

    <div className="glass-panel rounded-2xl overflow-hidden">

      <div className="flex items-center gap-3 px-6 py-5 border-b border-border/50">

        <div className="w-9 h-9 rounded-xl bg-secondary/60 border border-border/40 flex items-center justify-center shrink-0">

          {icon}

        </div>

        <div>

          <h2 className="font-semibold text-sm text-foreground">{title}</h2>

          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}

        </div>

      </div>

      <div className="p-6">{children}</div>

    </div>

  );

}



// â”€â”€â”€ Copy button â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CopyButton({ value }: { value: string }) {

  const [copied, setCopied] = useState(false);

  return (

    <button

      onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); }}

      className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors shrink-0"

    >

      {copied ? <Check className="w-3.5 h-3.5 text-primary" /> : <Copy className="w-3.5 h-3.5" />}

    </button>

  );

}



// â”€â”€â”€ Read-only masked field â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ReadonlyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {

  return (

    <div>

      <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5 block">{label}</label>

      <div className="flex items-center gap-2 px-3 py-2.5 bg-secondary/50 border border-border/50 rounded-xl">

        <span className={`flex-1 text-sm text-foreground truncate ${mono ? "font-mono" : "font-medium"}`}>{value}</span>

        <CopyButton value={value} />

      </div>

    </div>

  );

}



// â”€â”€â”€ Field wrapper â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {

  return (

    <div>

      <label className="block text-sm font-medium text-muted-foreground mb-1.5">{label}</label>

      {children}

      {help && <p className="text-xs text-muted-foreground/70 mt-1.5">{help}</p>}

    </div>

  );

}



const inputCls = "w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all text-foreground placeholder:text-muted-foreground/50";

const monoInputCls = inputCls + " font-mono";



// â”€â”€â”€ Page â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function SettingsPage() {

  const appUrl = typeof window !== "undefined" ? window.location.origin : "https://app.Whatsend.com";



  // Official API

  const [apiConnected, setApiConnected] = useState(false);

  const [apiInfo, setApiInfo] = useState<any>(null);

  const [showForm, setShowForm] = useState(false);

  const [form, setForm] = useState({ phoneNumberId: "", accessToken: "", wabaId: "", appId: "" });

  const [showToken, setShowToken] = useState(false);

  const [saving, setSaving] = useState(false);

  const [saveError, setSaveError] = useState("");

  const [saveSuccess, setSaveSuccess] = useState(false);

  const [disconnecting, setDisconnecting] = useState(false);

  const [showWebhook, setShowWebhook] = useState(false);



  useEffect(() => {

    authenticatedFetch("/api/settings/official-api", { headers: { } })

      .then(r => r.json())

      .then(d => { if (d.connected) { setApiConnected(true); setApiInfo(d); } })

      .catch(error => setSaveError(error.message || "Couldn’t load your connection settings."));

  }, []);



  const handleSaveApi = async () => {

    setSaving(true); setSaveError(""); setSaveSuccess(false);

    try {

      const res = await authenticatedFetch("/api/settings/official-api", {

        method: "POST",

        headers: { "Content-Type": "application/json", },

        body: JSON.stringify(form),

      });

      const data = await res.json();

      if (!res.ok) { setSaveError(data.error || "Failed to save."); return; }

      setApiConnected(true);

      setApiInfo({ ...data, phoneNumberId: form.phoneNumberId, wabaId: form.wabaId, maskedToken: "â€¢".repeat(12) + form.accessToken.slice(-4) });

      setSaveSuccess(true); setShowForm(false); setShowWebhook(true);

      setForm({ phoneNumberId: "", accessToken: "", wabaId: "", appId: "" });

    } catch (e: any) { setSaveError(e.message); }

    finally { setSaving(false); }

  };



  const handleDisconnect = async () => {

    setDisconnecting(true);

    try {

      await authenticatedFetch("/api/settings/official-api", { method: "DELETE" });

      setApiConnected(false); setApiInfo(null); setSaveSuccess(false); setShowForm(false);

    } catch (error) { setSaveError(error instanceof Error ? error.message : "Couldn’t disconnect your account."); }

    finally { setDisconnecting(false); }

  };



  return (

    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl">



      {/* Header */}

      <div>

        

        <p className="text-muted-foreground text-sm">Manage your WhatsApp connection.</p>

      </div>



      {/* â”€â”€ Official API â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}

      <Section title="WhatsApp Official API" subtitle="Store validated Meta credentials. Official messaging is not enabled in this deployment." icon={<MetaLogo />}>

        <AnimatePresence mode="wait">

          {apiConnected && apiInfo ? (

            <motion.div key="connected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Connected badge */}

              <div className="flex items-center gap-3 p-4 rounded-xl bg-primary/10 border border-primary/20">

                <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />

                <div className="flex-1">

                  <p className="font-semibold text-sm text-foreground">{apiInfo.verifiedName || "Credentials saved"}</p>

                  {apiInfo.displayPhoneNumber && <p className="text-xs text-muted-foreground mt-0.5">{apiInfo.displayPhoneNumber}</p>}

                </div>

                <button onClick={handleDisconnect} disabled={disconnecting}

                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/30 text-red-400 text-xs font-semibold hover:bg-red-500/10 transition-colors">

                  {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}

                  Disconnect

                </button>

              </div>



              <div className="grid grid-cols-2 gap-3">

                <ReadonlyField label="Phone Number ID" value={apiInfo.phoneNumberId || ""} />

                <ReadonlyField label="WABA ID" value={apiInfo.wabaId || ""} />

              </div>

              <ReadonlyField label="Access Token" value={apiInfo.maskedToken || "â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢"} />



              {/* Webhook accordion */}

              <button onClick={() => setShowWebhook(v => !v)}

                className="w-full flex items-center justify-between px-4 py-3 bg-secondary/50 border border-border/50 rounded-xl text-sm font-medium text-foreground hover:bg-secondary transition-colors">

                <span className="flex items-center gap-2"><Webhook className="w-4 h-4 text-muted-foreground" /> Integration status</span>

                {showWebhook ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}

              </button>



              <AnimatePresence>

                {showWebhook && (

                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}

                    className="overflow-hidden space-y-3">

                    <div className="p-4 bg-secondary/30 border border-border/40 rounded-xl text-xs text-muted-foreground space-y-1.5">

                      <p className="font-semibold text-foreground">Official Cloud API messaging is not active.</p>

                      <p className="mt-2">Your messages currently use Evolution. An official integration requires signed inbound webhooks and approved outbound templates before it can send.</p>


                    </div>


                  </motion.div>

                )}

              </AnimatePresence>



              {saveSuccess && (

                <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs text-primary font-medium">

                  <CheckCircle2 className="w-4 h-4" /> Credentials validated and saved. Evolution remains the active sender.

                </div>

              )}

            </motion.div>

          ) : (

            <motion.div key="disconnected" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Empty state */}

              <div className="flex items-start gap-4 p-4 bg-secondary/30 border border-border/50 rounded-xl">

                <WhatsAppIcon />

                <div className="flex-1">

                  <p className="font-semibold text-sm text-foreground">Connect your own Meta Business account</p>

                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">

                    Use your official WhatsApp Business API credentials. Requires a verified Meta Business account with an approved phone number.

                  </p>

                  <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" target="_blank" rel="noopener noreferrer"

                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2 font-medium">

                    How to get your API credentials <ExternalLink className="w-3 h-3" />

                  </a>

                </div>

              </div>



              {!showForm ? (

                <button onClick={() => setShowForm(true)}

                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-border/60 text-sm font-medium text-muted-foreground hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-all">

                  <Link2 className="w-4 h-4" /> Save Meta credentials

                </button>

              ) : (

                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">

                  {([

                    { key: "phoneNumberId", label: "Phone Number ID *", placeholder: "123456789012345", help: "Meta Business Manager â†’ WhatsApp â†’ Phone Numbers" },

                    { key: "wabaId",         label: "WhatsApp Business Account ID *", placeholder: "123456789012345", help: "Meta Business Manager â†’ Account Info" },

                    { key: "appId",          label: "App ID (optional)", placeholder: "123456789", help: "Your Meta App ID â€” for webhook signature verification" },

                  ] as const).map(({ key, label, placeholder, help }) => (

                    <Field key={key} label={label} help={help}>

                      <input type="text" placeholder={placeholder} value={form[key]}

                        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}

                        className={monoInputCls} />

                    </Field>

                  ))}



                  <Field label="Access Token *" help="Use a permanent System User token. Stored securely and shown masked after saving.">

                    <div className="relative">

                      <input type={showToken ? "text" : "password"} placeholder="EAABcâ€¦"

                        value={form.accessToken} onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}

                        className={monoInputCls + " pr-10"} />

                      <button type="button" onClick={() => setShowToken(v => !v)}

                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">

                        {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}

                      </button>

                    </div>

                  </Field>



                  {saveError && (

                    <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400">

                      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {saveError}

                    </div>

                  )}



                  <div className="flex gap-3 pt-1">

                    <button onClick={() => { setShowForm(false); setSaveError(""); }}

                      className="flex-1 px-4 py-2.5 rounded-xl border border-border/50 text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors">

                      Cancel

                    </button>

                    <button onClick={handleSaveApi}

                      disabled={saving || !form.phoneNumberId || !form.accessToken || !form.wabaId}

                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-40 transition-colors">

                      {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Validatingâ€¦</> : "Validate & Save"}

                    </button>

                  </div>

                </motion.div>

              )}

            </motion.div>

          )}

        </AnimatePresence>

      </Section>



      <Section title="Campaign settings" subtitle="Configure sending limits and timing for each campaign" icon={<Settings className="w-5 h-5 text-primary" />}>

        <p className="text-sm text-muted-foreground">Sending limits, message variations, and timing are managed inside each campaign. Open a campaign to edit its settings.</p>

        <Link href="/dashboard/campaigns" className="inline-flex mt-4 text-sm text-primary font-semibold">View campaigns</Link>

      </Section>

    </motion.div>

  );

}

