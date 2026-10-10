"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Type, Users, ShieldAlert, Sparkles, Play, UploadCloud, Loader2, ChevronRight, ChevronLeft, CheckCircle2, Download } from "lucide-react";
import { useDropzone } from "react-dropzone";
import Papa from "papaparse";
import { useRouter } from "next/navigation";

interface ContactRow {
  phone: string;
  variables: Record<string, string>;
}

export default function CampaignBuilderPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [spintax, setSpintax] = useState("{Hi|Hello|Hey} {{name}}, check out our new {product|service}!");
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [isImportingCrm, setIsImportingCrm] = useState(false);
  
  const [showCrmModal, setShowCrmModal] = useState(false);
  const [crmContacts, setCrmContacts] = useState<any[]>([]);
  const [selectedCrmContacts, setSelectedCrmContacts] = useState<Set<string>>(new Set());
  const [isCrmLoading, setIsCrmLoading] = useState(false);
  const [countryCode, setCountryCode] = useState("");

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const data = results.data as Record<string, string>[];
        if (data.length === 0) return;
        
        const headers = Object.keys(data[0]);
        setColumns(headers);
        
        // Try to automatically find the phone and country code columns
        const phoneCol = headers.find(h => h.toLowerCase().includes("phone") || h.toLowerCase().includes("number")) || headers[0];
        const ccCol = headers.find(h => h.toLowerCase().replace(/[^a-z]/g, '').includes("countrycode"));
        
        const mappedContacts = data.map(row => {
          let phone = row[phoneCol]?.replace(/\D/g, '') || "";
          const rowCountryCode = ccCol ? row[ccCol]?.replace(/\D/g, '') : "";
          const codeToApply = rowCountryCode || countryCode.replace(/\D/g, '');
          
          // Apply country code if provided and number seems local
          if (codeToApply && phone && !phone.startsWith(codeToApply)) {
             phone = codeToApply + phone;
          }

          const variables = { ...row };
          delete variables[phoneCol];
          if (ccCol) delete variables[ccCol]; // Don't expose country code as a spintax variable
          return { phone, variables };
        }).filter(c => !!c.phone);

        setContacts(mappedContacts);
      }
    });
  }, [countryCode]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'text/csv': ['.csv'] },
    maxFiles: 1
  });

  const handleNext = () => {
    setError("");
    if (step === 1) {
      if (!name.trim()) return setError("Campaign name is required.");
      if (contacts.length === 0) return setError("Please upload a valid CSV with contacts.");
    }
    if (step === 2) {
      if (!spintax.trim()) return setError("Spintax template is required.");
    }
    setStep(prev => prev + 1);
  };

  const handleLaunch = async () => {
    setError("");
    setIsSubmitting(true);
    try {
      const token = localStorage.getItem("token") || "mock-token";
      const res = await fetch("/api/campaigns", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name,
          spintaxTemplate: spintax,
          contacts,
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to launch campaign");
      
      router.push("/dashboard/campaigns");
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-4 mb-12">
      {[
        { num: 1, label: "Audience" },
        { num: 2, label: "Message" },
        { num: 3, label: "Dispatch" }
      ].map((s, i) => (
        <div key={s.num} className="flex items-center gap-4">
          <div className="flex flex-col items-center gap-2">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold transition-colors ${
              step >= s.num ? 'bg-primary text-white shadow-lg shadow-primary/30' : 'bg-secondary text-muted-foreground'
            }`}>
              {step > s.num ? <CheckCircle2 className="w-5 h-5" /> : s.num}
            </div>
            <span className={`text-xs font-medium ${step >= s.num ? 'text-foreground' : 'text-muted-foreground'}`}>{s.label}</span>
          </div>
          {i < 2 && (
            <div className={`w-16 h-1 rounded-full -mt-6 ${step > s.num ? 'bg-primary' : 'bg-secondary'}`} />
          )}
        </div>
      ))}
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">Create Campaign</h1>
        <p className="text-muted-foreground text-lg">Follow the wizard to safely dispatch your outreach.</p>
      </div>

      <StepIndicator />

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-sm font-medium text-center">
          {error}
        </motion.div>
      )}

      <div className="glass-panel p-6 sm:p-10 rounded-3xl min-h-[400px] relative overflow-hidden">
        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-2xl font-bold mb-2">Campaign Details</h2>
                <p className="text-muted-foreground">Name your campaign and upload your target audience.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Campaign Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-background/50 border border-border/50 rounded-xl p-4 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="e.g. Summer Outreach 2026"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Default Country Code</label>
                  <input
                    type="text"
                    value={countryCode}
                    onChange={(e) => setCountryCode(e.target.value)}
                    className="w-full bg-background/50 border border-border/50 rounded-xl p-4 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                    placeholder="e.g. +1 or +44 (Optional)"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Prepended to numbers without country codes.</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div className="flex items-center gap-3">
                    <label className="text-sm font-medium">Target Audience</label>
                    <button 
                      onClick={() => {
                        const csvContent = "phone,country_code,name,company\n4155552671,1,John Doe,Acme Corp\n7912345678,44,Jane Smith,Tech Inc"; 
                        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }); 
                        const url = URL.createObjectURL(blob); 
                        const a = document.createElement('a'); 
                        a.href = url; 
                        a.download = 'sample_contacts.csv'; 
                        a.click(); 
                        URL.revokeObjectURL(url);
                      }}
                      className="text-xs flex items-center gap-1 text-primary bg-primary/10 px-2 py-1 rounded-md hover:bg-primary/20 transition-colors"
                    >
                      <Download className="w-3 h-3" /> 
                      Sample CSV
                    </button>
                  </div>
                  {contacts.length > 0 && (
                    <span className="text-primary text-xs font-bold bg-primary/10 px-2 py-1 rounded-md">{contacts.length} Contacts Loaded</span>
                  )}
                </div>
                
                {contacts.length === 0 ? (
                  <div className="space-y-4">
                    <div 
                      {...getRootProps()} 
                      className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
                        isDragActive ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-secondary/20'
                      }`}
                    >
                      <input {...getInputProps()} />
                      <UploadCloud className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                      <p className="text-lg font-medium">Drag & drop your CSV file here</p>
                      <p className="text-sm text-muted-foreground mt-2">Make sure it contains a 'phone' column</p>
                    </div>

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-border/50" />
                      </div>
                      <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#09090b] px-2 text-muted-foreground">Or</span>
                      </div>
                    </div>

                    <button
                      onClick={async () => {
                        setShowCrmModal(true);
                        setIsCrmLoading(true);
                        try {
                          const res = await fetch("/api/contacts", { headers: { Authorization: `Bearer ${localStorage.getItem("token") || "mock-token"}` }});
                          const data = await res.json();
                          if (data.contacts) {
                            setCrmContacts(data.contacts.filter((c: any) => !c.isBlacklisted));
                          }
                        } catch (e) {
                          console.error(e);
                        } finally {
                          setIsCrmLoading(false);
                        }
                      }}
                      className="w-full flex items-center justify-center gap-2 border border-border/50 hover:bg-secondary/50 py-4 rounded-2xl transition-colors font-medium text-sm"
                    >
                      <Users className="w-4 h-4 text-primary" />
                      Select from CRM
                    </button>
                  </div>
                ) : (
                  <div className="border border-border/50 rounded-2xl overflow-hidden bg-background/50">
                    <div className="p-4 bg-secondary/30 flex justify-between items-center border-b border-border/50">
                      <span className="font-medium text-sm">Data Preview (First 5 Rows)</span>
                      <button 
                        onClick={() => setContacts([])}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remove & Re-upload
                      </button>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-secondary/10">
                          <tr>
                            <th className="p-3 font-medium text-muted-foreground">Formatted Phone</th>
                            {columns.filter(c => !c.toLowerCase().includes('phone') && !c.toLowerCase().includes('number')).slice(0, 3).map(col => (
                              <th key={col} className="p-3 font-medium text-muted-foreground">{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {contacts.slice(0, 5).map((c, i) => (
                            <tr key={i} className="border-t border-border/50">
                              <td className="p-3 font-mono text-primary">{c.phone}</td>
                              {columns.filter(col => !col.toLowerCase().includes('phone') && !col.toLowerCase().includes('number')).slice(0, 3).map(col => (
                                <td key={col} className="p-3 text-muted-foreground truncate max-w-[150px]">{c.variables[col] || '-'}</td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div>
                <h2 className="text-2xl font-bold mb-2">Message Design</h2>
                <p className="text-muted-foreground">Use Spintax and dynamic variables to personalize each message.</p>
              </div>

              {columns.length > 0 && (
                <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
                  <p className="text-sm font-medium mb-3">Detected Variables:</p>
                  <div className="flex flex-wrap gap-2">
                    {columns.map(col => (
                      <span key={col} className="bg-background border border-border px-3 py-1.5 rounded-lg text-xs font-mono">
                        {`{{${col}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="relative">
                <textarea
                  value={spintax}
                  onChange={(e) => setSpintax(e.target.value)}
                  className="w-full h-48 bg-background/50 border border-border/50 rounded-2xl p-5 text-foreground focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all resize-none text-lg"
                  placeholder="{Hello|Hi} {{name}}..."
                />
              </div>

              <div className="flex items-start gap-3 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                <ShieldAlert className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <p className="text-sm text-orange-500/90 leading-relaxed">
                  <strong>Anti-Ban Tip:</strong> High variance reduces ban risk. Make sure your Spintax blocks {`{A|B|C}`} create enough unique combinations for {contacts.length} recipients.
                </p>
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-8"
            >
              <div className="text-center mb-10">
                <div className="w-16 h-16 bg-green-500/20 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Send className="w-8 h-8" />
                </div>
                <h2 className="text-2xl font-bold mb-2">Ready to Dispatch</h2>
                <p className="text-muted-foreground">Your campaign is queued and ready for the instance rotation engine.</p>
              </div>

              <div className="grid gap-4 max-w-md mx-auto">
                <div className="flex justify-between items-center p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <span className="text-muted-foreground">Campaign Name</span>
                  <span className="font-bold">{name}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <span className="text-muted-foreground">Total Recipients</span>
                  <span className="font-bold">{contacts.length}</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <span className="text-muted-foreground">Est. Delivery Time</span>
                  <span className="font-bold text-primary">~{Math.ceil(contacts.length * 0.5)} mins</span>
                </div>
                <div className="flex justify-between items-center p-4 rounded-xl bg-secondary/30 border border-border/50">
                  <span className="text-muted-foreground">Human Simulation</span>
                  <span className="font-bold text-green-500">Active</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between pt-4">
        <button
          onClick={() => setStep(prev => prev - 1)}
          disabled={step === 1 || isSubmitting}
          className="px-6 py-3 rounded-xl font-medium flex items-center gap-2 hover:bg-secondary/80 disabled:opacity-0 transition-all"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>

        {step < 3 ? (
          <button
            onClick={handleNext}
            className="bg-primary text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all"
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={handleLaunch}
            disabled={isSubmitting}
            className="bg-gradient-to-r from-primary to-purple-600 text-white px-10 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 shadow-xl shadow-primary/30 transition-all disabled:opacity-50"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Dispatching...
              </>
            ) : (
              <>
                <Play className="w-5 h-5" />
                Launch Campaign
              </>
            )}
          </button>
        )}
      </div>

      {showCrmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-background border border-border/50 shadow-2xl rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
          >
            <div className="p-4 border-b border-border/50 flex justify-between items-center bg-secondary/20">
              <h3 className="font-bold">Select Contacts from CRM</h3>
              <button onClick={() => setShowCrmModal(false)} className="text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {isCrmLoading ? (
                <div className="flex flex-col items-center justify-center py-10 opacity-50">
                  <Loader2 className="w-8 h-8 animate-spin mb-2" />
                  <p>Loading CRM...</p>
                </div>
              ) : crmContacts.length === 0 ? (
                <p className="text-center text-muted-foreground py-10">Your CRM is empty.</p>
              ) : (
                <div className="space-y-2">
                  <div className="flex justify-between items-center mb-4 px-2">
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="rounded border-border bg-background"
                        checked={selectedCrmContacts.size === crmContacts.length && crmContacts.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedCrmContacts(new Set(crmContacts.map(c => c.id)));
                          } else {
                            setSelectedCrmContacts(new Set());
                          }
                        }}
                      />
                      <span className="font-medium">Select All</span>
                    </label>
                    <span className="text-xs text-muted-foreground">{selectedCrmContacts.size} selected</span>
                  </div>
                  {crmContacts.map(contact => (
                    <label key={contact.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/50 hover:bg-secondary/30 cursor-pointer transition-colors">
                      <input 
                        type="checkbox"
                        className="rounded border-border bg-background"
                        checked={selectedCrmContacts.has(contact.id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedCrmContacts);
                          if (e.target.checked) newSet.add(contact.id);
                          else newSet.delete(contact.id);
                          setSelectedCrmContacts(newSet);
                        }}
                      />
                      <div>
                        <p className="font-medium text-sm">{contact.pushName || "Unknown"} <span className="text-muted-foreground font-mono ml-2">{contact.remoteJid.replace('@s.whatsapp.net', '')}</span></p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-border/50 bg-secondary/10 flex justify-end gap-3">
              <button 
                onClick={() => setShowCrmModal(false)}
                className="px-4 py-2 rounded-lg text-sm font-medium hover:bg-secondary/50"
              >
                Cancel
              </button>
              <button 
                disabled={selectedCrmContacts.size === 0}
                onClick={() => {
                  const selected = crmContacts.filter(c => selectedCrmContacts.has(c.id));
                  const mapped = selected.map(c => ({
                    phone: c.remoteJid.replace('@s.whatsapp.net', ''),
                    variables: { ...c.metadata, pushName: c.pushName || "" }
                  }));
                  setContacts(mapped);
                  if (mapped.length > 0) setColumns(Object.keys(mapped[0].variables));
                  setShowCrmModal(false);
                }}
                className="bg-primary text-white px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50 hover:bg-primary/90"
              >
                Add {selectedCrmContacts.size} Contacts
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
