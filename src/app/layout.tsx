import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// ─── Fonts ────────────────────────────────────────────────────────────────────
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

// ─── Site Constants ───────────────────────────────────────────────────────────
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://whatsend.com";
const SITE_NAME = "Whatsend";
const SITE_TITLE = "Whatsend";
const SITE_DESCRIPTION =
  "Reach customers, manage WhatsApp conversations, and schedule campaigns with delivery tracking.";
const OG_IMAGE = `${SITE_URL}/og-image.jpg`;

// ─── Viewport ─────────────────────────────────────────────────────────────────
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#25D366" },
    { media: "(prefers-color-scheme: dark)", color: "#075E54" },
  ],
  colorScheme: "light dark",
};

// ─── Root Metadata ────────────────────────────────────────────────────────────
export const metadata: Metadata = {
  // ── Core ──
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  authors: [{ name: "Whatsend Team", url: SITE_URL }],
  generator: "Next.js",
  keywords: [
    "WhatsApp bulk messaging",
    "WhatsApp marketing platform",
    "WhatsApp campaign software",
    "WhatsApp blast tool",
    "bulk WhatsApp sender",
    "WhatsApp API platform",
    "WhatsApp automation",
    "WhatsApp CRM",
    "Evolution API",
    "WhatsApp customer messaging",
    "mass WhatsApp messages",
    "WhatsApp business marketing",
  ],
  referrer: "origin-when-cross-origin",
  creator: "Whatsend",
  publisher: "Whatsend",
  category: "Technology",

  // ── Canonical & Alternates ──
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-US": SITE_URL,
    },
  },

  // ── Open Graph ────────────────────────────────────────────────────────────
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: "Whatsend — WhatsApp Marketing at Enterprise Scale",
        type: "image/jpeg",
      },
    ],
  },

  // ── Twitter / X Card ─────────────────────────────────────────────────────
  twitter: {
    card: "summary_large_image",
    site: "@Whatsend",
    creator: "@Whatsend",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      {
        url: OG_IMAGE,
        alt: "Whatsend — WhatsApp Marketing at Enterprise Scale",
      },
    ],
  },

  // ── Robots / Indexing ─────────────────────────────────────────────────────
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      noimageindex: false,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // ── Icons ─────────────────────────────────────────────────────────────────
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    shortcut: "/icon.svg",
  },

  // ── Manifest ──────────────────────────────────────────────────────────────
  manifest: "/manifest.json",

  // ── Verification (add your tokens when you have them) ─────────────────────
  // verification: {
  //   google: "YOUR_GOOGLE_SITE_VERIFICATION_TOKEN",
  //   yandex: "YOUR_YANDEX_TOKEN",
  // },

  // ── App-specific ──────────────────────────────────────────────────────────
  appleWebApp: {
    title: SITE_NAME,
    statusBarStyle: "black-translucent",
    capable: true,
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      dir="ltr"
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        {/* ── AEO: AI Engine Optimisation ──────────────────────────────── */}
        {/* Structured data for LLM/AI crawlers (ChatGPT, Perplexity, etc.) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "SoftwareApplication",
              name: SITE_NAME,
              url: SITE_URL,
              applicationCategory: "BusinessApplication",
              operatingSystem: "Web",
              description: SITE_DESCRIPTION,
              offers: {
                "@type": "Offer",
                price: "0",
                priceCurrency: "USD",
                availability: "https://schema.org/InStock",
              },
              featureList: [
                "WhatsApp bulk messaging",
                "Anti-ban protection",
                "Real-time campaign analytics",
                "A/B message testing",
                "Multi-instance sharding",
                "CSV contact import",
                "Spintax message variation",
                "Inbox & reply management",
              ],
              provider: {
                "@type": "Organization",
                name: SITE_NAME,
                url: SITE_URL,
                logo: {
                  "@type": "ImageObject",
                  url: `${SITE_URL}/og-image.jpg`,
                },
              },
            }),
          }}
        />
        {/* FAQ schema for AEO (AI snippet extraction) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: [
                {
                  "@type": "Question",
                  name: "What is Whatsend?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Whatsend helps businesses manage customer conversations and schedule opted-in WhatsApp campaigns with delivery tracking.",
                  },
                },
                {
                  "@type": "Question",
                  name: "How are campaign messages scheduled?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Campaign messages follow saved sending windows, timezones, pacing, and per-account campaign limits. Direct inbox replies bypass campaign scheduling. WhatsApp policies still apply.",
                  },
                },
                {
                  "@type": "Question",
                  name: "Does Whatsend support all countries?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Yes. Whatsend supports WhatsApp accounts from all countries worldwide. Connect via QR code scan or pairing code — no country restrictions.",
                  },
                },
                {
                  "@type": "Question",
                  name: "What message types can I send with Whatsend?",
                  acceptedAnswer: {
                    "@type": "Answer",
                    text: "Whatsend supports text messages with Spintax, images, videos, documents, polls, interactive buttons, list menus, location pins, and contact cards via the Evolution API.",
                  },
                },
              ],
            }),
          }}
        />
        {/* Breadcrumb/WebSite schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: SITE_NAME,
              url: SITE_URL,
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: `${SITE_URL}/search?q={search_term_string}`,
                },
                "query-input": "required name=search_term_string",
              },
            }),
          }}
        />

        {/* ── Preconnect to critical origins ───────────────────────────── */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://dtdusdehzbmbvtbjoiym.supabase.co" />
      </head>
      <body className="min-h-screen flex flex-col overflow-x-hidden bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
