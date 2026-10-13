// Metadata for /auth — server-side, not "use client"
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In — Whatsend",
  description: "Sign in to your Whatsend account to manage WhatsApp campaigns, contacts, and analytics.",
  robots: {
    index: false,    // Don't index auth pages
    follow: false,
  },
  openGraph: {
    title: "Sign In — Whatsend",
    description: "Access your WhatsApp marketing dashboard.",
    images: [{ url: "/og-image.jpg", width: 1200, height: 630 }],
  },
};

export { default } from "./page";
