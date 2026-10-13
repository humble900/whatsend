import Link from "next/link";

export const metadata = {
  title: "Privacy Policy | Whatsend",
  description: "Whatsend Privacy Policy — how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#09090b] text-zinc-300">
      {/* Nav */}
      <nav className="border-b border-white/5 bg-[#09090b]/80 backdrop-blur-xl">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link href="/" className="text-xl font-bold text-white tracking-tight hover:opacity-90 transition-opacity">
            Whatsend
          </Link>
          <Link href="/auth" className="text-sm text-zinc-400 hover:text-white transition-colors">
            Sign in
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-white mb-2">Privacy Policy</h1>
        <p className="text-zinc-500 mb-12">Last updated: October 10, 2026</p>

        <div className="space-y-8 text-zinc-400 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Introduction</h2>
            <p>
              WhatsEnd (&quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is committed to protecting your privacy. 
              This Privacy Policy explains how we collect, use, disclose, and safeguard your information 
              when you use our WhatsApp outreach platform. Please read this policy carefully.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Information We Collect</h2>
            
            <h3 className="text-lg font-medium text-zinc-200 mt-4 mb-2">2.1 Account Information</h3>
            <p>When you create an account, we collect:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>Name and email address (from Google OAuth or email registration)</li>
              <li>Profile picture (if provided via Google)</li>
              <li>Organization/company name</li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-200 mt-4 mb-2">2.2 Service Usage Data</h3>
            <p>When you use the Service, we collect:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>Contact lists you upload (phone numbers, names, custom variables)</li>
              <li>Message templates and campaign configurations</li>
              <li>Delivery status data (sent, delivered, read receipts)</li>
              <li>WhatsApp session metadata (connection status, instance IDs)</li>
            </ul>

            <h3 className="text-lg font-medium text-zinc-200 mt-4 mb-2">2.3 Automatically Collected Data</h3>
            <ul className="list-disc list-inside space-y-1 ml-2">
              <li>IP address and browser type</li>
              <li>Device information and operating system</li>
              <li>Usage patterns and feature interactions</li>
              <li>Log data and error reports</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <p className="mb-3">We use the information we collect to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process and deliver your messaging campaigns</li>
              <li>Monitor delivery analytics and provide reporting</li>
              <li>Authenticate your identity and secure your account</li>
              <li>Communicate with you about service updates and support</li>
              <li>Detect and prevent fraud, abuse, and security threats</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Data Storage & Security</h2>
            <p>
              Your data is stored in secure cloud infrastructure provided by Supabase (PostgreSQL) 
              and Railway. We implement industry-standard security measures including:
            </p>
            <ul className="list-disc list-inside space-y-1 mt-2 ml-2">
              <li>Encryption in transit (TLS/SSL) and at rest</li>
              <li>Row-Level Security (RLS) for tenant data isolation</li>
              <li>Regular security audits and vulnerability assessments</li>
              <li>Access controls with role-based permissions</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Data Sharing & Third Parties</h2>
            <p className="mb-3">We do NOT sell your personal data. We may share data with:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-zinc-200">Infrastructure Providers:</strong> Supabase (database), Railway (hosting), Redis (caching) — to operate the Service</li>
              <li><strong className="text-zinc-200">WhatsApp/Meta:</strong> Message content is transmitted through WhatsApp&apos;s servers as part of message delivery</li>
              <li><strong className="text-zinc-200">Legal Requirements:</strong> When required by law, subpoena, or court order</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Your Rights (GDPR & CCPA)</h2>
            <p className="mb-3">You have the right to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li><strong className="text-zinc-200">Access:</strong> Request a copy of all personal data we hold about you</li>
              <li><strong className="text-zinc-200">Rectify:</strong> Correct inaccurate or incomplete data</li>
              <li><strong className="text-zinc-200">Delete:</strong> Request deletion of your data (&quot;right to be forgotten&quot;)</li>
              <li><strong className="text-zinc-200">Portability:</strong> Export your data in a machine-readable format</li>
              <li><strong className="text-zinc-200">Restrict:</strong> Limit processing of your personal data</li>
              <li><strong className="text-zinc-200">Object:</strong> Opt out of certain data processing activities</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, contact us at{" "}
              <a href="mailto:privacy@whatsend.io" className="text-[#25D366] hover:underline">privacy@whatsend.io</a>.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Data Retention</h2>
            <p>
              We retain your data for as long as your account is active or as needed to provide the Service. 
              Campaign data (messages, delivery reports) is retained for 90 days after campaign completion 
              unless you request earlier deletion. Account data is deleted within 30 days of account termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Cookies & Tracking</h2>
            <p>
              We use essential cookies for authentication and session management. We do not use 
              third-party advertising trackers. Analytics cookies are only used for internal service 
              improvement and can be disabled in your browser settings.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Children&apos;s Privacy</h2>
            <p>
              The Service is not intended for individuals under the age of 18. We do not knowingly 
              collect personal information from children. If we discover that a child under 18 has 
              provided us with personal information, we will delete it immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Changes to This Policy</h2>
            <p>
              We may update this Privacy Policy periodically. We will notify you of material changes 
              via email or through the Service. The &quot;Last updated&quot; date at the top indicates the 
              most recent revision.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact Us</h2>
            <p>
              For privacy-related questions or concerns, contact our Data Protection team at{" "}
              <a href="mailto:privacy@whatsend.io" className="text-[#25D366] hover:underline">
                privacy@whatsend.io
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between text-sm text-zinc-600">
          <p>&copy; 2026 WhatsEnd. All rights reserved.</p>
          <Link href="/terms" className="text-zinc-400 hover:text-white transition-colors">
            Terms of Service →
          </Link>
        </div>
      </main>
    </div>
  );
}
