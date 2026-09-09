import type { Metadata } from "next";
import Link from "next/link";

const bg      = "#FFFFFF";
const surface = "#F5F3FF";
const border  = "#ECE9F1";
const gold    = "#7C3AED";
const text    = "#12101A";
const text2   = "#524D60";
const muted   = "#6B6577";

export const metadata: Metadata = {
  title: "The Best Salon Booking Software in the UK (2026): An Honest Buyer's Guide | Feature",
  description: "There's no single 'best' salon software — only the best one for how your salon actually works. An honest guide to the main UK options in 2026 and how to choose without overpaying.",
  alternates: { canonical: "https://www.featuresalon.co.uk/blog/best-salon-booking-software-uk-2026" },
  openGraph: {
    title: "The Best Salon Booking Software in the UK (2026): An Honest Buyer's Guide | Feature",
    description: "An honest guide to the main UK salon booking software options in 2026 — and how to choose the right one without overpaying.",
    url: "https://www.featuresalon.co.uk/blog/best-salon-booking-software-uk-2026",
    locale: "en_GB",
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "The Best Salon Booking Software in the UK (2026): An Honest Buyer's Guide",
      "datePublished": "2026-06-01",
      "dateModified": "2026-06-01",
      "author": { "@type": "Organization", "name": "Feature Team" },
      "publisher": { "@type": "Organization", "name": "Feature", "url": "https://www.featuresalon.co.uk" },
      "url": "https://www.featuresalon.co.uk/blog/best-salon-booking-software-uk-2026",
      "description": "An honest guide to the main UK salon booking software options in 2026 — and how to choose the right one without overpaying.",
      "mainEntityOfPage": { "@type": "WebPage", "@id": "https://www.featuresalon.co.uk/blog/best-salon-booking-software-uk-2026" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.featuresalon.co.uk" },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.featuresalon.co.uk/blog" },
        { "@type": "ListItem", "position": 3, "name": "Best Salon Booking Software UK (2026)", "item": "https://www.featuresalon.co.uk/blog/best-salon-booking-software-uk-2026" },
      ],
    },
  ],
};

const th: React.CSSProperties = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: 13,
  fontWeight: 700,
  color: muted,
  letterSpacing: "0.5px",
  borderBottom: `1px solid ${border}`,
  whiteSpace: "nowrap",
};
const thGold: React.CSSProperties = { ...th, color: gold };

const td: React.CSSProperties = {
  padding: "13px 16px",
  fontSize: 14,
  color: text2,
  borderBottom: `1px solid ${border}`,
  verticalAlign: "top",
};
const tdGold: React.CSSProperties = { ...td, color: gold, fontWeight: 600 };

const rows: [string, string, string, string][] = [
  ["Monthly cost", "£29 flat (whole business)", "~£14.95 solo / ~£9.95 per member", "~£40 + ~£5 per member"],
  ["Commission", "None", "20% on new marketplace clients", "30% on new Boost clients"],
  ["Per-staff fees", "No", "Yes", "Yes"],
  ["WhatsApp reminders", "Yes", "No", "No"],
  ["Consumer marketplace", "No", "Yes", "Yes"],
  ["UK-built", "Yes", "Global", "Global"],
];

export default function BestSalonBookingSoftwarePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <main style={{ background: bg, minHeight: "100vh", color: text, fontFamily: "system-ui, sans-serif" }}>

        {/* Nav */}
        <nav style={{ background: "#FFFFFF", borderBottom: `1px solid ${border}`, padding: "0 24px", height: 60, display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 20, color: gold, textDecoration: "none", letterSpacing: "-0.5px" }}>feature</Link>
          <div style={{ display: "flex", gap: 24, alignItems: "center", fontSize: 14 }}>
            <Link href="/#features" style={{ color: muted, textDecoration: "none" }}>Features</Link>
            <Link href="/pricing" style={{ color: muted, textDecoration: "none" }}>Pricing</Link>
            <Link href="/blog" style={{ color: muted, textDecoration: "none" }}>Blog</Link>
            <Link href="/login" style={{ color: muted, textDecoration: "none" }}>Login</Link>
            <Link href="/signup" style={{ background: gold, color: "#FFFFFF", fontWeight: 700, fontSize: 13, padding: "8px 18px", borderRadius: 8, textDecoration: "none" }}>Start free trial</Link>
          </div>
        </nav>

        {/* Breadcrumb */}
        <div style={{ padding: "14px 24px", maxWidth: 800, margin: "0 auto", fontSize: 13, color: muted }}>
          <Link href="/" style={{ color: gold, textDecoration: "none" }}>Home</Link>
          <span style={{ margin: "0 8px" }}>&rsaquo;</span>
          <Link href="/blog" style={{ color: gold, textDecoration: "none" }}>Blog</Link>
          <span style={{ margin: "0 8px" }}>&rsaquo;</span>
          <span style={{ color: text2 }}>Best Salon Booking Software UK (2026)</span>
        </div>

        {/* Article header */}
        <header style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 32px" }}>
          <div style={{ display: "inline-block", background: "rgba(124,58,237,0.15)", color: gold, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 99, marginBottom: 20, letterSpacing: "2px", textTransform: "uppercase" }}>
            BUYER&rsquo;S GUIDE
          </div>
          <h1 style={{ fontSize: "clamp(26px,4.5vw,40px)", fontWeight: 800, color: text, margin: "0 0 20px", lineHeight: 1.2, letterSpacing: "-0.5px" }}>
            The Best Salon Booking Software in the UK (2026): An Honest Buyer&rsquo;s Guide
          </h1>
          <p style={{ fontSize: 18, color: text2, lineHeight: 1.7, margin: "0 0 24px" }}>
            There&rsquo;s no single &ldquo;best&rdquo; salon software &mdash; only the best one for how your salon actually works. Here&rsquo;s an honest guide to the main UK options in 2026 and how to choose without overpaying.
          </p>
          <div style={{ display: "flex", gap: 20, fontSize: 13, color: muted, flexWrap: "wrap" }}>
            <span>Feature Team</span>
            <span>&middot;</span>
            <span>1 June 2026</span>
            <span>&middot;</span>
            <span>5 min read</span>
          </div>
          <hr style={{ border: "none", borderTop: `1px solid ${border}`, margin: "28px 0 0" }} />
        </header>

        {/* Article body */}
        <article style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 64px" }}>

          {/* Section 1 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 16, letterSpacing: "-0.3px" }}>
              Start with the right question
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 20 }}>
              Most &ldquo;best salon software&rdquo; lists just rank tools. But the right choice depends entirely on your salon &mdash; so start here:
            </p>
            {[
              { q: "Where do your clients come from?", detail: "Mostly regulars, word of mouth and your own Instagram? Or do you rely on a platform finding you new faces?" },
              { q: "How predictable do you need your costs to be?", detail: "Would you rather pay one flat price, or pay less in quiet months and more in busy ones?" },
              { q: "What's your actual pain?", detail: "Bookings and no-shows? Or deeper needs like stock, detailed reporting, or marketing?" },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
                <span style={{ color: gold, fontSize: 18, lineHeight: 1.4, marginTop: 1, flexShrink: 0 }}>&bull;</span>
                <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                  <strong style={{ color: text }}>{item.q}</strong> {item.detail}
                </p>
              </div>
            ))}
            <p style={{ fontSize: 15, color: muted, lineHeight: 1.8, marginTop: 8 }}>
              Your answers point to one of two very different models.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 20, letterSpacing: "-0.3px" }}>
              The two models
            </h2>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 8 }}>Marketplace platforms (Fresha, Booksy)</div>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                These bundle booking software with a consumer app that can send you new clients &mdash; in exchange for commission on those new bookings (Booksy&rsquo;s Boost takes 30% of a new client&rsquo;s first visit; Fresha takes 20% on new marketplace clients), plus subscriptions and, often, per-staff fees. Powerful, with big feature sets. Best if marketplace discovery is central to your growth.
              </p>
            </div>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 16 }}>
              <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 8 }}>Flat-rate platforms (including Feature)</div>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                One predictable monthly price, no commission on bookings. You bring your own clients; you keep 100% of every booking. Best for established salons with a loyal base who value predictable costs over a discovery engine.
              </p>
            </div>

            <p style={{ fontSize: 15, color: muted, lineHeight: 1.8 }}>
              Neither is universally &ldquo;best&rdquo; &mdash; it genuinely depends on where your clients come from.
            </p>
          </section>

          {/* Section 3 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 24, letterSpacing: "-0.3px" }}>
              What to compare
            </h2>

            {[
              { heading: "All-in cost, not the headline", body: "Add subscription + per-staff fees + add-ons + likely commission for your real situation. A \"cheap\" tiered plan can overtake a flat plan once you add chairs and features." },
              { heading: "Reminders that get read", body: "WhatsApp and SMS reminders cut no-shows far more than email alone — and not every big platform offers WhatsApp." },
              { heading: "Deposits and payments", body: "Taking deposits at booking is the strongest no-show defence; look for smooth, mainstream processing (e.g. Stripe)." },
              { heading: "Your data, your clients", body: "Exportable client list, no lock-in, GDPR-friendly, UK pricing and support." },
              { heading: "The right fit for your size", body: "A solo stylist needs something simple; a multi-chair salon needs per-staff calendars; a clinic needs the right terminology. Don't pay for complexity you won't use." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 18 }}>
                <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>{item.heading}</div>
                  <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>{item.body}</div>
                </div>
              </div>
            ))}
          </section>

          {/* Section 4 — Comparison table */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 20, letterSpacing: "-0.3px" }}>
              A quick honest comparison
            </h2>
            <div style={{ overflowX: "auto", borderRadius: 12, border: `1px solid ${border}` }}>
              <table style={{ width: "100%", borderCollapse: "collapse", background: surface, fontSize: 14 }}>
                <thead>
                  <tr style={{ background: "#F5F3FF" }}>
                    <th style={th}></th>
                    <th style={thGold}>Feature</th>
                    <th style={th}>Fresha</th>
                    <th style={th}>Booksy</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(([label, feat, fresha, booksy], i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? surface : "#F5F3FF" }}>
                      <td style={{ ...td, fontWeight: 600, color: text, whiteSpace: "nowrap" }}>{label}</td>
                      <td style={tdGold}>{feat}</td>
                      <td style={td}>{fresha}</td>
                      <td style={td}>{booksy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 13, color: "#6B6577", lineHeight: 1.6, fontStyle: "italic", marginTop: 12 }}>
              Competitor pricing as reported in 2026 &mdash; always check each provider&rsquo;s current pricing page, as rates change.
            </p>
          </section>

          {/* Section 5 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 16, letterSpacing: "-0.3px" }}>
              Where Feature fits
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 16 }}>
              Feature is the flat-rate option: <strong style={{ color: text }}>&pound;29/month for the whole salon, no commission ever, WhatsApp &amp; SMS reminders, online booking, deposits and Stripe payments</strong>, built in the UK for salons, barbers, gyms and clinics.
            </p>
            <p style={{ fontSize: 15, color: muted, lineHeight: 1.8 }}>
              It&rsquo;s the right choice if you want predictable costs and to keep everything you earn. It&rsquo;s not a consumer marketplace, so if finding brand-new clients through an app is your main growth plan, a marketplace platform may suit you better &mdash; and we&rsquo;d rather tell you that honestly than oversell.
            </p>
          </section>

          {/* CTA box */}
          <div style={{ background: `linear-gradient(135deg, ${surface} 0%, #F5F3FF 100%)`, border: `1.5px solid ${gold}`, borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 56 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: text, margin: "0 0 10px" }}>
              Try the flat-rate option free
            </h3>
            <p style={{ fontSize: 16, color: text2, marginBottom: 24, lineHeight: 1.6 }}>
              14-day free trial &mdash; no card, no commission, no catch.
            </p>
            <Link
              href="/signup"
              style={{ display: "inline-block", background: gold, color: "#FFFFFF", fontWeight: 800, fontSize: 16, padding: "14px 36px", borderRadius: 10, textDecoration: "none", letterSpacing: "-0.2px" }}
            >
              Start free trial
            </Link>
            <p style={{ fontSize: 13, color: muted, marginTop: 14, lineHeight: 1.5 }}>
              UK-built salon booking software &mdash; one flat price, zero commission, WhatsApp reminders.
            </p>
          </div>

          {/* Related posts */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: gold, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 20 }}>RELATED GUIDES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 16 }}>
              <Link href="/blog/fresha-alternative-uk-2026" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                The Best Fresha Alternative for UK Salons (2026)
              </Link>
              <Link href="/blog/booksy-alternative-uk-2026" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                The Best Booksy Alternative for UK Salons (2026)
              </Link>
              <Link href="/blog/salon-booking-software-no-commission" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                Salon Booking Software with No Commission (2026)
              </Link>
            </div>
          </div>

        </article>

        {/* Footer */}
        <footer style={{ background: "#FFFFFF", borderTop: `1px solid ${border}`, padding: "40px 24px", textAlign: "center" }}>
          <Link href="/" style={{ fontWeight: 800, fontSize: 22, color: gold, textDecoration: "none", display: "block", marginBottom: 12 }}>feature</Link>
          <p style={{ fontSize: 13, color: muted, marginBottom: 16 }}>
            UK-built booking software for salons, clinics, gyms &amp; studios.
          </p>
          <div style={{ display: "flex", gap: 20, justifyContent: "center", fontSize: 13, flexWrap: "wrap" }}>
            <Link href="/blog" style={{ color: muted, textDecoration: "none" }}>Blog</Link>
            <Link href="/pricing" style={{ color: muted, textDecoration: "none" }}>Pricing</Link>
            <Link href="/signup" style={{ color: muted, textDecoration: "none" }}>Sign up</Link>
            <Link href="/privacy" style={{ color: muted, textDecoration: "none" }}>Privacy</Link>
            <Link href="/terms" style={{ color: muted, textDecoration: "none" }}>Terms</Link>
          </div>
        </footer>

      </main>
    </>
  );
}
