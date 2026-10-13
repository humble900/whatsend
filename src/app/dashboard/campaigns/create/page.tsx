"use client";
import { authenticatedFetch } from "@/lib/authenticated-fetch";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, ArrowRight, ArrowLeft } from "lucide-react";

const SUGGESTIONS = [
  "Summer Sale Outreach 2026",
  "Enterprise Q3 Prospects",
  "Product Launch – Beta Testers",
  "Re-engagement Campaign",
  "Weekly Newsletter Blast",
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleCreate = async () => {
    if (!name.trim()) { setError("Please give your campaign a name."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await authenticatedFetch("/api/campaigns/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json", },
        body: JSON.stringify({ name: name.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create campaign");
      router.push(`/dashboard/campaigns/${data.campaignId}?tab=leads`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
      {/* Subtle grid background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ backgroundImage: "radial-gradient(circle, #e5e7eb 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      {/* Back button */}
      <button
        onClick={() => router.push("/dashboard/campaigns")}
        className="absolute top-6 left-6 flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> All Campaigns
      </button>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-lg bg-white rounded-3xl shadow-xl shadow-gray-200/80 border border-gray-100 p-10"
      >
        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight mb-2">Name your campaign</h1>
          <p className="text-sm text-gray-600">
            Give it a clear name so you can find it easily. You can change this later.
          </p>
        </div>

        {/* Input */}
        <div className="space-y-3 mb-6">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => { setName(e.target.value.slice(0, 120)); setError(""); }}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="e.g. Enterprise Q3 Outreach"
            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3.5 text-sm text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-green-500 focus:border-green-500 outline-none transition-all"
          />
          <div className="flex items-center justify-between px-1">
            {error ? <p className="text-xs text-red-500">{error}</p> : <span />}
            <span className="text-[11px] text-gray-400">{name.length}/120</span>
          </div>
        </div>

        {/* Suggestions */}
        <div className="mb-8">
          <p className="text-[11px] text-gray-500 uppercase tracking-widest font-semibold mb-2.5">
            Suggestions
          </p>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setName(s)}
                className="text-xs px-3 py-1.5 rounded-full border border-gray-300 text-gray-700 hover:text-gray-900 hover:border-gray-500 hover:bg-gray-100 transition-all font-medium"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm active:scale-[0.99]"
        >
          {loading ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
          ) : (
            <>Continue <ArrowRight className="w-4 h-4" /></>
          )}
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
          Saved as a draft — finish setup anytime
        </p>
      </motion.div>
    </div>
  );
}
