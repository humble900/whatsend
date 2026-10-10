"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Send,
  Shield,
  Zap,
  BarChart3,
  Users,
  Globe,
  ArrowRight,
  CheckCircle2,
  Smartphone,
  MessageSquare,
  ChevronRight,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  }),
};

const features = [
  {
    icon: Shield,
    title: "Anti-Ban Engine",
    description:
      "1-to-1 proxy mapping, human-simulation typing delays, and Spintax message rotation keep every number safe.",
  },
  {
    icon: Zap,
    title: "BullMQ Parallel Dispatch",
    description:
      "Redis-backed job queues process thousands of messages concurrently with automatic retry and dead-letter handling.",
  },
  {
    icon: BarChart3,
    title: "Real-Time Analytics",
    description:
      "ClickHouse-powered dashboards track delivery, read receipts, and opt-outs the instant they happen.",
  },
  {
    icon: Users,
    title: "CSV Personalization",
    description:
      "Drag-and-drop your contact list and inject dynamic {{variables}} for hyper-personalized outreach at scale.",
  },
  {
    icon: Globe,
    title: "Multi-Instance Sharding",
    description:
      "Distribute load across unlimited Evolution API pods. Each number gets its own dedicated proxy and server.",
  },
  {
    icon: MessageSquare,
    title: "Unified Inbox",
    description:
      "Every reply from every number lands in one place. Auto-blacklist on STOP keywords for instant compliance.",
  },
];

const metrics = [
  { value: "10M+", label: "Messages Dispatched" },
  { value: "99.7%", label: "Delivery Rate" },
  { value: "<0.1%", label: "Ban Rate" },
  { value: "50ms", label: "Avg. Queue Latency" },
];

const steps = [
  {
    step: "01",
    title: "Connect Your Numbers",
    description:
      "Scan a QR code to link any WhatsApp number. We auto-assign a dedicated residential proxy.",
  },
  {
    step: "02",
    title: "Build Your Campaign",
    description:
      "Upload a CSV, write your Spintax template with {{variables}}, and set your dispatch schedule.",
  },
  {
    step: "03",
    title: "Launch & Monitor",
    description:
      "Hit launch. Our workers simulate human behavior while you watch delivery stats in real time.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-hidden">
      {/* ─── Navigation ─── */}
      <nav className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#2563eb] to-[#9333ea] flex items-center justify-center">
              <Send className="w-4 h-4 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">Watisale</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="hover:text-white transition-colors">
              How It Works
            </a>
            <a href="#metrics" className="hover:text-white transition-colors">
              Metrics
            </a>
          </div>
          <Link
            href="/dashboard"
            className="bg-white text-black px-4 py-2 sm:px-5 sm:py-2.5 rounded-full text-xs sm:text-sm font-semibold hover:bg-zinc-200 transition-colors"
          >
            Dashboard
          </Link>
        </div>
      </nav>

      {/* ─── Hero ─── */}
      <section className="relative pt-40 pb-32 px-6">
        {/* Gradient orbs */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[600px] pointer-events-none">
          <div className="absolute inset-0 bg-[#2563eb]/20 rounded-full blur-[128px]" />
          <div className="absolute top-32 left-32 w-[400px] h-[400px] bg-[#9333ea]/15 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 border border-white/10 rounded-full px-4 py-1.5 text-sm text-zinc-400 mb-8"
          >
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Enterprise-Grade WhatsApp Infrastructure
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="text-4xl sm:text-5xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-6 sm:mb-8"
          >
            Send millions.
            <br />
            <span className="bg-gradient-to-r from-[#2563eb] to-[#9333ea] bg-clip-text text-transparent">
              Ban zero.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-8 sm:mb-12 leading-relaxed px-2"
          >
            Watisale is the enterprise WhatsApp outreach engine that pairs
            anti-ban intelligence with high-concurrency dispatch — so you can
            reach every contact without risking a single number.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4"
          >
            <Link
              href="/dashboard/campaigns"
              className="group bg-gradient-to-r from-[#2563eb] to-[#9333ea] text-white px-8 py-4 rounded-full text-base font-semibold shadow-xl shadow-blue-500/20 hover:shadow-blue-500/30 transition-all flex items-center gap-2"
            >
              Start a Campaign
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#how-it-works"
              className="text-zinc-400 hover:text-white px-8 py-4 rounded-full border border-white/10 hover:border-white/20 transition-all text-base font-medium"
            >
              See How It Works
            </a>
          </motion.div>
        </div>

        {/* Dashboard preview */}
        <motion.div
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="relative z-10 max-w-5xl mx-auto mt-20"
        >
          <div className="bg-gradient-to-b from-zinc-800/60 to-zinc-900/60 border border-white/10 rounded-2xl p-1.5 shadow-2xl shadow-black/50">
            <div className="bg-[#0f0f11] rounded-xl overflow-hidden">
              {/* Fake browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <div className="flex-1 flex justify-center">
                  <div className="bg-white/5 rounded-md px-4 py-1 text-xs text-zinc-500 font-mono">
                    app.watisale.com/dashboard
                  </div>
                </div>
              </div>
              {/* Dashboard content mockup */}
              <div className="p-3 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4">
                {[
                  { label: "Active Instances", value: "24", color: "text-blue-400" },
                  { label: "Messages Sent", value: "142,891", color: "text-green-400" },
                  { label: "Delivery Rate", value: "99.7%", color: "text-purple-400" },
                  { label: "Queue Depth", value: "1,204", color: "text-orange-400" },
                ].map((stat) => (
                  <div
                    key={stat.label}
                    className="bg-white/[0.03] border border-white/5 rounded-xl p-3 sm:p-4"
                  >
                    <p className="text-[10px] sm:text-xs text-zinc-500 mb-1">{stat.label}</p>
                    <p className={`text-lg sm:text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  </div>
                ))}
                {/* Fake activity chart */}
                <div className="col-span-2 sm:col-span-3 bg-white/[0.03] border border-white/5 rounded-xl p-3 sm:p-4 h-24 sm:h-32">
                  <p className="text-[10px] sm:text-xs text-zinc-500 mb-2 sm:mb-3">Dispatch Activity (24h)</p>
                  <div className="flex items-end gap-0.5 sm:gap-1 h-12 sm:h-16">
                    {[40, 65, 45, 80, 55, 90, 70, 85, 60, 95, 75, 88, 50, 72, 82, 68, 92, 78, 84, 62, 76, 88, 94, 70].map(
                      (h, i) => (
                        <div
                          key={i}
                          className="flex-1 bg-gradient-to-t from-[#2563eb] to-[#9333ea] rounded-sm opacity-70"
                          style={{ height: `${h}%` }}
                        />
                      )
                    )}
                  </div>
                </div>
                {/* Fake recent messages */}
                <div className="col-span-2 sm:col-span-1 bg-white/[0.03] border border-white/5 rounded-xl p-3 sm:p-4 h-24 sm:h-32">
                  <p className="text-[10px] sm:text-xs text-zinc-500 mb-2 sm:mb-3">Live Feed</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    {["Delivered", "Delivered", "Read", "Delivered"].map((s, i) => (
                      <div key={i} className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs">
                        <div className={`w-1.5 h-1.5 rounded-full ${s === "Read" ? "bg-blue-400" : "bg-green-400"}`} />
                        <span className="text-zinc-500 font-mono">+44 ···· {3210 + i}</span>
                        <span className={`ml-auto ${s === "Read" ? "text-blue-400" : "text-green-400"}`}>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ─── Features ─── */}
      <section id="features" className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20"
          >
            <motion.p variants={fadeUp} custom={0} className="text-sm text-[#2563eb] font-semibold tracking-widest uppercase mb-4">
              Capabilities
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Everything you need to scale
            </motion.h2>
            <motion.p variants={fadeUp} custom={2} className="text-lg text-zinc-400 max-w-2xl mx-auto">
              From proxy allocation to real-time analytics, every layer is
              engineered for high-volume, low-risk WhatsApp outreach.
            </motion.p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial="hidden"
                  whileInView="visible"
                  viewport={{ once: true, margin: "-50px" }}
                  variants={fadeUp}
                  custom={i}
                  className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-all duration-300"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-[#2563eb]/5 to-[#9333ea]/5 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative z-10">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#2563eb]/20 to-[#9333ea]/20 flex items-center justify-center mb-5">
                      <Icon className="w-6 h-6 text-[#2563eb]" />
                    </div>
                    <h3 className="text-xl font-semibold mb-3">{feature.title}</h3>
                    <p className="text-zinc-400 leading-relaxed">{feature.description}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─── */}
      <section id="how-it-works" className="py-32 px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#2563eb]/[0.03] to-transparent pointer-events-none" />
        <div className="relative max-w-4xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="text-center mb-20"
          >
            <motion.p variants={fadeUp} custom={0} className="text-sm text-[#9333ea] font-semibold tracking-widest uppercase mb-4">
              Workflow
            </motion.p>
            <motion.h2 variants={fadeUp} custom={1} className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">
              Three steps. Zero friction.
            </motion.h2>
          </motion.div>

          <div className="space-y-12">
            {steps.map((step, i) => (
              <motion.div
                key={step.step}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true, margin: "-50px" }}
                variants={fadeUp}
                custom={i}
                className="flex items-start gap-8 group"
              >
                <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-gradient-to-br from-[#2563eb] to-[#9333ea] flex items-center justify-center text-2xl font-bold shadow-lg shadow-blue-500/20">
                  {step.step}
                </div>
                <div className="pt-1">
                  <h3 className="text-2xl font-semibold mb-2">{step.title}</h3>
                  <p className="text-zinc-400 text-lg leading-relaxed max-w-lg">
                    {step.description}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Metrics ─── */}
      <section id="metrics" className="py-32 px-6">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-100px" }}
            className="grid grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {metrics.map((metric, i) => (
              <motion.div
                key={metric.label}
                variants={fadeUp}
                custom={i}
                className="text-center p-8 bg-white/[0.03] border border-white/5 rounded-2xl"
              >
                <p className="text-4xl sm:text-5xl font-bold bg-gradient-to-r from-[#2563eb] to-[#9333ea] bg-clip-text text-transparent mb-3">
                  {metric.value}
                </p>
                <p className="text-sm text-zinc-400 font-medium">{metric.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="py-32 px-6 relative">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[#2563eb]/10 rounded-full blur-[128px]" />
        </div>
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="relative z-10 max-w-3xl mx-auto text-center"
        >
          <motion.h2
            variants={fadeUp}
            custom={0}
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-6"
          >
            Ready to send at scale?
          </motion.h2>
          <motion.p
            variants={fadeUp}
            custom={1}
            className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto"
          >
            Connect your first number in under 60 seconds. No credit card
            required to start.
          </motion.p>
          <motion.div variants={fadeUp} custom={2}>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-2 bg-gradient-to-r from-[#2563eb] to-[#9333ea] text-white px-10 py-5 rounded-full text-lg font-semibold shadow-2xl shadow-blue-500/20 hover:shadow-blue-500/30 transition-all"
            >
              Open Your Dashboard
              <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-white/5 py-12 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#2563eb] to-[#9333ea] flex items-center justify-center">
              <Send className="w-3 h-3 text-white" />
            </div>
            <span className="font-semibold">Watisale</span>
          </div>
          <div className="flex items-center gap-8 text-sm text-zinc-500">
            <a href="#features" className="hover:text-zinc-300 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-zinc-300 transition-colors">How It Works</a>
            <a href="#metrics" className="hover:text-zinc-300 transition-colors">Metrics</a>
          </div>
          <p className="text-sm text-zinc-600">
            &copy; 2026 Watisale. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
