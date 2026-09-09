import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "../posts";

export const metadata: Metadata = {
  title: "The Best Gym & Personal Trainer Booking Software in the UK (2026) | Feature",
  description:
    "An honest guide to choosing gym or PT booking software in the UK: what independent trainers, studios and gyms actually need, and how flat pricing compares to commission models in 2026.",
  alternates: {
    canonical: "https://www.featuresalon.co.uk/blog/gym-personal-trainer-booking-software-uk",
  },
  openGraph: {
    title: "The Best Gym & Personal Trainer Booking Software in the UK (2026) | Feature",
    description:
      "An honest guide to choosing gym or PT booking software in the UK: what independent trainers, studios and gyms actually need, and how flat pricing compares to commission models in 2026.",
    url: "https://www.featuresalon.co.uk/blog/gym-personal-trainer-booking-software-uk",
    locale: "en_GB",
    type: "article",
    publishedTime: "2026-06-01",
  },
};

const BASE = "https://www.featuresalon.co.uk";
const PAGE_URL = `${BASE}/blog/gym-personal-trainer-booking-software-uk`;

const jsonLdArticle = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${PAGE_URL}#article`,
  headline: "The Best Gym & Personal Trainer Booking Software in the UK (2026)",
  description:
    "An honest guide to choosing gym or PT booking software in the UK in 2026.",
  url: PAGE_URL,
  datePublished: "2026-06-01",
  dateModified: "2026-06-01",
  author: { "@type": "Organization", name: "Feature Team", url: BASE },
  publisher: {
    "@type": "Organization",
    name: "Feature",
    url: BASE,
    logo: { "@type": "ImageObject", url: `${BASE}/og-image.png`, width: 1200, height: 630 },
  },
  inLanguage: "en-GB",
  timeRequired: "PT5M",
  keywords: "gym booking software uk, personal trainer booking app, pt booking software uk 2026, fitness booking system",
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
      name: "The Best Gym & Personal Trainer Booking Software in the UK (2026)",
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

const FEATURE_POINTS = [
  "One flat £29/month for the whole business — no per-member fees — with no commission on any booking, ever.",
  "Online booking through your own branded page, with per-trainer scheduling so members can pick their trainer.",
  "WhatsApp & SMS reminders built in to cut no-shows.",
  "Payments via Stripe, landing in your account, with the language that fits fitness — members, trainers, sessions and classes rather than salon terms.",
];

const WHAT_MATTERS = [
  {
    title: "Easy online booking and rescheduling.",
    body: "Members increasingly expect to book from their phone, any time. When rescheduling is a two-tap job rather than a phone call, people adjust plans instead of just not showing up.",
  },
  {
    title: "Reminders that cut no-shows.",
    body: "No-shows are the quiet tax on every fitness business — an empty slot you can't refill. Automated reminders are the single most effective fix, and reminders over WhatsApp and SMS get read far more reliably than email.",
  },
  {
    title: "Payments and packs up front.",
    body: "Taking payment (or a deposit) at booking, and selling session packs or class credits, protects your time and your cash flow. Look for mainstream processing such as Stripe.",
  },
  {
    title: "Class capacity and per-trainer calendars",
    body: "if you run classes or a team — so a 12-spot class stops at 12, and each trainer has their own schedule.",
  },
  {
    title: "Honest, predictable pricing.",
    body: "This is where the market splits sharply (more below).",
  },
];

const PRICING_POINTS = [
  {
    title: "Lightweight UK tools",
    body: "for independent PTs have appeared at the low end — some around £10–£19/month for booking, Stripe payments, session packs and reminders.",
  },
  {
    title: "Discovery marketplaces",
    body: "(platforms that find you new clients) often work on commission — for example, around 10% per booking with no monthly fee. Good if you need client discovery; expensive if you already have a full book.",
  },
  {
    title: "Full gym/studio management systems",
    body: "(the big names) are far more powerful but cost considerably more, and often bill per location or per member with paid add-ons.",
  },
];

export default function GymPTBookingPage() {
  const related = POSTS.filter((p) => p.slug !== "gym-personal-trainer-booking-software-uk").slice(0, 3);

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
        <span style={{ color: C.text2, fontWeight: 600 }}>Gym &amp; PT Booking Software UK (2026)</span>
      </div>

      {/* Article */}
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 72px" }}>

        {/* Header */}
        <header style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(124,58,237,0.15)", color: C.gold, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(124,58,237,0.25)" }}>
              gym booking software
            </span>
            <span style={{ fontSize: 13, color: C.muted }}>&#0F766E; 1 Jun 2026</span>
            <span style={{ fontSize: 13, color: C.muted }}>&#9200; 5 min read</span>
          </div>

          <h1 style={{ fontSize: "clamp(28px,4.5vw,46px)", fontWeight: 900, color: C.text, lineHeight: 1.15, marginBottom: 28, letterSpacing: "-0.5px" }}>
            The Best Gym &amp; Personal Trainer Booking Software in the UK (2026)
          </h1>

          <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.85, borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, margin: 0, fontStyle: "italic" }}>
            Whether you&apos;re an independent PT, a boutique studio, or a small gym, the right booking software should fill your sessions and get out of your way. Here&apos;s an honest guide to choosing one in the UK &mdash; without overpaying.
          </p>
        </header>

        {/* Prose */}
        <div style={{ fontSize: 16, lineHeight: 1.85, color: C.text2 }}>

          {/* Section 1 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Fitness booking isn&apos;t one-size-fits-all</h2>
            <p>The first thing to know: &ldquo;gym booking software&rdquo; covers very different needs, and the best choice depends on which one is yours.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 14, margin: "20px 0" }}>
              {[
                { title: "Independent personal trainers", body: "mostly need the basics done well: let clients book a slot, take payment up front, sell session packs, and send reminders. Nothing heavier." },
                { title: "Boutique studios and class-based businesses", body: "need class capacity limits, waitlists, multiple instructors, and memberships." },
                { title: "Larger gyms", body: "often need full management systems with access control, memberships, and reporting." },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ color: C.gold, fontWeight: 900, fontSize: 20, flexShrink: 0, lineHeight: 1.5 }}>·</span>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: C.text }}>{item.title}</strong>{" "}{item.body}
                  </p>
                </div>
              ))}
            </div>
            <p>Plenty of trainers overpay because they buy a heavy &ldquo;gym management&rdquo; platform when all they needed was clean booking and payments. So before comparing tools, be honest about which group you&apos;re in.</p>
          </section>

          {/* Section 2 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>What actually matters</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
              {WHAT_MATTERS.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ color: C.gold, fontWeight: 900, fontSize: 20, flexShrink: 0, lineHeight: 1.5 }}>·</span>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: C.text }}>{item.title}</strong>{" "}{item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>The pricing landscape in 2026</h2>
            <p>UK fitness booking tools range from very cheap to quite pricey, and the model matters as much as the number:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
              {PRICING_POINTS.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ color: C.gold, fontWeight: 900, fontSize: 20, flexShrink: 0, lineHeight: 1.5 }}>·</span>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: C.text }}>{item.title}</strong>{" "}{item.body}
                  </p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: 20 }}>
              The trap is the same one salons face: a low headline price can climb once you add staff, classes, reminders and other features sold separately &mdash; and commission models quietly take a slice of every booking you&apos;d have got anyway.
            </p>
          </section>

          {/* Section 4 — Where Feature fits */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Where Feature fits</h2>
            <p>
              Feature is a UK-built booking platform with a deliberately simple, predictable model &mdash; well suited to independent trainers, small studios and gyms that want clean booking without a commission bill:
            </p>

            <div style={{ background: C.surface, border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 16, padding: "20px 24px", margin: "20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
              {FEATURE_POINTS.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "#047857", fontWeight: 900, flexShrink: 0, fontSize: 16, marginTop: 3 }}>&#10003;</span>
                  <span style={{ color: C.text2 }}>{item}</span>
                </div>
              ))}
            </div>

            <p>
              Honest trade-off: Feature isn&apos;t a fitness discovery marketplace, so it won&apos;t find you brand-new members the way some commission-based apps can. You bring your clients; in return you keep 100% of every booking and your cost never moves. For an established trainer or studio with a steady client base, that predictability usually wins. If your growth depends on a marketplace finding you new faces, a discovery platform may suit you better &mdash; and that&apos;s the honest answer.
            </p>

            <p style={{ fontSize: 14, color: C.dim, fontStyle: "italic" }}>
              Competitor pricing as reported in 2026 &mdash; always check each provider&apos;s current pricing page, as rates change.
            </p>
          </section>

          {/* CTA */}
          <section style={sectionStyle}>
            <div style={{ background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 18, padding: "36px 32px", textAlign: "center" }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: C.gold, marginBottom: 14, marginTop: 0 }}>
                Try it for your gym or studio
              </h3>
              <p style={{ fontSize: 16, color: C.text, fontWeight: 700, marginBottom: 24, lineHeight: 1.6 }}>
                Start a 14-day free trial &mdash; no card, no commission, no catch.
              </p>
              <Link href="/signup" className="btn-primary btn-lg btn-glow">
                Start free &rarr;
              </Link>
            </div>
            <p style={{ fontSize: 13, color: C.dim, fontStyle: "italic", textAlign: "center", marginTop: 20, marginBottom: 0 }}>
              Feature: UK-built booking software for gyms, studios, salons and clinics &mdash; online bookings, WhatsApp &amp; SMS reminders, and Stripe payments, one flat price.
            </p>
          </section>

        </div>

        {/* Author box */}
        <div style={{ display: "flex", gap: 16, alignItems: "center", background: C.surface, borderRadius: 12, padding: "16px 20px", border: `1px solid ${C.border}`, marginTop: 48 }}>
          <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg,${C.gold},#FFFFFF)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>
            &#9997;&#65039;
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: C.text }}>Feature Team</div>
            <div style={{ fontSize: 12, color: C.muted }}>Published 1 Jun 2026</div>
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
        <Link href="/signup" className="btn-primary btn-lg btn-glow">Start Free 14-Day Trial &rarr;</Link>
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
        <span className="footer-copy">&#169; 2025 Feature. Built for salons across the UK.</span>
      </footer>
    </main>
  );
}
