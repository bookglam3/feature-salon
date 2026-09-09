import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/app/components/icons/Icon";

export const metadata: Metadata = {
  title: "Salon Management Software for Birmingham Salons | Feature Salon",
  description:
    "Feature Salon helps Birmingham hair salons, beauty salons, and barbershops manage bookings, staff, and payments online. Free 14-day trial. Better than Fresha.",
  keywords: ["salon software birmingham", "birmingham salon booking system", "fresha alternative birmingham"],
  alternates: { canonical: "https://www.featuresalon.co.uk/salons/birmingham" },
  openGraph: {
    title: "Salon Management Software for Birmingham Salons | Feature Salon",
    description: "Feature Salon helps Birmingham salons manage bookings, staff, and payments. Free 14-day trial.",
    url: "https://www.featuresalon.co.uk/salons/birmingham",
    locale: "en_GB",
  },
};

export default function BirminghamPage() {
  return (
    <main className="landing">
      <nav className="nav">
        <Link href="/" className="nav-logo">feature</Link>
        <div className="nav-links">
          <Link href="/#features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup" className="btn-primary">Start free trial</Link>
        </div>
      </nav>

      <section className="hero">
        <div className="hero-badge" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Icon name="house" size={14} />
          BIRMINGHAM SALONS
        </div>
        <h1 className="hero-title">Salon Management Software for Birmingham Salons</h1>
        <p className="hero-sub">
          Birmingham&apos;s top hair and beauty salons rely on Feature to manage bookings, take online payments,
          and send automated reminders — all without Fresha&apos;s commission fees.
        </p>
        <div className="hero-btns">
          <Link href="/signup" className="btn-primary">Start free trial — no card needed</Link>
          <Link href="/pricing" className="btn-secondary">View pricing</Link>
        </div>
      </section>

      <section className="trust-bar">
        {["No commission fees", "Free 14-day trial", "Cancel anytime", "UK-based support"].map((item) => (
          <div key={item} className="trust-item"><div className="trust-dot" />{item}</div>
        ))}
      </section>

      <section className="section section-white">
        <div className="section-label">WHY BIRMINGHAM SALONS CHOOSE FEATURE</div>
        <h2 className="section-title">The smarter choice for Birmingham salons</h2>
        <div className="features-grid">
          {[
            { title: "Your own booking page", desc: "Get a beautiful, branded booking page that clients can find on Google, Instagram, and your website." },
            { title: "WhatsApp reminders", desc: "Send automatic appointment reminders via WhatsApp — the most effective way to reduce no-shows in the UK." },
            { title: "Zero commission model", desc: "Feature charges a simple flat fee starting at £29/month. No percentage taken from your bookings or payments." },
            { title: "Multi-location support", desc: "Running more than one salon in Birmingham? Feature supports multi-location management on our Business plan." },
            { title: "Client records & history", desc: "Keep detailed notes on every client — preferences, allergies, visit history — all in one place." },
            { title: "GDPR compliant", desc: "Feature is fully GDPR compliant, keeping your Birmingham salon and client data protected." },
          ].map((f) => (
            <div key={f.title} className="feature-card">
              <div className="feature-icon" />
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="section" style={{ textAlign: "center" }}>
        <h2 className="section-title">Be one of the first Birmingham salons on Feature</h2>
        <p className="hero-sub">No commission, no contracts, no marketplace fees — just straightforward software at a flat monthly price.</p>
        <div className="hero-btns" style={{ justifyContent: "center", marginTop: 24 }}>
          <Link href="/signup" className="btn-primary btn-lg">Start free 14-day trial →</Link>
        </div>
      </section>

      <section className="section section-white" style={{ textAlign: "center" }}>
        <h2 className="section-title">Ready to grow your Birmingham salon?</h2>
        <p className="hero-sub">Start your 14-day free trial today. No credit card required.</p>
        <div className="hero-btns" style={{ justifyContent: "center" }}>
          <Link href="/signup" className="btn-primary">Start free trial</Link>
          <Link href="/pricing" className="btn-secondary">View plans &amp; pricing</Link>
        </div>
      </section>

      <footer className="footer">
        <Link href="/" className="nav-logo footer-logo">feature</Link>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/salons/london">London</Link>
          <Link href="/salons/manchester">Manchester</Link>
          <Link href="/signup">Sign up</Link>
        </nav>
        <span className="footer-copy">© 2025 Feature. Built for salons across the UK.</span>
      </footer>
    </main>
  );
}
