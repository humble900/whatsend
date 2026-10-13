"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState, useCallback, useRef } from "react";
import { useDropzone } from "react-dropzone";
import { motion, AnimatePresence } from "framer-motion";
import Papa from "papaparse";
import {
  Upload, Clipboard, List, Users, FileSpreadsheet,
  CheckCircle2, XCircle, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, X, Plus, Shield, Phone,
  Search, ArrowRight,
} from "lucide-react";

export interface ContactRow {
  phone: string;
  variables: Record<string, string>;
}

interface ValidationResult {
  total: number;
  valid: number;
  invalid: number;
  validPhones: string[];
  invalidPhones: string[];
}

interface WhatsAppAccount {
  id: string;
  name: string;
  phoneNumber: string | null;
  status: string;
}

interface ContactUploaderProps {
  onContactsReady: (contacts: ContactRow[], columns: string[]) => void;
  connectedAccounts?: WhatsAppAccount[];
}

type Source = "csv" | "paste" | "list" | "crm";

const SOURCE_TABS: { key: Source; label: string; icon: any; desc: string }[] = [
  { key: "csv",   label: "Upload CSV",     icon: FileSpreadsheet, desc: "Import from spreadsheet" },
  { key: "paste", label: "Paste Numbers",  icon: Clipboard,       desc: "Type or paste a list" },
  { key: "list",  label: "Saved List",     icon: List,            desc: "Pick an existing list" },
  { key: "crm",   label: "CRM Contacts",   icon: Users,           desc: "From your contact database" },
];

// ─── Tiny phone normaliser ─────────────────────────────────────────────────
function normalizePhone(raw: string, countryCode = ""): string | null {
  const digits = raw.replace(/[^0-9]/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (countryCode) {
    const cc = countryCode.replace(/[^0-9]/g, "");
    if (!digits.startsWith(cc)) return cc + digits;
  }
  return digits;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function WaValidationPanel({
  phones,
  accounts,
  onValidated,
}: {
  phones: string[];
  accounts: WhatsAppAccount[];
  onValidated: (valid: string[], invalid: string[]) => void;
}) {
  const [selectedAccount, setSelectedAccount] = useState(accounts[0]?.id || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ValidationResult | null>(null);
  const [error, setError] = useState("");

  const runValidation = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await authenticatedFetch("/api/contacts/validate-whatsapp", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ phones, instanceId: selectedAccount }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Validation failed");
      setResult(data);
      onValidated(data.validPhones, data.invalidPhones);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  if (phones.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="border border-primary/20 bg-primary/5 rounded-2xl p-4 space-y-4"
    >
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="text-sm font-semibold">WhatsApp Number Verification</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Sending to non-WhatsApp numbers can get your account banned. Verify {phones.length} numbers before sending.
          </p>
        </div>
      </div>

      {result ? (
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-emerald-500">{result.valid}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Valid</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <XCircle className="w-5 h-5 text-red-500 mx-auto mb-1" />
            <p className="text-lg font-bold text-red-500">{result.invalid}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Not on WA</p>
          </div>
          <div className="text-center p-3 rounded-xl bg-secondary/30 border border-border/50">
            <Phone className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
            <p className="text-lg font-bold">{result.total}</p>
            <p className="text-[10px] text-muted-foreground uppercase font-semibold">Total</p>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <select
            value={selectedAccount}
            onChange={e => setSelectedAccount(e.target.value)}
            className="flex-1 bg-background border border-border/50 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none"
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} {a.phoneNumber ? `(+${a.phoneNumber})` : "(not synced)"}
              </option>
            ))}
          </select>
          <button
            onClick={runValidation}
            disabled={loading || !selectedAccount}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Checking...
              </>
            ) : (
              <>
                <Shield className="w-4 h-4" />
                Verify {phones.length} Numbers
              </>
            )}
          </button>
        </div>
      )}

      {loading && (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin" />
          Checking in batches of 50 with safe delays... This may take {Math.ceil(phones.length / 50) * 4}s
        </div>
      )}

      {error && (
        <p className="text-xs text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-3 h-3" /> {error}
        </p>
      )}
    </motion.div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────

export default function ContactUploader({ onContactsReady, connectedAccounts = [] }: ContactUploaderProps) {
  const [source, setSource] = useState<Source>("csv");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [countryCode, setCountryCode] = useState("234"); // Nigeria default
  const [showValidation, setShowValidation] = useState(false);
  const [validatedPhones, setValidatedPhones] = useState<Set<string> | null>(null);

  // CSV states
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawCsvData, setRawCsvData] = useState<Record<string, string>[]>([]);
  const [phoneCol, setPhoneCol] = useState("");
  const [showMapper, setShowMapper] = useState(false);

  // Paste states
  const [pasteText, setPasteText] = useState("");

  // CRM states
  const [crmContacts, setCrmContacts] = useState<any[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSearch, setCrmSearch] = useState("");
  const [selectedCrm, setSelectedCrm] = useState<Set<string>>(new Set());

  // ── CSV Upload ──────────────────────────────────────────────────────────
  const onDrop = useCallback((files: File[]) => {
    const file = files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields || [];
        const data = result.data as Record<string, string>[];
        setCsvHeaders(headers);
        setRawCsvData(data);
        // Auto-detect phone column
        const autoPhone = headers.find(h =>
          /phone|mobile|tel|number|whatsapp/i.test(h)
        ) || headers[0];
        setPhoneCol(autoPhone);
        setShowMapper(true);
      },
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/csv": [".csv"], "application/vnd.ms-excel": [".csv"] },
    maxFiles: 1,
  });

  const applyCsvMapping = () => {
    if (!phoneCol) return;
    const mapped: ContactRow[] = rawCsvData
      .map(row => {
        const rawPhone = row[phoneCol] || "";
        const phone = normalizePhone(rawPhone, countryCode);
        if (!phone) return null;
        const vars: Record<string, string> = {};
        csvHeaders.filter(h => h !== phoneCol).forEach(h => { vars[h] = row[h] || ""; });
        return { phone, variables: vars };
      })
      .filter(Boolean) as ContactRow[];

    const cols = csvHeaders.filter(h => h !== phoneCol);
    setContacts(mapped);
    setColumns(cols);
    setShowMapper(false);
    onContactsReady(mapped, cols);
  };

  // ── Paste Import ────────────────────────────────────────────────────────
  const applyPaste = () => {
    const lines = pasteText.split(/[\n,;]+/).map(l => l.trim()).filter(Boolean);
    const mapped: ContactRow[] = lines
      .map(raw => {
        const phone = normalizePhone(raw, countryCode);
        return phone ? { phone, variables: {} } : null;
      })
      .filter(Boolean) as ContactRow[];
    setContacts(mapped);
    setColumns([]);
    onContactsReady(mapped, []);
  };

  // ── CRM ─────────────────────────────────────────────────────────────────
  const loadCrm = async () => {
    setCrmLoading(true);
    try {
      const res = await authenticatedFetch("/api/contacts", { headers: { } });
      const data = await res.json();
      setCrmContacts(data.contacts || []);
    } catch { } finally { setCrmLoading(false); }
  };

  const applyCrm = () => {
    const chosen = crmContacts.filter(c => selectedCrm.has(c.id));
    const mapped: ContactRow[] = chosen
      .map(c => {
        const phone = normalizePhone(c.remoteJid || c.phone || "", countryCode);
        return phone ? {
          phone,
          variables: { name: c.pushName || "", ...(c.metadata || {}) },
        } : null;
      })
      .filter(Boolean) as ContactRow[];
    setContacts(mapped);
    setColumns(["name"]);
    onContactsReady(mapped, ["name"]);
  };

  // ── Validation callback ─────────────────────────────────────────────────
  const handleValidated = (valid: string[], invalid: string[]) => {
    const validSet = new Set(valid);
    setValidatedPhones(validSet);
    // Filter contacts down to only valid WA numbers
    const filtered = contacts.filter(c => validSet.has(c.phone));
    setContacts(filtered);
    onContactsReady(filtered, columns);
  };

  const stats = {
    total: contacts.length,
    valid: validatedPhones ? contacts.filter(c => validatedPhones.has(c.phone)).length : null,
  };

  return (
    <div className="space-y-4">
      {/* Source Tabs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SOURCE_TABS.map(({ key, label, icon: Icon, desc }) => (
          <button
            key={key}
            type="button"
            onClick={() => { setSource(key); if (key === "crm" && crmContacts.length === 0) loadCrm(); }}
            className={`p-3 rounded-xl border text-left transition-all ${
              source === key
                ? "border-primary bg-primary/5 shadow-sm"
                : "border-border/50 hover:bg-secondary/30"
            }`}
          >
            <Icon className={`w-4 h-4 mb-1.5 ${source === key ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-xs font-semibold truncate">{label}</p>
            <p className="text-[10px] text-muted-foreground truncate">{desc}</p>
          </button>
        ))}
      </div>

      {/* Country Code */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-muted-foreground shrink-0">Default country code</label>
        <div className="flex items-center border border-border/50 rounded-xl bg-background/50 overflow-hidden">
          <span className="px-3 py-2 text-sm text-muted-foreground border-r border-border/50">+</span>
          <input
            type="text"
            value={countryCode}
            onChange={e => setCountryCode(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="e.g. 234"
            className="w-20 px-3 py-2 text-sm bg-transparent focus:outline-none"
          />
        </div>
        <p className="text-[11px] text-muted-foreground">Prepended if number has no code</p>
      </div>

      {/* Source Content */}
      <AnimatePresence mode="wait">
        {/* ── CSV ── */}
        {source === "csv" && !showMapper && (
          <motion.div key="csv-drop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div
              {...getRootProps()}
              className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                isDragActive
                  ? "border-primary bg-primary/5 scale-[1.01]"
                  : "border-border/50 hover:border-primary/40 hover:bg-secondary/20"
              }`}
            >
              <input {...getInputProps()} />
              <Upload className={`w-10 h-10 mx-auto mb-3 ${isDragActive ? "text-primary" : "text-muted-foreground"}`} />
              <p className="font-semibold text-sm mb-1">{isDragActive ? "Drop it!" : "Drag & Drop CSV"}</p>
              <p className="text-xs text-muted-foreground">or click to browse · Supports .csv files</p>
              <p className="text-[11px] text-muted-foreground/60 mt-2">First row must be headers · Phone column auto-detected</p>
            </div>
          </motion.div>
        )}

        {/* ── CSV Mapper ── */}
        {source === "csv" && showMapper && (
          <motion.div key="csv-mapper" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="border border-border/50 rounded-2xl overflow-hidden bg-background/50">
              <div className="p-4 bg-secondary/20 border-b border-border/50 flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-sm">Map Phone Column</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{rawCsvData.length} rows detected</p>
                </div>
                <button onClick={() => setShowMapper(false)} className="text-xs text-red-500 hover:underline">Cancel</button>
              </div>
              <div className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Phone Number Column *</label>
                  <select
                    value={phoneCol}
                    onChange={e => setPhoneCol(e.target.value)}
                    className="w-full bg-background border border-border/50 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary outline-none"
                  >
                    <option value="">Select column...</option>
                    {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                {/* Preview */}
                {phoneCol && (
                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    <div className="text-xs text-muted-foreground px-3 py-2 bg-secondary/20 border-b border-border/50 font-semibold uppercase tracking-wider">
                      Preview (first 3 rows)
                    </div>
                    <div className="divide-y divide-border/30">
                      {rawCsvData.slice(0, 3).map((row, i) => (
                        <div key={i} className="px-3 py-2 text-xs flex items-center gap-2">
                          <Phone className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="font-mono">{row[phoneCol]}</span>
                          <span className="text-muted-foreground">→</span>
                          <span className="font-mono text-primary">
                            {normalizePhone(row[phoneCol] || "", countryCode) || "❌ invalid"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={applyCsvMapping}
                  disabled={!phoneCol}
                  className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  Import {rawCsvData.length} Contacts
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Paste ── */}
        {source === "paste" && (
          <motion.div key="paste" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            <textarea
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"Paste phone numbers, one per line (or comma-separated):\n+2348012345678\n+447911123456\n+12025550101"}
              rows={8}
              className="w-full bg-background/50 border border-border/50 rounded-2xl p-4 text-sm font-mono focus:ring-2 focus:ring-primary outline-none resize-none placeholder:text-muted-foreground/50"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{pasteText.split(/[\n,;]+/).filter(l => l.trim()).length} lines detected</span>
            </div>
            <button
              onClick={applyPaste}
              disabled={!pasteText.trim()}
              className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
            >
              Import Numbers
            </button>
          </motion.div>
        )}

        {/* ── Saved List (placeholder) ── */}
        {source === "list" && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="border border-border/50 rounded-2xl p-8 text-center text-muted-foreground space-y-3">
              <List className="w-10 h-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">Saved Lists Coming Soon</p>
              <p className="text-xs opacity-60">Save and reuse contact lists across campaigns.</p>
            </div>
          </motion.div>
        )}

        {/* ── CRM ── */}
        {source === "crm" && (
          <motion.div key="crm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3">
            {crmLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : crmContacts.length === 0 ? (
              <div className="border border-border/50 rounded-2xl p-8 text-center text-muted-foreground space-y-2">
                <Users className="w-10 h-10 mx-auto opacity-30" />
                <p className="text-sm">No CRM contacts yet</p>
                <p className="text-xs opacity-60">Contacts sync from WhatsApp conversations automatically.</p>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={crmSearch}
                    onChange={e => setCrmSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 text-sm bg-background border border-border/50 rounded-xl focus:ring-2 focus:ring-primary outline-none"
                  />
                </div>
                <div className="border border-border/50 rounded-2xl overflow-hidden">
                  <div className="p-3 bg-secondary/20 border-b border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{selectedCrm.size} selected</span>
                    <button
                      type="button"
                      onClick={() => setSelectedCrm(new Set(crmContacts.map(c => c.id)))}
                      className="text-primary hover:underline"
                    >Select all</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y divide-border/30">
                    {crmContacts
                      .filter(c => (c.pushName || c.remoteJid || "").toLowerCase().includes(crmSearch.toLowerCase()))
                      .map(c => (
                        <label key={c.id} className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${selectedCrm.has(c.id) ? "bg-primary/5" : "hover:bg-secondary/30"}`}>
                          <input
                            type="checkbox"
                            checked={selectedCrm.has(c.id)}
                            onChange={e => {
                              const next = new Set(selectedCrm);
                              e.target.checked ? next.add(c.id) : next.delete(c.id);
                              setSelectedCrm(next);
                            }}
                            className="rounded accent-primary w-4 h-4 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{c.pushName || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground font-mono truncate">{c.remoteJid}</p>
                          </div>
                        </label>
                      ))}
                  </div>
                </div>
                <button
                  onClick={applyCrm}
                  disabled={selectedCrm.size === 0}
                  className="w-full py-3 rounded-xl bg-primary text-white font-semibold text-sm hover:bg-primary/90 disabled:opacity-40 transition-colors"
                >
                  Import {selectedCrm.size} Contacts
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Result Summary ── */}
      {contacts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {contacts.length.toLocaleString()} contacts ready
              </p>
              <p className="text-xs text-muted-foreground">
                {columns.length > 0 ? `Variables: ${columns.slice(0, 4).join(", ")}${columns.length > 4 ? "..." : ""}` : "Phone numbers only"}
                {validatedPhones && ` · ${validatedPhones.size} verified on WhatsApp`}
              </p>
            </div>
            <button
              onClick={() => { setContacts([]); setRawCsvData([]); setCsvHeaders([]); setShowMapper(false); setValidatedPhones(null); }}
              className="p-1 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-500 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* WA Validation Panel */}
          {connectedAccounts.length > 0 && !validatedPhones && (
            <WaValidationPanel
              phones={contacts.map(c => c.phone)}
              accounts={connectedAccounts}
              onValidated={handleValidated}
            />
          )}

          {validatedPhones && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-sm text-blue-500">
              <Shield className="w-4 h-4 shrink-0" />
              Validated — {validatedPhones.size} confirmed on WhatsApp · Non-WA numbers removed
            </div>
          )}

          {connectedAccounts.length === 0 && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-500">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>No connected accounts</strong> — WhatsApp validation unavailable. Connect an account in Instances to verify numbers before sending and reduce ban risk.
              </span>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
