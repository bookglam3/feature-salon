import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "../posts";

export const metadata: Metadata = {
  title: "Salon Software with WhatsApp Reminders: Why It Matters (2026) | Feature",
  description:
    "Email reminders are easy to miss. Learn why WhatsApp reminders are quietly becoming the most important feature in salon booking software — and how to use them well.",
  alternates: {
    canonical: "https://www.featuresalon.co.uk/blog/salon-software-whatsapp-reminders",
  },
  openGraph: {
    title: "Salon Software with WhatsApp Reminders: Why It Matters (2026) | Feature",
    description:
      "Email reminders are easy to miss. Learn why WhatsApp reminders are quietly becoming the most important feature in salon booking software — and how to use them well.",
    url: "https://www.featuresalon.co.uk/blog/salon-software-whatsapp-reminders",
    locale: "en_GB",
    type: "article",
    publishedTime: "2026-05-31",
  },
};

const BASE = "https://www.featuresalon.co.uk";
const PAGE_URL = `${BASE}/blog/salon-software-whatsapp-reminders`;

const jsonLdArticle = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${PAGE_URL}#article`,
  headline: "Salon Software with WhatsApp Reminders: Why It Matters (2026)",
  description:
    "Email reminders are easy to miss. Learn why WhatsApp reminders are quietly becoming the most important feature in salon booking software — and how to use them well.",
  url: PAGE_URL,
  datePublished: "2026-05-31",
  dateModified: "2026-05-31",
  author: { "@type": "Organization", name: "Feature Team", url: BASE },
  publisher: {
    "@type": "Organization",
    name: "Feature",
    url: BASE,
    logo: { "@type": "ImageObject", url: `${BASE}/og-image.png`, width: 1200, height: 630 },
  },
  inLanguage: "en-GB",
  timeRequired: "PT4M",
  keywords: "salon software whatsapp reminders, whatsapp booking reminders uk, reduce no-shows salon, appointment reminders",
});

const jsonLdBreadcrumb = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Home", item: BASE },
    { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE}/blog` },
    {
      "@type": "ListItem",
      position: 3,
      name: "Salon Software with WhatsApp Reminders: Why It Matters (2026)",
      item: PAGE_URL,
    },
  ],
});

const C = {
  bg: "#FFFFFF",
  surface: "#F5F3FF",
  border: "#ECE9F1",
  text: "#12101A",
  text2: "#524D60",
  muted: "#6B6577",
  gold: "#7C3AED",
  dim: "#6B6577",
};

const h2Style: React.CSSProperties = {
  fontSize: "clamp(20px,3vw,26px)",
  fontWeight: 800,
  color: C.text,
  marginBottom: 16,
  paddingBottom: 12,
  borderBottom: `1.5px solid ${C.border}`,
  letterSpacing: "-0.3px",
};

const sectionStyle: React.CSSProperties = { marginBottom: 44 };

export default function WhatsAppRemindersPage() {
  const related = POSTS.filter((p) => p.slug !== "salon-software-whatsapp-reminders").slice(0, 3);

  return (
    <main className="landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdArticle }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdBreadcrumb }} />

      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="nav-logo">feature</Link>
        <div className="nav-links">
          <Link href="/#features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup" className="btn-primary">Start free trial</Link>
        </div>
        <Link href="/signup" className="btn-primary mobile-nav-cta">Start free trial</Link>
      </nav>

      {/* Breadcrumb */}
      <div style={{ padding: "12px 24px", maxWidth: 760, margin: "0 auto", fontSize: 13, color: C.muted }}>
        <Link href="/" style={{ color: C.gold, textDecoration: "none" }}>Home</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <Link href="/blog" style={{ color: C.gold, textDecoration: "none" }}>Blog</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: C.text2, fontWeight: 600 }}>Salon Software with WhatsApp Reminders (2026)</span>
      </div>

      {/* Article */}
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 72px" }}>

        {/* Header */}
        <header style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(124,58,237,0.15)", color: C.gold, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(124,58,237,0.25)" }}>
              whatsapp reminders
            </span>
            <span style={{ fontSize: 13, color: C.muted }}>📅 31 May 2026</span>
            <span style={{ fontSize: 13, color: C.muted }}>⏱ 4 min read</span>
          </div>

          <h1 style={{ fontSize: "clamp(28px,4.5vw,46px)", fontWeight: 900, color: C.text, lineHeight: 1.15, marginBottom: 28, letterSpacing: "-0.5px" }}>
            Salon Software with WhatsApp Reminders: Why It Matters (2026)
          </h1>

          <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.85, borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, margin: 0, fontStyle: "italic" }}>
            If your reminders are still going out by email, you&apos;re probably losing bookings you don&apos;t even know about. Here&apos;s why WhatsApp reminders are quietly becoming the most important feature in salon software — and how to use them well.
          </p>
        </header>

        {/* Prose */}
        <div style={{ fontSize: 16, lineHeight: 1.85, color: C.text2 }}>

          {/* Section 1 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>The reminder gap most salons don&apos;t notice</h2>
            <p>
              Almost every booking system can send a reminder. The question nobody asks is: <strong style={{ color: C.text }}>does the client actually see it?</strong>
            </p>
            <p>
              That&apos;s where most salons quietly lose money. Email reminders are the default in a lot of software — but inboxes are crowded, promotions folders swallow them, and plenty of clients simply never open them. The reminder goes out, the box gets ticked, and the client still forgets.
            </p>
            <p>
              The result is the no-show: an empty chair you can&apos;t sell twice. Across the UK, no-shows cost the beauty and salon industry well over £1 billion a year, with each missed appointment averaging around £39 in lost revenue. A reminder only protects that revenue if it&apos;s actually read.
            </p>
          </section>

          {/* Section 2 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Why WhatsApp changes the maths</h2>
            <p>
              People treat WhatsApp differently from email. Messages get opened within minutes, not days. For most UK clients, it&apos;s where they already talk to friends, family — and increasingly, their salon.
            </p>
            <p>
              That difference matters. Automated reminders are proven to cut no-shows — online and SMS reminders have been found to reduce missed appointments by around 29% compared to no reminder. The channel amplifies the effect: a reminder a client reads is worth far more than one that sits unopened. WhatsApp (and SMS) land where clients are looking, which is exactly why they outperform email for confirmations and reminders.
            </p>
            <p>
              There&apos;s a second benefit that&apos;s easy to miss: WhatsApp feels personal. A friendly, branded message (&ldquo;Hi Sarah, see you tomorrow at 2pm for your cut and colour 💇&rdquo;) feels like your salon, not a faceless system. That tone builds the kind of relationship that keeps clients coming back.
            </p>
          </section>

          {/* Section 3 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>What good WhatsApp reminders look like</h2>
            <p>
              You don&apos;t need to bombard people. A simple, well-timed rhythm does the work:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 16, margin: "20px 0" }}>
              {[
                { label: "Confirmation", body: "The moment they book — instant reassurance, and a written record they can find later." },
                { label: "Reminder around 48 hours before", body: "Far enough ahead that if they can't make it, you've got time to refill the slot." },
                { label: "Gentle nudge on the morning of the appointment", body: "The last, most effective catch for the genuinely forgetful." },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", background: C.surface, borderRadius: 12, padding: "16px 18px", border: `1px solid ${C.border}` }}>
                  <span style={{ color: C.gold, fontWeight: 900, fontSize: 20, flexShrink: 0, lineHeight: 1.5 }}>·</span>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: C.text }}>A {item.label}</strong> — {item.body}
                  </p>
                </div>
              ))}
            </div>
            <p>
              Keep the wording warm and clear: who, what, when, and an easy way to reschedule. The easier you make it to move an appointment, the fewer clients simply vanish.
            </p>
          </section>

          {/* Section 4 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Why most big platforms don&apos;t offer it</h2>
            <p>
              Here&apos;s the part that surprises owners: many of the best-known booking platforms still don&apos;t send reminders over WhatsApp. They lean on email and, sometimes, SMS. So if WhatsApp is where your clients actually are, your software may be missing the single most effective place to reach them.
            </p>
            <p>
              That gap is exactly why WhatsApp reminders have become a genuine point of difference in salon software — not a nice-to-have, but a feature that directly protects your daily revenue.
            </p>
          </section>

          {/* Section 5 — How Feature does it + CTA */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>How Feature does it</h2>
            <p>
              Feature is a UK-built booking platform with <strong style={{ color: C.text }}>WhatsApp and SMS reminders built in from day one</strong> — because reaching clients where they actually read is the whole point. Clients book online, get an instant confirmation, and receive automatic reminders before their appointment, all branded to your salon.
            </p>
            <p>
              And it&apos;s all on one flat price: <strong style={{ color: C.gold }}>£29/month, no commission on your bookings, ever.</strong>
            </p>

            <div style={{ background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 18, padding: "36px 32px", textAlign: "center", margin: "28px 0 20px" }}>
              <p style={{ fontSize: 17, color: C.text, fontWeight: 700, marginBottom: 24, lineHeight: 1.6 }}>
                Start your 14-day free trial — no card, no commission, no catch.
              </p>
              <Link href="/signup" className="btn-primary btn-lg btn-glow">
                Start free →
              </Link>
            </div>

            <p style={{ fontSize: 13, color: C.dim, fontStyle: "italic", textAlign: "center", margin: 0 }}>
              Feature: UK-built booking software for salons, barbershops, gyms and clinics — online bookings, WhatsApp &amp; SMS reminders, and Stripe payments, one flat price.
            </p>
          </section>

        </div>

        {/* Author box */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", background: C.surface, borderRadius: 12, padding: "16px 20px", border: `1px solid ${C.border}`, marginTop: 48 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg,${C.gold},#FFFFFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            ✍️
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Feature Team</div>
            <div style={{ fontSize: 12, color: C.muted }}>Published 31 May 2026</div>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {related.length > 0 && (
        <section style={{ maxWidth: 760, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: C.text, marginBottom: 24 }}>Related posts</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
            {related.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: "none" }}>
                <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 12, padding: "18px 16px", height: "100%" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: C.gold, marginBottom: 8 }}>
                    {p.readingTime} min read
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, lineHeight: 1.4 }}>{p.title}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Final CTA */}
      <section className="section final-cta">
        <h2 className="final-cta-title">Start your free trial today</h2>
        <p className="final-cta-sub">No credit card required. Full access for 14 days. UK-based support.</p>
        <Link href="/signup" className="btn-primary btn-lg btn-glow">Start Free 14-Day Trial →</Link>
        <div className="final-cta-trust">
          <span>No credit card required</span><span>·</span>
          <span>Cancel anytime</span><span>·</span>
          <span>UK support</span>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer">
        <Link href="/" className="nav-logo footer-logo">feature</Link>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/signup">Sign up</Link>
        </nav>
        <span className="footer-copy">© 2025 Feature. Built for salons across the UK.</span>
      </footer>
    </main>
  );
}
