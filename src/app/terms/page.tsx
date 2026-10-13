import Link from "next/link";

export const metadata = {
  title: "Terms of Service | Whatsend",
  description: "Whatsend Terms of Service — rules and conditions for using our WhatsApp outreach platform.",
};

export default function TermsPage() {
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
        <h1 className="text-4xl font-bold text-white mb-2">Terms of Service</h1>
        <p className="text-zinc-500 mb-12">Last updated: October 10, 2026</p>

        <div className="space-y-8 text-zinc-400 leading-relaxed">
          <section>
            <h2 className="text-xl font-semibold text-white mb-3">1. Acceptance of Terms</h2>
            <p>
              By accessing or using WhatsEnd (&quot;the Service&quot;), you agree to be bound by these Terms of Service. 
              If you do not agree to all the terms and conditions, you may not access or use the Service. 
              These terms apply to all visitors, users, and others who access or use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">2. Description of Service</h2>
            <p>
              WhatsEnd is a WhatsApp outreach and communication platform that enables businesses to send 
              messages at scale using the WhatsApp Business API and third-party integration services. 
              The Service includes campaign management, contact management, analytics, and multi-instance 
              WhatsApp session handling.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">3. User Accounts</h2>
            <p>
              You must provide accurate, complete, and current information when creating an account. 
              You are responsible for safeguarding the password and for all activities that occur under 
              your account. You agree to notify us immediately of any unauthorized use of your account.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">4. Acceptable Use Policy</h2>
            <p className="mb-3">You agree NOT to use the Service to:</p>
            <ul className="list-disc list-inside space-y-2 ml-2">
              <li>Send unsolicited messages (spam) or violate anti-spam laws (CAN-SPAM, GDPR, etc.)</li>
              <li>Harass, threaten, or abuse any individual or group</li>
              <li>Distribute malware, phishing links, or fraudulent content</li>
              <li>Violate WhatsApp&apos;s Terms of Service or Community Guidelines</li>
              <li>Impersonate any person, business, or entity</li>
              <li>Engage in any activity that is illegal under applicable law</li>
              <li>Attempt to circumvent WhatsApp&apos;s security or rate-limiting measures in a manner that violates their policies</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">5. Message Compliance</h2>
            <p>
              You are solely responsible for the content of messages sent through the Service. All messages 
              must comply with applicable laws, including but not limited to data protection regulations (GDPR, 
              CCPA), telecommunications regulations, and consumer protection laws. You must obtain proper consent 
              from recipients before sending any messages and honor all opt-out requests immediately.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">6. Data Ownership</h2>
            <p>
              You retain all rights to your data, including contact lists, message templates, and campaign 
              analytics. We do not sell, rent, or share your data with third parties except as required 
              to provide the Service or as required by law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">7. Service Availability</h2>
            <p>
              We strive to maintain 99.9% uptime but do not guarantee uninterrupted access. The Service 
              may be temporarily unavailable for maintenance, updates, or circumstances beyond our control. 
              We are not liable for any damages resulting from service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">8. Limitation of Liability</h2>
            <p>
              To the maximum extent permitted by law, WhatsEnd shall not be liable for any indirect, 
              incidental, special, consequential, or punitive damages, including but not limited to loss 
              of profits, data, or business opportunities, arising out of or in connection with your use 
              of the Service. Our total liability shall not exceed the amount paid by you in the 12 months 
              preceding the claim.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">9. Account Termination</h2>
            <p>
              We reserve the right to suspend or terminate your account at any time if we reasonably believe 
              you have violated these Terms, engaged in fraudulent activity, or used the Service in a manner 
              that could harm other users or our infrastructure. You may also terminate your account at any 
              time by contacting our support team.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">10. Changes to Terms</h2>
            <p>
              We reserve the right to modify these Terms at any time. We will notify users of material 
              changes via email or through the Service. Your continued use of the Service after such 
              modifications constitutes your acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-white mb-3">11. Contact Us</h2>
            <p>
              If you have questions about these Terms, please contact us at{" "}
              <a href="mailto:support@whatsend.io" className="text-[#25D366] hover:underline">
                support@whatsend.io
              </a>.
            </p>
          </section>
        </div>

        <div className="mt-16 pt-8 border-t border-white/5 flex items-center justify-between text-sm text-zinc-600">
          <p>&copy; 2026 WhatsEnd. All rights reserved.</p>
          <Link href="/privacy" className="text-zinc-400 hover:text-white transition-colors">
            Privacy Policy →
          </Link>
        </div>
      </main>
    </div>
  );
}
