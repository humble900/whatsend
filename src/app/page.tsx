import "./landing.css";
import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BarChart3, ChevronDown, FileUp, Layers3, MessageCircle, Send, Users } from "lucide-react";
import CampaignPreview from "./campaign-preview";
import s from "./landing-styles";

export const metadata: Metadata = {
  title: "Whatsend — Reach customers. Make sales on WhatsApp.",
  description: "Send offers and product updates to your customer list on WhatsApp. Personalize messages, track delivery, and reply to interested buyers in one place.",
};

const features = [
  { icon: Users, title: "Choose your customers", text: "Upload your contact list from a CSV. Group customers into lists and choose who receives each offer." },
  { icon: MessageCircle, title: "Send a relevant offer", text: "Add customer names and details to your messages. Write different versions to test your sales copy." },
  { icon: BarChart3, title: "Track your campaign", text: "See which messages were sent, delivered, and read. Use the results to plan your next campaign." },
  { icon: Layers3, title: "Manage your numbers", text: "Connect multiple WhatsApp numbers and run your campaigns from one dashboard." },
];

const steps = [
  { icon: Send, title: "Connect WhatsApp", text: "Link your WhatsApp number from the dashboard." },
  { icon: FileUp, title: "Add your list and offer", text: "Import customers who have opted in. Write your offer and add contact details to personalize it." },
  { icon: MessageCircle, title: "Send and handle replies", text: "Launch your campaign, check delivery, and answer buyers’ questions in the inbox." },
];

const faqs = [
  ["What can I use Whatsend for?", "Send promotions, announce new products, invite customers to events, and share business updates on WhatsApp. Manage the replies from your connected numbers in one inbox."],
  ["Can I import my customer list?", "Yes. Upload a CSV file and organize your contacts into lists. Send campaigns only to customers who have agreed to receive messages from your business."],
  ["Can I add customer names to messages?", "Yes. Use variables from your contact data to include a customer’s name and other details. Whatsend fills them in for each recipient."],
  ["Can customers reply to my campaigns?", "Yes. Replies from your connected numbers appear in your inbox. You can answer questions and help customers decide what to buy."],
  ["Does Whatsend guarantee delivery?", "No. Delivery and account access depend on WhatsApp, your connection, and how you use the platform. Follow WhatsApp’s policies and send relevant messages to customers who have opted in."],
];

function Brand() {
  return (
    <Link href="/" className={s.brand} aria-label="Whatsend home">
      <span className="ws-ogLogo" aria-hidden="true">
        {/* Use the canonical Whatsend brand mark. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/icon.svg" alt="" width={32} height={32} />
      </span>
      Whatsend
    </Link>
  );
}

export default function LandingPage() {
  return (
    <div className={s.page}>
      <a className={s.skip} href="#main">Skip to content</a>
      <header className={s.header}>
        <div className={s.nav}>
          <Brand />
          <nav className={s.navLinks} aria-label="Main navigation">
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#faq">FAQs</a>
          </nav>
          <div className={s.navActions}>
            <Link href="/auth" className={s.login}>Log in</Link>
            <Link href="/auth" className="ws-headerStart">Get started</Link>
          </div>
        </div>
      </header>
      <main id="main">
        <section className={s.hero}>
          <div>
            <h1>Reach customers.<br /><span>Make sales on WhatsApp.</span></h1>
            <p className={s.heroText}>Send offers and product updates to your customer list. Personalize each message, track delivery, and reply to interested buyers in one place.</p>
            <div className={s.heroActions}>
              <Link href="/auth" className={s.primary}>Get started <ArrowRight size={18} /></Link>
              <a href="#how-it-works" className={s.secondary}>How it works</a>
            </div>
          </div>
          <CampaignPreview />
        </section>
        <section id="features" className={s.section}>
          <div className={s.sectionHeading}>
            <div><h2>Send your offer to<br />the customers you want to reach.</h2></div>
            <p>Manage your contact lists, messages,<br />and campaign results in one place.</p>
          </div>
          <div className={s.featureGrid}>
            {features.map(({ icon: Icon, title, text }) => (
              <article key={title} className={s.feature}>
                <div className={s.featureTop}><Icon size={25} /></div>
                <h3>{title}</h3><p>{text}</p>
              </article>
            ))}
          </div>
          <div className={s.inboxBanner}>
            <div><h3>Reply while customers are interested.</h3><p>Answer questions about your offer, share product details, and help buyers take the next step. Handle replies from your connected numbers in one inbox.</p></div>
            <Link href="/auth">Get started <ArrowRight size={18} /></Link>
          </div>
        </section>
        <section id="how-it-works" className={s.workflow}>
          <div className={s.section}>
            <div className={s.sectionHeading}><div><h2>How to send your first campaign</h2></div></div>
            <div className={s.steps}>
              {steps.map(({ title, text }, i) => (
                <article key={title}><div className={s.stepNumber}><span>0{i + 1}</span></div><h3>{title}</h3><p>{text}</p></article>
              ))}
            </div>
          </div>
        </section>
        <section id="faq" className={`${s.section} ${s.faq}`}>
          <div><h2>Questions about Whatsend</h2></div>
          <div className={s.questions}>
            {faqs.map(([question, answer]) => (
              <details key={question}><summary>{question}<ChevronDown size={19} /></summary><p>{answer}</p></details>
            ))}
          </div>
        </section>
        <section className={s.finalCta}>
          <div><h2>Send your next offer on WhatsApp.</h2><p>Reach your customer list and manage the replies with Whatsend.</p><Link href="/auth" className={s.primary}>Get started <ArrowRight size={18} /></Link></div>
        </section>
      </main>
      <footer className={s.footer}>
        <div><Brand /><p>WhatsApp campaigns for your business.</p></div>
        <nav aria-label="Footer navigation"><a href="#features">Features</a><a href="#faq">FAQs</a><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link></nav>
        <p>© 2026 Whatsend</p>
      </footer>
    </div>
  );
}
