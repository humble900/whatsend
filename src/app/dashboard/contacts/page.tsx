"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Search, Download, UserPlus, ShieldAlert, CheckCircle2, UploadCloud, Loader2, Link as LinkIcon } from "lucide-react";
import { format } from "date-fns";
import Papa from "papaparse";
import { useDropzone } from "react-dropzone";

interface Contact {
  id: string;
  remoteJid: string;
  pushName: string | null;
  isSaved: boolean;
  isBlacklisted: boolean;
  metadata?: Record<string, any>;
  createdAt: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "saved" | "blacklisted">("all");

  // Import Modal States
  const [showImportModal, setShowImportModal] = useState(false);
  const [importMode, setImportMode] = useState<"csv" | "sheet">("csv");
  const [sheetUrl, setSheetUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");

  const handleBulkUpload = async (parsedData: any[]) => {
    setIsImporting(true);
    setImportError("");
    try {
      const headers = Object.keys(parsedData[0] || {});
      const phoneCol = headers.find(h => h.toLowerCase().includes("phone") || h.toLowerCase().includes("number")) || headers[0];
      
      const contactsToImport = parsedData.map(row => {
        let phone = row[phoneCol]?.replace(/\D/g, '');
        const variables = { ...row };
        delete variables[phoneCol];
        return { phone, pushName: row.name || row.pushName || "", variables };
      }).filter(c => !!c.phone);

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token") || "mock-token"}` },
        body: JSON.stringify({ contacts: contactsToImport })
      });

      if (!res.ok) throw new Error("Failed to import contacts");
      
      setShowImportModal(false);
      window.location.reload(); 
    } catch (e: any) {
      setImportError(e.message);
    } finally {
      setIsImporting(false);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        handleBulkUpload(results.data);
      }
    });
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1
  });

  const handleSheetImport = async () => {
    if (!sheetUrl) return;
    setIsImporting(true);
    setImportError("");
    try {
      const match = sheetUrl.match(/\/d\/(.*?)(\/|$)/);
      if (!match || !match[1]) throw new Error("Invalid Google Sheets URL");
      const sheetId = match[1];
      const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv`;
      
      const res = await fetch(exportUrl);
      if (!res.ok) throw new Error("Could not fetch the Google Sheet. Make sure it is public (Anyone with the link can view).");
      const csvText = await res.text();
      
      Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          handleBulkUpload(results.data);
        }
      });
    } catch (e: any) {
      setImportError(e.message);
      setIsImporting(false);
    }
  };

  useEffect(() => {
    const fetchContacts = async () => {
      try {
        const token = localStorage.getItem("token") || "mock-token";
        const res = await fetch("/api/contacts", {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (data.contacts) {
          setContacts(data.contacts);
        }
      } catch (err) {
        console.error("Failed to fetch contacts", err);
      } finally {
        setLoading(false);
      }
    };
    fetchContacts();
  }, []);

  const filteredContacts = contacts.filter(c => {
    if (filter === "saved" && !c.isSaved) return false;
    if (filter === "blacklisted" && !c.isBlacklisted) return false;
    
    if (search) {
      const q = search.toLowerCase();
      return (c.pushName?.toLowerCase().includes(q) || c.remoteJid.includes(q));
    }
    return true;
  });

  const handleExport = () => {
    if (filteredContacts.length === 0) return;
    const header = "Phone,Name,Saved,Blacklisted,Date\n";
    const rows = filteredContacts.map(c => 
      `${c.remoteJid.replace('@s.whatsapp.net', '')},${c.pushName || ''},${c.isSaved},${c.isBlacklisted},${c.createdAt}`
    ).join("\n");
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `crm_export_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2">Contact Book</h1>
          <p className="text-muted-foreground text-sm sm:text-lg">Manage CRM syncs and opt-out blacklists.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button 
            onClick={handleExport}
            className="flex-1 sm:flex-none glass-panel px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-secondary/50 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span className="text-sm font-medium">Export Filtered</span>
          </button>
          <button onClick={() => setShowImportModal(true)} className="flex-1 sm:flex-none bg-primary text-white px-4 py-2 rounded-lg flex items-center justify-center gap-2 hover:bg-primary/90 transition-colors shadow-lg shadow-primary/20">
            <UserPlus className="w-4 h-4" />
            <span className="text-sm font-medium">Import Contacts</span>
          </button>
        </div>
      </div>

      <div className="glass-panel rounded-2xl overflow-hidden">
        <div className="p-4 sm:p-6 border-b border-border/50 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
            {/* Tabs */}
            <div className="flex p-1 bg-background/50 rounded-xl">
              <button 
                onClick={() => setFilter("all")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'all' ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                All Contacts
              </button>
              <button 
                onClick={() => setFilter("saved")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'saved' ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Saved
              </button>
              <button 
                onClick={() => setFilter("blacklisted")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === 'blacklisted' ? 'bg-secondary text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Blacklisted
              </button>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input 
                type="text"
                placeholder="Search phone or name..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-background/50 border border-border/50 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border/50 bg-secondary/20">
                <th className="p-4 font-medium text-muted-foreground text-sm">Phone Number</th>
                <th className="p-4 font-medium text-muted-foreground text-sm">Push Name</th>
                <th className="p-4 font-medium text-muted-foreground text-sm">Status</th>
                <th className="p-4 font-medium text-muted-foreground text-sm">Sync Status</th>
                <th className="p-4 font-medium text-muted-foreground text-sm">Added</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    <div className="animate-pulse flex flex-col items-center">
                      <Users className="w-8 h-8 mb-2 opacity-50" />
                      Loading contacts...
                    </div>
                  </td>
                </tr>
              ) : filteredContacts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    No contacts found.
                  </td>
                </tr>
              ) : (
                filteredContacts.map(contact => (
                  <tr key={contact.id} className="border-b border-border/50 hover:bg-secondary/10 transition-colors">
                    <td className="p-4 font-medium font-mono text-sm">{contact.remoteJid}</td>
                    <td className="p-4">
                      {contact.pushName ? (
                        <span className="font-medium">{contact.pushName}</span>
                      ) : (
                        <span className="text-muted-foreground italic text-sm">Unknown</span>
                      )}
                      {contact.metadata && Object.keys(contact.metadata).length > 0 && (
                        <div className="flex gap-1 mt-1.5 flex-wrap">
                          {Object.entries(contact.metadata).map(([k, v]) => (
                            <span key={k} className="text-[10px] bg-secondary/50 px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground">
                              {k}: {String(v)}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {contact.isBlacklisted ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/10 text-red-500 text-xs font-medium border border-red-500/20">
                          <ShieldAlert className="w-3.5 h-3.5" />
                          Opted Out
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-500/10 text-green-500 text-xs font-medium border border-green-500/20">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Active
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="text-sm text-muted-foreground">
                        {contact.isSaved ? "Saved to Phone" : "Unsaved Chat"}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-muted-foreground">
                      {format(new Date(contact.createdAt), "MMM d, yyyy")}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-border/50 shadow-2xl rounded-2xl w-full max-w-lg overflow-hidden flex flex-col"
          >
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-secondary/20">
              <h3 className="font-bold">Import CRM Contacts</h3>
              <button onClick={() => setShowImportModal(false)} className="text-muted-foreground hover:text-foreground text-sm">
                Close
              </button>
            </div>
            <div className="p-6 space-y-6">
              
              <div className="flex p-1 bg-secondary/30 rounded-xl">
                <button 
                  onClick={() => setImportMode("csv")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${importMode === 'csv' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  CSV File
                </button>
                <button 
                  onClick={() => setImportMode("sheet")}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${importMode === 'sheet' ? 'bg-primary text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Google Sheet
                </button>
              </div>

              {importError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-xs rounded-lg font-medium">
                  {importError}
                </div>
              )}

              {importMode === "csv" ? (
                <div 
                  {...getRootProps()} 
                  className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                    isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/20'
                  } ${isImporting ? 'opacity-50 pointer-events-none' : ''}`}
                >
                  <input {...getInputProps()} />
                  {isImporting ? (
                    <Loader2 className="w-12 h-12 mx-auto mb-4 text-primary animate-spin" />
                  ) : (
                    <UploadCloud className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                  )}
                  <p className="text-lg font-medium">{isImporting ? 'Importing...' : 'Drag & drop CSV file'}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Google Sheet Public Link</label>
                    <input 
                      type="text" 
                      placeholder="https://docs.google.com/spreadsheets/d/..."
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="w-full bg-background/50 border border-border/50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-2">
                      <ShieldAlert className="w-3 h-3" />
                      Must be set to "Anyone with the link can view".
                    </p>
                  </div>
                  <button 
                    onClick={handleSheetImport}
                    disabled={isImporting || !sheetUrl}
                    className="w-full bg-primary text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
                  >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <LinkIcon className="w-4 h-4" />}
                    {isImporting ? "Importing..." : "Sync from Google Sheets"}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
