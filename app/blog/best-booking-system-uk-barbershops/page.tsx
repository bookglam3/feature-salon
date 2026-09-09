import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "../posts";

export const metadata: Metadata = {
  title: "The Best Booking System for UK Barbershops (2026) | Feature",
  description:
    "An honest guide to choosing barbershop booking software in the UK: per-barber calendars, walk-ins, deposits, reminders, and flat vs marketplace pricing.",
  alternates: {
    canonical: "https://www.featuresalon.co.uk/blog/best-booking-system-uk-barbershops",
  },
  openGraph: {
    title: "The Best Booking System for UK Barbershops (2026) | Feature",
    description:
      "An honest guide to choosing barbershop booking software in the UK: per-barber calendars, walk-ins, deposits, reminders, and flat vs marketplace pricing.",
    url: "https://www.featuresalon.co.uk/blog/best-booking-system-uk-barbershops",
    locale: "en_GB",
    type: "article",
    publishedTime: "2026-05-31",
  },
};

const BASE = "https://www.featuresalon.co.uk";
const PAGE_URL = `${BASE}/blog/best-booking-system-uk-barbershops`;

const jsonLdArticle = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${PAGE_URL}#article`,
  headline: "The Best Booking System for UK Barbershops in 2026",
  description:
    "An honest guide to choosing barbershop booking software in the UK: per-barber calendars, walk-ins, deposits, reminders, and flat vs marketplace pricing.",
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
  keywords: "barbershop booking system uk, barbershop software 2026, booking app barbershop, uk barber booking",
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
      name: "The Best Booking System for UK Barbershops (2026)",
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

const BARBERSHOP_NEEDS = [
  {
    title: "Per-barber booking and calendars.",
    body: "Clients should be able to pick their barber, and each barber should have their own calendar and their own numbers. If your software treats the shop as one blurry diary, it won't scale past a couple of chairs.",
  },
  {
    title: "Walk-in friendly.",
    body: "Plenty of barbershop trade still walks through the door. Good software handles both — online bookings and walk-ins — without forcing you to choose.",
  },
  {
    title: "Reminders that cut no-shows.",
    body: "Automated SMS and WhatsApp reminders are the single most effective way to keep chairs full. (More on no-shows in our separate guide.)",
  },
  {
    title: "Deposits and no-show protection.",
    body: "Increasingly common in UK barbershops, especially for longer services or repeat no-show clients. Being able to take a small deposit at booking protects your Saturday.",
  },
  {
    title: "Card payments and tips.",
    body: "Clients expect to tap a card. Look for proper, mainstream payment processing (e.g. via Stripe) rather than a closed wallet you can't get money out of quickly.",
  },
  {
    title: "Your data, your clients.",
    body: "Make sure you can export your client list and booking history any time, with no lock-in or exit fees — and that the platform is GDPR-friendly for the UK.",
  },
];

const FEATURE_POINTS = [
  "One flat £29/month for the whole shop — not per barber — with no commission on any booking, ever.",
  "Per-barber booking so clients pick their barber, and you see each chair clearly.",
  "WhatsApp & SMS reminders built in to cut no-shows.",
  "Card payments and deposits via Stripe, landing in your account.",
  "UK-built, GDPR-friendly, with your client data always exportable.",
];

export default function BarbershopBookingPage() {
  const related = POSTS.filter((p) => p.slug !== "best-booking-system-uk-barbershops").slice(0, 3);

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
        <span style={{ color: C.text2, fontWeight: 600 }}>The Best Booking System for UK Barbershops (2026)</span>
      </div>

      {/* Article */}
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 72px" }}>

        {/* Header */}
        <header style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(124,58,237,0.15)", color: C.gold, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(124,58,237,0.25)" }}>
              barbershop booking
            </span>
            <span style={{ fontSize: 13, color: C.muted }}>📅 31 May 2026</span>
            <span style={{ fontSize: 13, color: C.muted }}>⏱ 5 min read</span>
          </div>

          <h1 style={{ fontSize: "clamp(28px,4.5vw,46px)", fontWeight: 900, color: C.text, lineHeight: 1.15, marginBottom: 28, letterSpacing: "-0.5px" }}>
            The Best Booking System for UK Barbershops in 2026
          </h1>

          <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.85, borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, margin: 0, fontStyle: "italic" }}>
            Barbering has changed. Here&apos;s an honest guide to choosing booking software that fits how a UK barbershop actually runs — walk-ins, multiple chairs, deposits and all.
          </p>
        </header>

        {/* Prose */}
        <div style={{ fontSize: 16, lineHeight: 1.85, color: C.text2 }}>

          {/* Section 1 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Barbering isn&apos;t what it was — and your booking shouldn&apos;t be either</h2>
            <p>
              The UK men&apos;s grooming market is on track to hit around £1.3 billion by 2026, and barbershops have shifted from cash-in-hand, walk-in-only shops into modern, client-focused businesses with online booking, loyalty and branded digital experiences.
            </p>
            <p>
              That shift creates a specific problem: barbershops have needs most generic salon software wasn&apos;t built for. You&apos;re often juggling <strong style={{ color: C.text }}>walk-ins and booked appointments at the same time</strong>, tracking <strong style={{ color: C.text }}>several barbers&apos; takings separately</strong>, and offering fast, repeatable services — fades, beard trims, hot-towel shaves — where a no-show on a busy Saturday genuinely stings.
            </p>
            <p>
              So when you choose booking software, the question isn&apos;t &ldquo;which is most popular&rdquo; — it&apos;s &ldquo;which fits how my shop actually works.&rdquo;
            </p>
          </section>

          {/* Section 2 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>What a barbershop actually needs from booking software</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
              {BARBERSHOP_NEEDS.map((item, i) => (
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
            <h2 style={h2Style}>The honest bit: marketplace vs flat pricing</h2>
            <p>
              Here&apos;s where the big platforms differ most, and it matters for a barbershop&apos;s margins.
            </p>
            <p>
              Some platforms (like Booksy, around £40/month plus per-barber fees, or Fresha on its newer paid plans) run a <strong style={{ color: C.text }}>consumer marketplace</strong> — a client-facing app that can send you new customers, in exchange for a commission on those new bookings (Booksy&apos;s &ldquo;Boost&rdquo; takes 30% of a new client&apos;s first visit; Fresha takes 20% on new marketplace clients). If most of your growth comes from that marketplace, it can be worth it.
            </p>
            <p>
              But many barbershops grow through word of mouth, repeat regulars and their own Instagram — not a marketplace. If that&apos;s you, you may be paying commission for introductions you&apos;d have made anyway. In that case, a <strong style={{ color: C.text }}>flat-rate platform</strong> — one predictable monthly price, no cut of your bookings — usually works out better and far easier to budget.
            </p>
            <p>
              Per-barber pricing is the other thing to watch. A &ldquo;£27.50 for one barber&rdquo; headline can climb quickly once you add chairs and the add-ons (SMS, loyalty, marketing) that are often sold separately. Always work out the <em>all-in</em> monthly cost for your actual number of barbers before you commit.
            </p>
          </section>

          {/* Section 4 — Where Feature fits */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Where Feature fits</h2>
            <p>
              Feature is a UK-built booking platform with a deliberately simple model for barbershops that would rather have certainty than a commission bill:
            </p>

            <div style={{ background: C.surface, border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 16, padding: "20px 24px", margin: "20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
              {FEATURE_POINTS.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "#047857", fontWeight: 900, flexShrink: 0, fontSize: 16, marginTop: 3 }}>✓</span>
                  <span style={{ color: C.text2 }}>{item}</span>
                </div>
              ))}
            </div>

            <p>
              We&apos;ll be straight about the trade-off: Feature isn&apos;t a consumer marketplace, so it won&apos;t put your shop in front of strangers the way Booksy can. You bring your clients; in return, you keep 100% of what they spend and your cost never moves. For an established shop with a loyal chair, that&apos;s usually the better deal — but if marketplace discovery is your main growth engine, a marketplace platform may suit you better. That&apos;s the honest answer.
            </p>

            <p style={{ fontSize: 14, color: C.dim, fontStyle: "italic" }}>
              Competitor pricing as reported in 2026 — always check each provider&apos;s current pricing page, as rates change.
            </p>
          </section>

          {/* CTA section */}
          <section style={sectionStyle}>
            <div style={{ background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 18, padding: "36px 32px", textAlign: "center" }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: C.gold, marginBottom: 14, marginTop: 0 }}>
                Try it for your shop
              </h3>
              <p style={{ fontSize: 16, color: C.text, fontWeight: 700, marginBottom: 24, lineHeight: 1.6 }}>
                Start a 14-day free trial — no card, no commission, no catch.
              </p>
              <Link href="/signup" className="btn-primary btn-lg btn-glow">
                Start free →
              </Link>
              <p style={{ fontSize: 13, color: C.dim, fontStyle: "italic", marginTop: 20, marginBottom: 0 }}>
                Feature: UK-built booking software for barbershops, salons, gyms and clinics. Online bookings, WhatsApp &amp; SMS reminders, and Stripe payments — one flat price, zero commission.
              </p>
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
