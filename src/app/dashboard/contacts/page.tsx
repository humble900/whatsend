"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useEffect, useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, Download, UserPlus, ShieldAlert, CheckCircle2,
  List, ChevronRight, Loader2, ChevronDown, FileText, Phone,
  ShieldCheck, XCircle, AlertTriangle, X,
} from "lucide-react";
import { format } from "date-fns";
import AddLeadsModal from "@/components/AddLeadsModal";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  remoteJid: string;
  pushName: string | null;
  isSaved: boolean;
  isBlacklisted: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
  waStatus?: "verified" | "invalid" | "unchecked";
}

type ViewMode = "contacts" | "lists";
type ContactFilter = "all" | "saved" | "blacklisted";
type ExportScope = "selected" | "page" | "all";
type ExportFormat = "csv" | "vcf";

interface SavedList {
  name: string;
  count: number;
  importedAt: string | null;
  samples: string[];
}

// ─── VCF generator ─────────────────────────────────────────────────────────────

function toVcf(contacts: Contact[]): string {
  return contacts.map(c => {
    const phone = c.remoteJid.replace("@s.whatsapp.net", "");
    const name = c.pushName || `+${phone}`;
    return [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `FN:${name}`,
      `N:${name.split(" ").pop()};${name.split(" ")[0]};;;`,
      `TEL;TYPE=CELL,VOICE:+${phone}`,
      `END:VCARD`,
    ].join("\r\n");
  }).join("\r\n");
}

function toCsv(contacts: Contact[]): string {
  const header = "Phone,Name,List,Status,WA Verified,Added\n";
  const rows = contacts.map(c => {
    const phone = c.remoteJid.replace("@s.whatsapp.net", "");
    return `+${phone},"${c.pushName || ""}","${c.metadata?._listName || ""}","${c.isBlacklisted ? "Opted Out" : "Active"}","${c.waStatus || "unchecked"}","${c.createdAt}"`;
  });
  return header + rows.join("\n");
}

function download(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── WA Verify Banner ──────────────────────────────────────────────────────────

function VerifyBanner({
  count, onVerify, verifying, result,
}: {
  count: number;
  onVerify: () => void;
  verifying: boolean;
  result: { verified: number; invalid: number } | null;
}) {
  if (result) {
    return (
      <div className="flex items-center gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm">
        <ShieldCheck className="w-4 h-4 text-green-600 shrink-0" />
        <span className="text-green-700 font-medium">
          {result.verified} verified on WhatsApp
          {result.invalid > 0 && <span className="text-red-500 ml-2">· {result.invalid} not on WhatsApp (filtered out)</span>}
        </span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm">
      <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
      <span className="text-amber-800 font-medium flex-1">
        {count} contacts not verified. Sending to unverified numbers can get your account banned.
      </span>
      <button
        onClick={onVerify}
        disabled={verifying}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors whitespace-nowrap"
      >
        {verifying ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking…</> : <><ShieldCheck className="w-3.5 h-3.5" /> Verify Now</>}
      </button>
    </div>
  );
}

// ─── Export Dropdown ───────────────────────────────────────────────────────────

function ExportDropdown({
  selectedCount, pageCount, totalCount,
  onExport,
}: {
  selectedCount: number;
  pageCount: number;
  totalCount: number;
  onExport: (scope: ExportScope, fmt: ExportFormat) => void;
}) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<ExportScope>("all");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const scopeOptions: { key: ExportScope; label: string; count: number }[] = [
    { key: "selected", label: "Selected contacts", count: selectedCount },
    { key: "page",     label: "This page",         count: pageCount },
    { key: "all",      label: "All contacts",      count: totalCount },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
      >
        <Download className="w-4 h-4" /> Export
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.14 }}
            className="absolute right-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-xl shadow-gray-200/80 border border-gray-100 p-3 z-50"
          >
            {/* Scope */}
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">What to export</p>
            <div className="space-y-1 mb-3">
              {scopeOptions.map(({ key, label, count }) => (
                <button
                  key={key}
                  onClick={() => setScope(key)}
                  disabled={key === "selected" && selectedCount === 0}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
                    scope === key ? "bg-green-50 text-green-700 font-semibold" : "hover:bg-gray-50 text-gray-700"
                  } disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  <span>{label}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${scope === key ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>{count.toLocaleString()}</span>
                </button>
              ))}
            </div>

            {/* Format */}
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-1 mb-2">Format</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { onExport(scope, "csv"); setOpen(false); }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-green-400 hover:bg-green-50 transition-all group"
              >
                <FileText className="w-5 h-5 text-gray-400 group-hover:text-green-600" />
                <span className="text-xs font-semibold text-gray-700 group-hover:text-green-700">CSV</span>
                <span className="text-[10px] text-gray-400">Excel / Sheets</span>
              </button>
              <button
                onClick={() => { onExport(scope, "vcf"); setOpen(false); }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50 transition-all group"
              >
                <Phone className="w-5 h-5 text-gray-400 group-hover:text-blue-600" />
                <span className="text-xs font-semibold text-gray-700 group-hover:text-blue-700">vCard (.vcf)</span>
                <span className="text-[10px] text-gray-400">Phone contacts</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ContactFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("contacts");
  const [showImport, setShowImport] = useState(false);
  const [activeList, setActiveList] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // WA Verification
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ verified: number; invalid: number } | null>(null);

  // ── Fetch contacts ─────────────────────────────────────────────────────────
  const [loadError, setLoadError] = useState("");
  const fetchContacts = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const res = await authenticatedFetch("/api/contacts", { headers: { } });
      const data = await res.json();
      if (data.contacts) setContacts(data.contacts);
    } catch (err) { setLoadError(err instanceof Error ? err.message : "Could not load contacts."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  // ── Filtering + pagination ─────────────────────────────────────────────────
  const filtered = contacts.filter(c => {
    if (filter === "saved" && !c.isSaved) return false;
    if (filter === "blacklisted" && !c.isBlacklisted) return false;
    if (activeList && c.metadata?._listName !== activeList) return false;
    if (search) {
      const q = search.toLowerCase();
      return c.pushName?.toLowerCase().includes(q) || c.remoteJid.includes(q);
    }
    return true;
  });

  const pageContacts = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Reset page on filter change
  useEffect(() => setPage(1), [search, filter, activeList, viewMode]);

  // ── Lists ──────────────────────────────────────────────────────────────────
  const listsMap = new Map<string, Contact[]>();
  for (const c of contacts) {
    const l: string = c.metadata?._listName || "Unsaved Chats";
    if (!listsMap.has(l)) listsMap.set(l, []);
    listsMap.get(l)!.push(c);
  }
  const savedLists: SavedList[] = Array.from(listsMap.entries())
    .filter(([name]) => name !== "Unsaved Chats")
    .map(([name, cs]) => ({
      name, count: cs.length,
      importedAt: cs[0]?.metadata?._importedAt || null,
      samples: cs.slice(0, 3).map(c => c.pushName || `+${c.remoteJid.replace("@s.whatsapp.net", "")}`),
    }));

  // ── Selection helpers ──────────────────────────────────────────────────────
  const toggleRow = (id: string) =>
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const togglePageAll = () => {
    const pageIds = new Set(pageContacts.map(c => c.id));
    const allChecked = pageContacts.every(c => selected.has(c.id));
    setSelected(prev => {
      const n = new Set(prev);
      if (allChecked) pageIds.forEach(id => n.delete(id));
      else pageIds.forEach(id => n.add(id));
      return n;
    });
  };

  const pageAllChecked = pageContacts.length > 0 && pageContacts.every(c => selected.has(c.id));
  const pagePartialChecked = !pageAllChecked && pageContacts.some(c => selected.has(c.id));

  // ── WA Verify ──────────────────────────────────────────────────────────────
  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const unverified = filtered
        .filter(c => !c.waStatus || c.waStatus === "unchecked")
        .map(c => c.remoteJid.replace("@s.whatsapp.net", ""))
        .slice(0, 500);

      const res = await authenticatedFetch("/api/contacts/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ phones: unverified, saveVerified: true }),
      });
      const data = await res.json();

      if (res.ok) {
        setVerifyResult({ verified: data.verified, invalid: data.invalid });
        // Update local state
        const resultMap = new Map(data.results.map((r: any) => [r.phone, r.exists]));
        setContacts(prev => prev.map(c => {
          const phone = c.remoteJid.replace("@s.whatsapp.net", "");
          if (resultMap.has(phone)) {
            return { ...c, waStatus: resultMap.get(phone) ? "verified" : "invalid" };
          }
          return c;
        }));
      }
    } catch (e) { console.error(e); }
    finally { setVerifying(false); }
  };

  // ── Export ─────────────────────────────────────────────────────────────────
  const handleExport = (scope: ExportScope, fmt: ExportFormat) => {
    let targets: Contact[];
    if (scope === "selected") targets = filtered.filter(c => selected.has(c.id));
    else if (scope === "page") targets = pageContacts;
    else targets = filtered;

    const date = format(new Date(), "yyyy-MM-dd");
    if (fmt === "csv") {
      download(toCsv(targets), `contacts_${scope}_${date}.csv`, "text/csv");
    } else {
      download(toVcf(targets), `contacts_${scope}_${date}.vcf`, "text/vcard");
    }
  };

  const unverifiedCount = filtered.filter(c => !c.waStatus || c.waStatus === "unchecked").length;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          
          <p className="text-sm text-gray-500 mt-0.5">
            {contacts.length.toLocaleString()} contacts{selected.size > 0 && <span className="ml-2 text-green-600 font-semibold">· {selected.size} selected</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDropdown
            selectedCount={selected.size}
            pageCount={pageContacts.length}
            totalCount={filtered.length}
            onExport={handleExport}
          />
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700 transition-colors shadow-sm"
          >
            <UserPlus className="w-4 h-4" /> Import Contacts
          </button>
        </div>
      </div>

      {/* View switcher */}
      <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: "contacts" as ViewMode, icon: Users, label: "All Contacts" },
          { key: "lists" as ViewMode, icon: List, label: "Lists" },
        ]).map(({ key, icon: Icon, label }) => (
          <button key={key} onClick={() => { setViewMode(key); setActiveList(null); }}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${viewMode === key ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Icon className="w-4 h-4" /> {label}
            {key === "lists" && savedLists.length > 0 && (
              <span className="ml-1 text-[10px] font-bold bg-green-100 text-green-700 px-1.5 rounded-full">{savedLists.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* WA Verify Banner */}
      {viewMode === "contacts" && !loading && unverifiedCount > 0 && (
        <VerifyBanner count={unverifiedCount} onVerify={handleVerify} verifying={verifying} result={verifyResult} />
      )}

      {/* ══ LISTS VIEW ══════════════════════════════════════════════════════ */}
      {viewMode === "lists" && (
        <AnimatePresence mode="wait">
          <motion.div key="lists" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            {savedLists.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 border-2 border-dashed border-gray-200 rounded-2xl bg-gray-50/50">
                <List className="w-10 h-10 text-gray-300 mb-4" />
                <p className="text-sm font-semibold text-gray-600">No lists imported yet</p>
                <p className="text-xs text-gray-400 mt-1 mb-6">Import contacts via CSV or Google Sheets to create a list.</p>
                <button onClick={() => setShowImport(true)}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-green-600 text-white text-sm font-semibold hover:bg-green-700">
                  <UserPlus className="w-4 h-4" /> Import Contacts
                </button>
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {savedLists.map(list => (
                  <button key={list.name}
                    onClick={() => { setActiveList(list.name); setViewMode("contacts"); }}
                    className="text-left p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:border-green-300 hover:shadow-md transition-all group">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-10 h-10 rounded-xl bg-green-50 border border-green-100 flex items-center justify-center">
                        <List className="w-5 h-5 text-green-600" />
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-green-500 transition-colors" />
                    </div>
                    <p className="font-semibold text-gray-900 text-sm truncate">{list.name}</p>
                    <p className="text-xs text-gray-400 mt-1">{list.count.toLocaleString()} contact{list.count !== 1 ? "s" : ""}</p>
                    {list.importedAt && <p className="text-[10px] text-gray-300 mt-1">Imported {format(new Date(list.importedAt), "MMM d, yyyy")}</p>}
                    {list.samples.length > 0 && <p className="text-[10px] text-gray-300 mt-1 truncate">{list.samples.join(", ")}</p>}
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* ══ CONTACTS TABLE ══════════════════════════════════════════════════ */}
      {viewMode === "contacts" && (
        <AnimatePresence mode="wait">
          <motion.div key={`tbl-${activeList}`} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>

            {/* Breadcrumb */}
            {activeList && (
              <div className="flex items-center gap-2 mb-4">
                <button onClick={() => { setActiveList(null); setViewMode("lists"); }}
                  className="text-xs text-gray-400 hover:text-gray-700 font-medium">Lists</button>
                <span className="text-gray-300">/</span>
                <span className="text-xs font-semibold text-gray-800">{activeList}</span>
                <span className="text-xs text-gray-400">({listsMap.get(activeList)?.length || 0})</span>
                <button onClick={() => setActiveList(null)} className="ml-auto p-1 rounded hover:bg-gray-100">
                  <X className="w-3.5 h-3.5 text-gray-400" />
                </button>
              </div>
            )}

            <div className="bg-white border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
              {/* Toolbar */}
              <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                {!activeList && (
                  <div className="flex items-center gap-1.5">
                    {([
                      { key: "all" as ContactFilter, label: "All", count: contacts.length },
                      { key: "saved" as ContactFilter, label: "Saved", count: contacts.filter(c => c.isSaved).length },
                      { key: "blacklisted" as ContactFilter, label: "Opted Out", count: contacts.filter(c => c.isBlacklisted).length },
                    ]).map(({ key, label, count }) => (
                      <button key={key} onClick={() => setFilter(key)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filter === key ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                        {label} <span className={`ml-1 ${filter === key ? "opacity-70" : "text-gray-400"}`}>{count}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative flex-1 min-w-[180px] sm:ml-auto">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                  <input type="text" placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 outline-none" />
                </div>
              </div>

              {loadError && <p className="app-error" role="alert">{loadError}<button onClick={() => void fetchContacts()}>Retry</button></p>}
              <div className="app-contact-cards">
                <label className="app-select-all"><input type="checkbox" checked={pageAllChecked} onChange={togglePageAll} /> Select this page</label>
                {loading ? <p className="app-card-empty" role="status">Loading contacts…</p> : !pageContacts.length ? <p className="app-card-empty">No contacts found.</p> : pageContacts.map(contact => <article key={contact.id} className="app-contact-card">
                  <label><input type="checkbox" checked={selected.has(contact.id)} onChange={() => toggleRow(contact.id)} aria-label={`Select ${contact.pushName || contact.remoteJid}`} /><span><strong>{contact.pushName || "Unnamed contact"}</strong><small>+{contact.remoteJid.replace("@s.whatsapp.net", "")}</small></span></label>
                  <div><span>{contact.isBlacklisted ? "Opted out" : "Active"}</span><span>{contact.waStatus === "verified" ? "On WhatsApp" : contact.waStatus === "invalid" ? "Not on WhatsApp" : "Not verified"}</span></div>
                  {contact.metadata?._listName && <button onClick={() => setActiveList(contact.metadata!._listName)}>List: {contact.metadata._listName}</button>}
                </article>)}
              </div>
              {/* Desktop table */}
              <div className="overflow-x-auto app-contact-table">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-3 w-10">
                        <input type="checkbox" checked={pageAllChecked} ref={el => { if (el) el.indeterminate = pagePartialChecked; }}
                          onChange={togglePageAll}
                          className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer" />
                      </th>
                      {["Phone", "Name", "List", "WA Status", "Status", "Added"].map(h => (
                        <th key={h} className="px-4 py-3 text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {loading ? (
                      <tr><td colSpan={7} className="py-16 text-center">
                        <Loader2 className="w-6 h-6 animate-spin text-gray-300 mx-auto mb-2" />
                        <p className="text-sm text-gray-400">Loading contacts…</p>
                      </td></tr>
                    ) : pageContacts.length === 0 ? (
                      <tr><td colSpan={7} className="py-16 text-center">
                        <Users className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                        <p className="text-sm font-medium text-gray-500">No contacts found</p>
                      </td></tr>
                    ) : (
                      pageContacts.map(c => {
                        const phone = c.remoteJid.replace("@s.whatsapp.net", "");
                        const listName = c.metadata?._listName;
                        const isChecked = selected.has(c.id);
                        return (
                          <tr key={c.id}
                            className={`hover:bg-gray-50/80 transition-colors ${isChecked ? "bg-green-50/40" : "bg-white"}`}
                            onClick={() => toggleRow(c.id)}
                            style={{ cursor: "pointer" }}
                          >
                            <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={isChecked} onChange={() => toggleRow(c.id)}
                                className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500 cursor-pointer" />
                            </td>
                            <td className="px-4 py-3.5 font-mono font-semibold text-gray-800 text-xs">+{phone}</td>
                            <td className="px-4 py-3.5">
                              {c.pushName
                                ? <span className="font-medium text-gray-800">{c.pushName}</span>
                                : <span className="text-gray-300 italic text-xs">Unknown</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              {listName && listName !== "Unsaved Chats" ? (
                                <button onClick={e => { e.stopPropagation(); setActiveList(listName); }}
                                  className="flex items-center gap-1 text-xs text-green-600 font-medium hover:underline">
                                  <List className="w-3 h-3" />{listName}
                                </button>
                              ) : <span className="text-gray-300 text-xs">—</span>}
                            </td>
                            <td className="px-4 py-3.5">
                              {c.waStatus === "verified" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold border border-green-100">
                                  <CheckCircle2 className="w-3 h-3" /> On WhatsApp
                                </span>
                              )}
                              {c.waStatus === "invalid" && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-bold border border-red-100">
                                  <XCircle className="w-3 h-3" /> Not on WA
                                </span>
                              )}
                              {(!c.waStatus || c.waStatus === "unchecked") && (
                                <span className="text-[10px] text-gray-300">Unchecked</span>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              {c.isBlacklisted
                                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-500 text-[10px] font-bold border border-red-100"><ShieldAlert className="w-3 h-3" />Opted Out</span>
                                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-600 text-[10px] font-bold border border-green-100"><CheckCircle2 className="w-3 h-3" />Active</span>}
                            </td>
                            <td className="px-4 py-3.5 text-xs text-gray-400">{format(new Date(c.createdAt), "MMM d, yyyy")}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination + count footer */}
              {filtered.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
                  <p className="text-xs text-gray-400">
                    {((page - 1) * PAGE_SIZE + 1).toLocaleString()}–{Math.min(page * PAGE_SIZE, filtered.length).toLocaleString()} of {filtered.length.toLocaleString()}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                      ← Prev
                    </button>
                    <span className="text-xs text-gray-500">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-100 disabled:opacity-30 transition-colors">
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {/* Import Modal */}
      <AnimatePresence>
        {showImport && (
          <AddLeadsModal
            mode="contacts"
            title="Import Contacts"
            onClose={() => setShowImport(false)}
            onAdd={() => { fetchContacts(); setVerifyResult(null); }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
