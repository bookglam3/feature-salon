import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "../posts";

export const metadata: Metadata = {
  title: "How to Reduce No-Shows in Your Salon (2026) | Feature",
  description:
    "No-shows cost UK salons over £1bn a year. Learn the proven ways to cut them — WhatsApp/SMS reminders, deposits, clear policies and online booking.",
  alternates: {
    canonical: "https://www.featuresalon.co.uk/blog/how-to-reduce-salon-no-shows",
  },
  openGraph: {
    title: "How to Reduce No-Shows in Your Salon (2026) | Feature",
    description:
      "No-shows cost UK salons over £1bn a year. Learn the proven ways to cut them — WhatsApp/SMS reminders, deposits, clear policies and online booking.",
    url: "https://www.featuresalon.co.uk/blog/how-to-reduce-salon-no-shows",
    locale: "en_GB",
    type: "article",
    publishedTime: "2026-05-31",
  },
};

const BASE = "https://www.featuresalon.co.uk";
const PAGE_URL = `${BASE}/blog/how-to-reduce-salon-no-shows`;

const jsonLdArticle = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${PAGE_URL}#article`,
  headline: "How to Reduce No-Shows in Your Salon: A UK Owner's Guide (2026)",
  description:
    "No-shows cost UK salons over £1bn a year. Learn the proven ways to cut them — WhatsApp/SMS reminders, deposits, clear policies and online booking.",
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
  timeRequired: "PT5M",
  keywords: "salon no-shows, reduce no-shows salon, salon reminders uk, deposit salon booking",
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
      name: "How to Reduce No-Shows in Your Salon (2026)",
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

export default function ReduceNoShowsPage() {
  const related = POSTS.filter((p) => p.slug !== "how-to-reduce-salon-no-shows").slice(0, 3);

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
        <span style={{ color: C.text2, fontWeight: 600 }}>How to Reduce No-Shows in Your Salon (2026)</span>
      </div>

      {/* Article */}
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 72px" }}>

        {/* Header */}
        <header style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(124,58,237,0.15)", color: C.gold, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(124,58,237,0.25)" }}>
              salon no-shows
            </span>
            <span style={{ fontSize: 13, color: C.muted }}>📅 31 May 2026</span>
            <span style={{ fontSize: 13, color: C.muted }}>⏱ 5 min read</span>
          </div>

          <h1 style={{ fontSize: "clamp(28px,4.5vw,46px)", fontWeight: 900, color: C.text, lineHeight: 1.15, marginBottom: 28, letterSpacing: "-0.5px" }}>
            How to Reduce No-Shows in Your Salon: A UK Owner&apos;s Guide (2026)
          </h1>

          <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.85, borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, margin: 0, fontStyle: "italic" }}>
            No-shows are one of the quietest, costliest problems in any salon. The good news: a few simple changes can cut them dramatically. Here&apos;s what actually works — backed by UK industry data.
          </p>
        </header>

        {/* Prose */}
        <div style={{ fontSize: 16, lineHeight: 1.85, color: C.text2 }}>

          {/* Section 1 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Why no-shows hurt more than they look</h2>
            <p>
              When a client doesn&apos;t turn up, you don&apos;t just lose that booking — you lose a slot you could have given to someone else, and the time your chair sat empty is gone for good. It adds up fast.
            </p>
            <p>
              The numbers tell the story. Across the UK beauty and salon industry, no-shows are estimated to cost businesses well over £1 billion a year, with each missed appointment averaging around £39 in lost revenue (Scratch Magazine). Industry no-show rates typically sit somewhere between 10% and 20% of appointments — that&apos;s potentially one in five chairs sitting empty when it shouldn&apos;t be.
            </p>
            <p>The encouraging part: this is one of the most fixable problems in your business.</p>
          </section>

          {/* Section 2 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>1. Send reminders clients actually read</h2>
            <p>
              Most no-shows aren&apos;t clients deciding not to come — they simply forget. A good reminder fixes that.
            </p>
            <p>
              But the channel matters. Email reminders are standard, yet plenty of clients never open them. Research consistently shows automated reminders cut no-shows meaningfully — online appointment reminders have been found to reduce no-shows by around 29%, and SMS reminders improve attendance significantly compared to no reminder at all.
            </p>
            <p>
              The single biggest upgrade most salons can make is reminding clients somewhere they&apos;ll definitely see it: <strong style={{ color: C.text }}>WhatsApp and SMS.</strong> People read their texts and WhatsApp messages within minutes; emails can sit unopened for days. A reminder 48 hours before (enough time to rebook the slot if they cancel) plus one on the morning of the appointment is a simple, effective rhythm.
            </p>
          </section>

          {/* Section 3 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>2. Take a small deposit on higher-value bookings</h2>
            <p>
              This is the most powerful lever of all. When a client has put money down, they&apos;re far more likely to show up — research shows salons that take deposits see no-shows drop by roughly 29%, and in some cases far more.
            </p>
            <p>
              You don&apos;t need to charge the full price. Even a small deposit — say 10–20% of the service — creates enough commitment to make a real difference, without scaring clients away. Many owners apply deposits only to longer or higher-value treatments, or to clients with a history of missing appointments.
            </p>
            <p>
              A nice side effect: clients who&apos;ve paid a deposit often spend a little more overall, because the final bill feels smaller.
            </p>
          </section>

          {/* Section 4 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>3. Make your policy clear — and visible</h2>
            <p>
              A cancellation policy only works if clients know about it before they book. Put it where they&apos;ll see it: on your booking page, in the confirmation message, and in reminders. Something simple like &ldquo;Please give us 24 hours&apos; notice to cancel or reschedule&rdquo; sets a fair expectation without feeling harsh.
            </p>
            <p>
              The goal isn&apos;t to punish people — it&apos;s to gently signal that your time has value, which on its own nudges behaviour.
            </p>
          </section>

          {/* Section 5 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>4. Let clients book (and rebook) online</h2>
            <p>
              It might sound counterintuitive, but clients who book online tend to miss fewer appointments than those who book by phone or in person — partly because they get an instant confirmation and automated reminders, and partly because rescheduling is easy. When changing an appointment is a two-tap job rather than an awkward phone call, clients reschedule instead of simply not showing up.
            </p>
          </section>

          {/* Section 6 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>5. Fill the gap when someone does cancel</h2>
            <p>
              No system gets you to zero no-shows. So have a plan for the empty slot: a waitlist of clients who&apos;d happily come in sooner, or a quick message to regulars when a prime slot opens up. A cancellation that gets refilled costs you nothing.
            </p>
          </section>

          {/* Section 7 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Putting it together</h2>
            <p>
              The salons that beat no-shows rarely do just one thing. The combination that works is consistent: <strong style={{ color: C.text }}>online booking, automatic WhatsApp/SMS reminders, a clear cancellation policy, and deposits on higher-value treatments.</strong> Owners who put all of these in place often see their no-show rate fall by more than half.
            </p>
            <p>
              None of it requires a bigger team — just the right system doing the chasing for you.
            </p>
          </section>

          {/* Section 8 — How Feature helps */}
          <section style={sectionStyle}>
            <div style={{ background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 18, padding: "28px 28px" }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: C.gold, marginBottom: 14, marginTop: 0 }}>
                How Feature helps
              </h3>
              <p style={{ margin: "0 0 20px" }}>
                Feature is a UK-built booking platform designed around exactly this. Clients book online 24/7, get automatic <strong style={{ color: C.text }}>WhatsApp and SMS reminders</strong>, and you can take <strong style={{ color: C.text }}>deposits and payments via Stripe</strong> — all for one flat £29/month, with no commission on your bookings.
              </p>
              <p style={{ fontSize: 16, color: C.text, fontWeight: 700, marginBottom: 20, margin: "0 0 24px" }}>
                Start your 14-day free trial — no card, no commission, no catch.
              </p>
              <Link href="/signup" className="btn-primary btn-lg btn-glow">
                Start free →
              </Link>
            </div>
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
