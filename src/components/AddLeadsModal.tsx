"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, ArrowLeft, ChevronRight, Upload, Loader2, AlertTriangle,
  CheckCircle2, FileSpreadsheet, Clipboard, List, Users, Link,
  Download, Search, Check, Phone,
} from "lucide-react";
import Papa from "papaparse";
import {normalizeImportPhone as smartNormalize} from "@/lib/phone-normalization";
import {contactVariables} from '@/lib/campaign-personalization';

// ─── Official Google G SVG logo ───────────────────────────────────────────────
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" xmlns="http://www.w3.org/2000/svg">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
);

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ImportedContact {
  phone: string;
  name?: string;
  variables?: Record<string, string>;
  source?: string;
}

export interface AddLeadsModalProps {
  onClose: () => void;
  onAdd: (contacts: ImportedContact[], listName?: string) => void | Promise<void>;
  mode?: "leads" | "contacts";
  title?: string;
}

interface SavedList {
  name: string;
  count: number;
  importedAt: string | null;
  samples: string[];
}

interface CrmContact {
  id: string;
  remoteJid: string;
  pushName: string | null;
  metadata?: Record<string, any>;
}

function extractSheetId(url: string): string | null {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return m ? m[1] : null;
}
function extractGid(url: string): string {
  const m = url.match(/[#&?]gid=([0-9]+)/);
  return m ? m[1] : "0";
}

// ─── Source definitions ───────────────────────────────────────────────────────

const SOURCES = [
  { key: "csv",    iconEl: <FileSpreadsheet className="w-5 h-5 text-green-600" />,  iconBg: "bg-green-50 border-green-100",   title: "Upload CSV",             desc: "Import from a local spreadsheet file" },
  { key: "sheets", iconEl: <GoogleIcon />,                                           iconBg: "bg-white border-gray-200",       title: "Google Sheets",          desc: "Fetch and import from a public Google Sheet" },
  { key: "paste",  iconEl: <Clipboard className="w-5 h-5 text-amber-600" />,        iconBg: "bg-amber-50 border-amber-100",   title: "Enter Manually",         desc: "Type or paste phone numbers and names" },
  { key: "list",   iconEl: <List className="w-5 h-5 text-green-600" />,              iconBg: "bg-green-50 border-green-100",     title: "Use Existing List",      desc: "Pick from lists you've already uploaded" },
  { key: "crm",    iconEl: <Users className="w-5 h-5 text-green-700" />,           iconBg: "bg-purple-50 border-purple-100", title: "CRM Contacts",           desc: "Search and select from your contacts database" },
];

// ─── Country Code Control ─────────────────────────────────────────────────────

interface CcControlProps {
  countryCode: string;
  setCountryCode: (v: string) => void;
  useCc: boolean;
  setUseCc: (v: boolean) => void;
}

function CcControl({ countryCode, setCountryCode, useCc, setUseCc }: CcControlProps) {
  return (
    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
      {/* Toggle */}
      <button
        type="button"
        onClick={() => setUseCc(!useCc)}
        role="switch"
        aria-checked={useCc}
        aria-label="Use default country code"
        className={`relative w-10 h-5 rounded-full transition-colors shrink-0 ${useCc ? "bg-green-500" : "bg-gray-300"}`}
        title={useCc ? "Use default country code" : "Use numbers as-is (they already have country code)"}
      >
        <span className={`absolute left-0 top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${useCc ? "translate-x-5" : "translate-x-0.5"}`} />
      </button>

      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-gray-700">
          Use default country code
        </p>
        <p className="text-[10px] text-gray-400 mt-0.5">
          {useCc
            ? "Convert local numbers using this code. Numbers starting with + or 00 keep their own country code."
            : "Use international numbers with their country code. Turn on for local numbers."}
        </p>
      </div>

      {/* CC input — only relevant when toggle is ON */}
      {useCc && (
        <div className="flex items-center border border-gray-200 rounded-lg bg-white overflow-hidden shrink-0">
          <span className="px-2 py-1.5 text-xs text-gray-400 border-r border-gray-200 font-medium">+</span>
          <input
            type="text"
            value={countryCode}
            aria-label="Default country calling code"
            inputMode="numeric"
            onChange={e => setCountryCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
            className="w-14 px-2 py-1.5 text-xs bg-transparent focus:outline-none text-gray-800 font-semibold"
            placeholder="1"
          />
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function AddLeadsModal({ onClose, onAdd, mode = "leads", title }: AddLeadsModalProps) {
  const [source, setSource] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState("");
  const [useCc, setUseCc] = useState(false);
  const [listName, setListName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // CSV state
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawCsv, setRawCsv] = useState<Record<string, string>[]>([]);
  const [phoneCol, setPhoneCol] = useState("");
  const [nameCol, setNameCol] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Google Sheets state
  const [sheetUrl, setSheetUrl] = useState("");
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState("");
  const [sheetData, setSheetData] = useState<Record<string, string>[]>([]);
  const [sheetHeaders, setSheetHeaders] = useState<string[]>([]);
  const [sheetPhoneCol, setSheetPhoneCol] = useState("");
  const [sheetNameCol, setSheetNameCol] = useState("");

  // Paste state
  const [pasteText, setPasteText] = useState("");

  // Saved lists state
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [listsLoading, setListsLoading] = useState(false);
  const [selectedList, setSelectedList] = useState<SavedList | null>(null);
  const [listContacts, setListContacts] = useState<ImportedContact[]>([]);
  const [listContactsLoading, setListContactsLoading] = useState(false);

  // CRM state
  const [crmContacts, setCrmContacts] = useState<CrmContact[]>([]);
  const [crmLoading, setCrmLoading] = useState(false);
  const [crmSearch, setCrmSearch] = useState("");
  const [crmSelected, setCrmSelected] = useState<Set<string>>(new Set());

  // ── Load saved lists when user picks that source ────────────────────────
  useEffect(() => {
    if (source !== "list") return;
    setListsLoading(true);
    authenticatedFetch("/api/contacts/lists", { headers: { } })
      .then(r => r.json())
      .then(d => setSavedLists(d.lists || []))
      .catch(console.error)
      .finally(() => setListsLoading(false));
  }, [source]);

  // ── Load contacts for a chosen saved list ───────────────────────────────
  const loadListContacts = async (list: SavedList) => {
    setSelectedList(list);
    setListContactsLoading(true);
    try {
      const res = await authenticatedFetch("/api/contacts?"+new URLSearchParams({list:list.name}), { headers: { } });
      const data = await res.json();
      const filtered: ImportedContact[] = (data.contacts || [])
        .filter((c: any) => c.metadata?._listName === list.name)
        .map((c: any) => ({
          phone: c.remoteJid.replace("@s.whatsapp.net", ""),
          name: c.pushName || undefined,
          variables: contactVariables(c.metadata),
          source: `List: ${list.name}`,
        }));
      setListContacts(filtered);
    } catch (e) { console.error(e); }
    finally { setListContactsLoading(false); }
  };

  // ── Load CRM contacts ───────────────────────────────────────────────────
  useEffect(() => {
    if (source !== "crm") return;
    setCrmLoading(true);
    authenticatedFetch("/api/contacts", { headers: { } })
      .then(r => r.json())
      .then(d => setCrmContacts(d.contacts || []))
      .catch(console.error)
      .finally(() => setCrmLoading(false));
  }, [source]);

  // ── CSV file handler ────────────────────────────────────────────────────
  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (r) => {
        const headers = r.meta.fields || [];
        setCsvHeaders(headers);
        setRawCsv(r.data as Record<string, string>[]);
        const autoPhone = headers.find(h => /phone|mobile|tel|number/i.test(h)) || headers[0] || "";
        const autoName = headers.find(h => /^name$|full.?name|first.?name/i.test(h)) || "";
        setPhoneCol(autoPhone); setNameCol(autoName);
        if (!listName && file.name) setListName(file.name.replace(/\.csv$/i, ""));


      },
    });
  };

  // ── Drag & drop ─────────────────────────────────────────────────────────
  const onDropZone = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      const syntheticEvt = { target: { files: [file] } } as any;
      handleFile(syntheticEvt);
    }
  };

  // ── Google Sheets fetcher ───────────────────────────────────────────────
  const fetchSheet = async () => {
    setSheetError(""); setSheetData([]); setSheetHeaders([]);
    const sheetId = extractSheetId(sheetUrl);
    if (!sheetId) { setSheetError("Invalid URL. Paste the full sheet URL from the browser address bar."); return; }
    const gid = extractGid(sheetUrl);
    setSheetLoading(true);
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error("Could not access the sheet. Make sure sharing is set to Anyone with the link (Viewer).");
      const text = await res.text();
      Papa.parse(text, {
        header: true, skipEmptyLines: true,
        complete: (r) => {
          const headers = r.meta.fields || [];
          const data = r.data as Record<string, string>[];
          if (!data.length) { setSheetError("The sheet appears to be empty."); return; }
          setSheetHeaders(headers); setSheetData(data);
          const autoPhone = headers.find(h => /phone|mobile|tel|number/i.test(h)) || headers[0] || "";
          const autoName = headers.find(h => /^name$|full.?name|first.?name/i.test(h)) || "";
          setSheetPhoneCol(autoPhone); setSheetNameCol(autoName);
          if (!listName) setListName(`Google Sheet — ${new Date().toLocaleDateString()}`);
          // Auto-detect CC
          const sample = data.slice(0, 5).map(row => row[autoPhone] || "");
          const avgLen = sample.map(s => s.replace(/\D/g, "").length).reduce((a, b) => a + b, 0) / (sample.length || 1);
          setUseCc(avgLen <= 10);
        },
      });
    } catch (e: any) { setSheetError(e.message); }
    finally { setSheetLoading(false); }
  };

  // ── Build the final contact list ────────────────────────────────────────
  const buildContacts = useCallback((): ImportedContact[] => {
    const cc = countryCode.replace(/\D/g, "");

    if (source === "csv") {
      return rawCsv.flatMap(row => {
        const phone = smartNormalize(row[phoneCol] || "", cc, useCc);
        if (!phone) return [];
        const vars: Record<string, string> = {};
        Object.keys(row).forEach(k => { if (k !== phoneCol) vars[k.trim()] = row[k] || ''; });
        return [{ phone, name: nameCol ? (row[nameCol] || undefined) : undefined, variables: vars, source: "CSV Upload" }];
      });
    }

    if (source === "sheets") {
      return sheetData.flatMap(row => {
        const phone = smartNormalize(row[sheetPhoneCol] || "", cc, useCc);
        if (!phone) return [];
        const vars: Record<string, string> = {};
        Object.keys(row).forEach(k => { if (k !== sheetPhoneCol) vars[k.trim()] = row[k] || ''; });
        return [{ phone, name: sheetNameCol ? (row[sheetNameCol] || undefined) : undefined, variables: vars, source: "Google Sheets" }];
      });
    }

    if (source === "paste") {
      return pasteText.split(/[\n]+/).flatMap(line => {
        const trimmed = line.trim();
        if (!trimmed) return [];
        // Try to find the phone number part (digits and +/-/spaces)
        const phoneMatch = trimmed.match(/[+]?[\d\s\-().]{7,}/);
        if (!phoneMatch) return [];
        const phone = smartNormalize(phoneMatch[0], cc, useCc);
        if (!phone) return [];
        // Anything that's not the phone is the name
        const name = trimmed.replace(phoneMatch[0], "").replace(/^[,;\s]+|[,;\s]+$/g, "").trim() || undefined;
        return [{ phone, name, source: "Manual Entry" }];
      });
    }

    if (source === "list" && listContacts.length > 0) {
      return listContacts;
    }

    if (source === "crm") {
      return Array.from(crmSelected).flatMap(id => {
        const c = crmContacts.find(x => x.id === id);
        if (!c) return [];
        const phone = c.remoteJid.replace("@s.whatsapp.net", "");
        return [{ phone, name: c.pushName || undefined, variables: contactVariables(c.metadata), source: "CRM" }];
      });
    }

    return [];
  }, [source, rawCsv, sheetData, pasteText, phoneCol, nameCol, sheetPhoneCol, sheetNameCol, countryCode, useCc, listContacts, crmContacts, crmSelected]);

  // ── Submit ──────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    const built = [...new Map(buildContacts().map(contact => [contact.phone, contact])).values()];
    if (submitting) return;
    if(!built.length){setSubmitError(useCc&&!countryCode?"Enter a country calling code or turn off the default country code.":"No complete phone numbers found. Review the number preview.");return;}
    setSubmitting(true); setSubmitError("");
    try {
      if (mode === "contacts") {
        await authenticatedFetch("/api/contacts/import", {
          method: "POST",
          headers: { "Content-Type": "application/json", },
          body: JSON.stringify({
            contacts: built.map(c => ({ phone: c.phone, pushName: c.name || "", variables: c.variables || {} })),
            listName: listName || "Imported List",
          }),
        });
      }
      await onAdd(built, listName || undefined);
      onClose();
    } catch (error) { setSubmitError(error instanceof Error ? error.message : "Contacts could not be saved."); }
    finally { setSubmitting(false); }
  };

  // ── Derived state ────────────────────────────────────────────────────────
  const normalizedContacts = buildContacts();
  const contacts = [...new Map(normalizedContacts.map(contact => [contact.phone, contact])).values()];
  const inputCount = source === 'csv' ? rawCsv.length : source === 'sheets' ? sheetData.length : source === 'paste' ? pasteText.split(/\n+/).filter(line => line.trim()).length : normalizedContacts.length;
  const rejectedCount = Math.max(0, inputCount - normalizedContacts.length);
  const duplicateCount = normalizedContacts.length - contacts.length;
  const validCount = contacts.length;
  const cc = countryCode.replace(/\D/g, "");

  const canSubmit = (() => {
    if (source === "csv") return rawCsv.length > 0 && !!phoneCol;
    if (source === "sheets") return sheetData.length > 0 && !!sheetPhoneCol;
    if (source === "paste") return pasteText.trim().length > 5;
    if (source === "list") return listContacts.length > 0;
    if (source === "crm") return crmSelected.size > 0;
    return false;
  })();

  // CRM filtered
  const filteredCrm = crmContacts.filter(c => {
    if (!crmSearch) return true;
    const q = crmSearch.toLowerCase();
    return c.remoteJid.includes(q) || (c.pushName || "").toLowerCase().includes(q);
  });

  // Sample CSV download
  const downloadSample = () => {
    const a = document.createElement("a");
    a.href = "/samples/contacts_sample.csv";
    a.download = "contacts_sample.csv";
    a.click();
  };

  // Reset on back
  const handleBack = () => {
    setSource(null); setRawCsv([]); setCsvHeaders([]); setPasteText("");
    setSheetData([]); setSheetHeaders([]); setSheetUrl(""); setSheetError("");
    setSelectedList(null); setListContacts([]); setCrmSearch(""); setCrmSelected(new Set());
  };

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 16 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="bg-white rounded-2xl w-full max-w-md shadow-2xl shadow-gray-200/80 border border-gray-100 overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900 text-base">
            {title || (mode === "contacts" ? "Import Contacts" : "Add Leads to Campaign")}
          </h2>
          <button aria-label="Close import dialog" onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {!source ? (
            // ── SOURCE PICKER ────────────────────────────────────────────
            <div className="space-y-2">
              {SOURCES.map(({ key, iconEl, iconBg, title: t, desc }) => (
                <button key={key} type="button" onClick={() => setSource(key)}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50/30 transition-all text-left group">
                  <div className={`w-11 h-11 rounded-xl border ${iconBg} flex items-center justify-center shrink-0`}>{iconEl}</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-gray-900">{t}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{desc}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors shrink-0" />
                </button>
              ))}
            </div>
          ) : (
            // ── SOURCE FORM ──────────────────────────────────────────────
            <div className="space-y-4">
              <button type="button" onClick={handleBack}
                className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 font-medium transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to options
              </button>

              {/* ══════ CSV ══════════════════════════════════════════════ */}
              {source === "csv" && (
                <div className="space-y-3">
                  {/* Drop zone */}
                  <div
                    onDragOver={e => e.preventDefault()}
                    onDrop={onDropZone}
                    onClick={() => fileRef.current?.click()}
                    className="border-2 border-dashed border-gray-200 rounded-xl p-7 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/40 transition-all"
                  >
                    <Upload className="w-7 h-7 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-700">Click or drag & drop CSV here</p>
                    <p className="text-xs text-gray-400 mt-1">First row must be headers</p>
                    <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleFile} />
                  </div>

                  {/* Sample download */}
                  <button type="button" onClick={downloadSample}
                    className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium">
                    <Download className="w-3.5 h-3.5" /> Download sample CSV template
                  </button>

                  {/* Column mapper */}
                  {csvHeaders.length > 0 && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-gray-600 font-semibold uppercase tracking-wide mb-1 block">Phone column *</label>
                          <select value={phoneCol} onChange={e => setPhoneCol(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-800">
                            <option value="">— Select —</option>
                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-600 font-semibold uppercase tracking-wide mb-1 block">Name column</label>
                          <select value={nameCol} onChange={e => setNameCol(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-800">
                            <option value="">None</option>
                            {csvHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>
                      {phoneCol && (
                        <p className="text-xs text-gray-500">
                          {rawCsv.length} rows ·{" "}
                          <span className="text-green-600 font-semibold">
                            {rawCsv.filter(r => smartNormalize(r[phoneCol] || "", cc, useCc)).length} valid phones
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {/* CC control */}
                  <CcControl countryCode={countryCode} setCountryCode={setCountryCode} useCc={useCc} setUseCc={setUseCc} />

                  {/* List name (contacts mode) */}
                  {mode === "contacts" && (
                    <div>
                      <label className="text-xs text-gray-600 font-medium mb-1 block">List name</label>
                      <input type="text" value={listName} onChange={e => setListName(e.target.value)}
                        placeholder="e.g. Q3 Enterprise Leads"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-800" />
                    </div>
                  )}
                </div>
              )}

              {/* ══════ GOOGLE SHEETS ════════════════════════════════════ */}
              {source === "sheets" && (
                <div className="space-y-3">
                  <div className="flex gap-3 p-3 bg-green-50 border border-green-100 rounded-xl text-xs text-green-700">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-green-500" />
                    <p>Share your sheet: <strong>Share → Change → Anyone with the link → Viewer</strong></p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs text-gray-600 font-medium block">Google Sheets URL</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Link className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                        <input type="url" value={sheetUrl} onChange={e => { setSheetUrl(e.target.value); setSheetError(""); }}
                          onKeyDown={e => e.key === "Enter" && sheetUrl.trim().length > 10 && fetchSheet()}
                          placeholder="https://docs.google.com/spreadsheets/d/..."
                          className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-gray-800" />
                      </div>
                      <button type="button" onClick={fetchSheet} disabled={sheetUrl.trim().length < 10 || sheetLoading}
                        className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-green-600 text-white text-xs font-semibold hover:bg-green-700 disabled:opacity-40 transition-colors whitespace-nowrap">
                        {sheetLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Fetch"}
                      </button>
                    </div>
                    {sheetError && <p className="text-xs text-red-500 flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0" />{sheetError}</p>}
                  </div>

                  {sheetHeaders.length > 0 && (
                    <div className="p-4 bg-green-50 border border-green-100 rounded-xl space-y-3">
                      <p className="text-xs font-semibold text-green-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" /> {sheetData.length} rows loaded
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[11px] text-gray-600 font-semibold uppercase tracking-wide mb-1 block">Phone column *</label>
                          <select value={sheetPhoneCol} onChange={e => setSheetPhoneCol(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-800">
                            <option value="">— Select —</option>
                            {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-gray-600 font-semibold uppercase tracking-wide mb-1 block">Name column</label>
                          <select value={sheetNameCol} onChange={e => setSheetNameCol(e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-800">
                            <option value="">None</option>
                            {sheetHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                          </select>
                        </div>
                      </div>
                    </div>
                  )}

                  <CcControl countryCode={countryCode} setCountryCode={setCountryCode} useCc={useCc} setUseCc={setUseCc} />

                  {mode === "contacts" && (
                    <div>
                      <label className="text-xs text-gray-600 font-medium mb-1 block">List name</label>
                      <input type="text" value={listName} onChange={e => setListName(e.target.value)}
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-800" />
                    </div>
                  )}
                </div>
              )}

              {/* ══════ PASTE ════════════════════════════════════════════ */}
              {source === "paste" && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-gray-600 font-medium block mb-1">Phone numbers</label>
                    <p className="text-[11px] text-gray-400 mb-2">One per line. Name is optional — put it before or after the number.</p>
                    <textarea aria-label="Phone numbers" value={pasteText} onChange={e => setPasteText(e.target.value)}
                      placeholder={"John Doe +2348012345678\n+447911123456 Sarah\n08012345678"}
                      rows={7}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm font-mono focus:ring-2 focus:ring-green-500 outline-none resize-none text-gray-800 placeholder:text-gray-300" />
                    {validCount > 0 && <p className="text-xs text-green-600 font-semibold mt-1">{validCount} valid number{validCount !== 1 ? "s" : ""} detected</p>}
                  </div>
                  <CcControl countryCode={countryCode} setCountryCode={setCountryCode} useCc={useCc} setUseCc={setUseCc} />

                  {mode === "contacts" && (
                    <div>
                      <label className="text-xs text-gray-600 font-medium mb-1 block">List name</label>
                      <input type="text" value={listName} onChange={e => setListName(e.target.value)} placeholder="e.g. Manual Entry — Q4"
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-800" />
                    </div>
                  )}

                  {/* Sample download */}
                  <button type="button" onClick={downloadSample}
                    className="flex items-center gap-1.5 text-xs text-green-600 hover:text-green-700 font-medium">
                    <Download className="w-3.5 h-3.5" /> Download sample CSV to see format
                  </button>
                </div>
              )}

              {/* ══════ USE EXISTING LIST ════════════════════════════════ */}
              {source === "list" && (
                <div className="space-y-3">
                  {selectedList ? (
                    <>
                      <button type="button" onClick={() => { setSelectedList(null); setListContacts([]); }}
                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 font-medium">
                        <ArrowLeft className="w-3.5 h-3.5" /> All lists
                      </button>

                      <div className="p-4 bg-green-50 border border-green-100 rounded-xl">
                        <p className="font-semibold text-sm text-green-900">{selectedList.name}</p>
                        {listContactsLoading ? (
                          <div className="flex items-center gap-2 mt-2 text-xs text-green-600"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading contacts…</div>
                        ) : (
                          <p className="text-xs text-green-600 mt-1">{listContacts.length} contacts ready to add</p>
                        )}
                      </div>
                    </>
                  ) : listsLoading ? (
                    <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">Loading your lists…</p></div>
                  ) : savedLists.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-xl">
                      <List className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm font-semibold text-gray-600">No saved lists yet</p>
                      <p className="text-xs text-gray-400 mt-1">Import contacts via CSV or Google Sheets first.</p>
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {savedLists.map(list => (
                        <button key={list.name} type="button" onClick={() => loadListContacts(list)}
                          className="w-full flex items-center gap-3 p-4 rounded-xl border border-gray-100 hover:border-green-300 hover:bg-green-50/30 text-left transition-all group">
                          <div className="w-9 h-9 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center shrink-0">
                            <List className="w-4 h-4 text-green-600" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm text-gray-900 truncate">{list.name}</p>
                            <p className="text-xs text-gray-400">{list.count.toLocaleString()} contacts{list.importedAt ? ` · ${new Date(list.importedAt).toLocaleDateString()}` : ""}</p>
                            {list.samples.length > 0 && (
                              <p className="text-[10px] text-gray-300 mt-0.5 truncate">{list.samples.join(", ")}{list.count > list.samples.length ? "…" : ""}</p>
                            )}
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 shrink-0" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ══════ CRM CONTACTS ═════════════════════════════════════ */}
              {source === "crm" && (
                <div className="space-y-3">
                  {/* Search */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input type="text" value={crmSearch} onChange={e => setCrmSearch(e.target.value)}
                      placeholder="Search name or number…"
                      className="w-full pl-9 pr-3 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none text-gray-800" />
                  </div>

                  {/* Select all / count */}
                  {!crmLoading && filteredCrm.length > 0 && (
                    <div className="flex items-center justify-between">
                      <button type="button" onClick={() => setCrmSelected(prev => {
                        if (prev.size === filteredCrm.length) return new Set();
                        return new Set(filteredCrm.map(c => c.id));
                      })} className="text-xs text-green-600 font-semibold hover:underline">
                        {crmSelected.size === filteredCrm.length ? "Deselect all" : "Select all"}
                      </button>
                      {crmSelected.size > 0 && <span className="text-xs text-gray-500 font-medium">{crmSelected.size} selected</span>}
                    </div>
                  )}

                  {/* Contact list */}
                  <div className="max-h-64 overflow-y-auto space-y-1 border border-gray-100 rounded-xl overflow-hidden">
                    {crmLoading ? (
                      <div className="py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300 mx-auto mb-2" /><p className="text-xs text-gray-400">Loading contacts…</p></div>
                    ) : filteredCrm.length === 0 ? (
                      <div className="py-8 text-center text-xs text-gray-400">
                        {crmSearch ? "No contacts match your search." : "No CRM contacts found. Contacts are added when people message your WhatsApp accounts."}
                      </div>
                    ) : (
                      filteredCrm.map(c => {
                        const phone = c.remoteJid.replace("@s.whatsapp.net", "");
                        const checked = crmSelected.has(c.id);
                        return (
                          <button key={c.id} type="button"
                            onClick={() => setCrmSelected(prev => { const next = new Set(prev); checked ? next.delete(c.id) : next.add(c.id); return next; })}
                            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${checked ? "bg-green-50" : "hover:bg-gray-50"}`}
                          >
                            <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? "bg-green-600 border-green-600" : "border-gray-300"}`}>
                              {checked && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center shrink-0 text-xs font-bold text-gray-500">
                              {(c.pushName || phone)[0]?.toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">{c.pushName || <span className="text-gray-400 italic">Unknown</span>}</p>
                              <p className="text-xs text-gray-400 font-mono">+{phone}</p>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {source && canSubmit && (
          <div className="px-5 pb-5 pt-3 border-t border-gray-100 shrink-0">
            {['csv','sheets','paste'].includes(source) && <div className="mb-3 text-xs text-gray-500" aria-label="Phone number preview"><p className="font-medium text-gray-700">{validCount} unique numbers ready</p>{contacts.slice(0,3).map(contact => <span key={contact.phone} className="inline-block mr-3 mt-1 font-mono">+{contact.phone}</span>)}{!validCount && <p className="mt-1">Use complete international numbers, or turn on a default country code for local numbers.</p>}</div>}
            {useCc && !countryCode && <p role="alert" className="text-sm text-amber-700 mb-3">Enter a country calling code, such as 234, to convert local numbers.</p>}
            {rejectedCount > 0 && <p className="text-xs text-amber-700 mb-2">{rejectedCount} rows will be skipped because their numbers are incomplete or invalid.</p>}
            {duplicateCount > 0 && <p className="text-xs text-gray-500 mb-2">{duplicateCount} duplicate numbers removed.</p>}
            {submitError && <p role="alert" className="text-sm text-red-600 mb-3">{submitError}</p>}
            <button onClick={handleSubmit} disabled={submitting || !validCount}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-50 transition-colors">
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing…</>
                : <><Phone className="w-4 h-4" /> {mode === "contacts" ? "Import" : "Add"} {validCount} Contact{validCount !== 1 ? "s" : ""}</>
              }
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
