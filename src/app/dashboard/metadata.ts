import type { Metadata } from "next";

// All dashboard routes: noindex (auth-protected, no SEO value)
// The template from root layout applies: "Page Name | Whatsend"
export const metadata: Metadata = {
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export { default } from "./layout";
