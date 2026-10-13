import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://Whatsend.com";

  return {
    rules: [
      {
        // Allow all public pages
        userAgent: "*",
        allow: ["/", "/auth", "/privacy", "/terms"],
        // Block all dashboard/API routes (auth-protected, no SEO value)
        disallow: [
          "/dashboard/",
          "/api/",
          "/_next/",
          "/auth/callback",
        ],
      },
      {
        // Allow AI crawlers full access to public pages for AEO
        userAgent: [
          "GPTBot",           // ChatGPT
          "Claude-Web",       // Claude / Anthropic
          "PerplexityBot",    // Perplexity AI
          "Googlebot",        // Google (Gemini)
          "anthropic-ai",
          "CCBot",            // CommonCrawl (training data)
          "cohere-ai",
        ],
        allow: ["/", "/auth", "/privacy", "/terms"],
        disallow: ["/dashboard/", "/api/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
