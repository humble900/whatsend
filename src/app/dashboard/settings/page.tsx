"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Settings, Globe, Shield, Bell, Key, Database, Save } from "lucide-react";

export default function SettingsPage() {
  const [evolutionUrl, setEvolutionUrl] = useState("https://evo1.railway.internal:8080");
  const [apiKey, setApiKey] = useState("••••••••••••••••");
  const [dailyLimit, setDailyLimit] = useState("250");
  const [optOutKeywords, setOptOutKeywords] = useState("STOP, UNSUBSCRIBE, QUIT, CANCEL, OPTOUT");
  const [webhookUrl, setWebhookUrl] = useState("https://app.watisale.com/api/webhook/evolution");

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8 max-w-3xl"
    >
      <div>
        <h1 className="text-2xl sm:text-4xl font-bold tracking-tight mb-2">Settings</h1>
        <p className="text-muted-foreground text-sm sm:text-lg">
          Configure your infrastructure, limits, and compliance rules.
        </p>
      </div>

      {/* Evolution API Config */}
      <div className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <Globe className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Evolution API Connection</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Server URL</label>
            <input
              type="text"
              value={evolutionUrl}
              onChange={(e) => setEvolutionUrl(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all font-mono"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Webhook Callback URL</label>
            <input
              type="text"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all font-mono"
            />
          </div>
        </div>
      </div>

      {/* Anti-Ban Limits */}
      <div className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <Shield className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Anti-Ban & Compliance</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Daily Message Limit (per instance)</label>
            <input
              type="number"
              value={dailyLimit}
              onChange={(e) => setDailyLimit(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Recommended: 200–300 for aged numbers, 50–100 for new numbers.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-muted-foreground mb-1.5">Auto-Blacklist Keywords</label>
            <input
              type="text"
              value={optOutKeywords}
              onChange={(e) => setOptOutKeywords(e.target.value)}
              className="w-full bg-secondary/50 border border-border/50 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary focus:outline-none transition-all"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Comma-separated. Any incoming message matching these is auto-blacklisted.
            </p>
          </div>
        </div>
      </div>

      {/* Database Info */}
      <div className="glass-panel rounded-2xl p-6 space-y-5">
        <div className="flex items-center gap-3 border-b border-border/50 pb-4">
          <Database className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">Infrastructure</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-secondary/30 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">PostgreSQL</p>
            <p className="text-sm font-medium">Supabase (PgBouncer)</p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Redis Queue</p>
            <p className="text-sm font-medium">Railway (BullMQ)</p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Analytics</p>
            <p className="text-sm font-medium">ClickHouse</p>
          </div>
          <div className="p-4 bg-secondary/30 rounded-xl">
            <p className="text-xs text-muted-foreground mb-1">Evolution API</p>
            <p className="text-sm font-medium">Multi-Pod (Railway)</p>
          </div>
        </div>
      </div>

      {/* Save */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full bg-gradient-to-r from-primary to-purple-600 text-white py-4 rounded-xl font-bold shadow-xl shadow-primary/25 flex items-center justify-center gap-2"
      >
        <Save className="w-5 h-5" />
        Save Settings
      </motion.button>
    </motion.div>
  );
}
