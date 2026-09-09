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
  title: "Salon Booking Software with No Commission: Why It Matters (2026) | Feature",
  description: "\"Free\" booking software is rarely free. An honest look at how commission quietly eats salon profits — and why a flat-rate, no-commission model can be worth far more than it looks.",
  alternates: { canonical: "https://www.featuresalon.co.uk/blog/salon-booking-software-no-commission" },
  openGraph: {
    title: "Salon Booking Software with No Commission: Why It Matters (2026) | Feature",
    description: "How commission quietly eats salon profits — and why a flat-rate, no-commission model can be worth far more than it looks.",
    url: "https://www.featuresalon.co.uk/blog/salon-booking-software-no-commission",
    locale: "en_GB",
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Salon Booking Software with No Commission: Why It Matters (2026)",
      "datePublished": "2026-06-01",
      "dateModified": "2026-06-01",
      "author": { "@type": "Organization", "name": "Feature Team" },
      "publisher": { "@type": "Organization", "name": "Feature", "url": "https://www.featuresalon.co.uk" },
      "url": "https://www.featuresalon.co.uk/blog/salon-booking-software-no-commission",
      "description": "An honest look at how commission quietly eats salon profits — and why a flat-rate, no-commission model can be worth far more than it looks.",
      "mainEntityOfPage": { "@type": "WebPage", "@id": "https://www.featuresalon.co.uk/blog/salon-booking-software-no-commission" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.featuresalon.co.uk" },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.featuresalon.co.uk/blog" },
        { "@type": "ListItem", "position": 3, "name": "Salon Booking Software with No Commission", "item": "https://www.featuresalon.co.uk/blog/salon-booking-software-no-commission" },
      ],
    },
  ],
};

export default function NoCommissionPage() {
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
          <span style={{ color: text2 }}>Salon Booking Software with No Commission</span>
        </div>

        {/* Article header */}
        <header style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 32px" }}>
          <div style={{ display: "inline-block", background: "rgba(124,58,237,0.15)", color: gold, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 99, marginBottom: 20, letterSpacing: "2px", textTransform: "uppercase" }}>
            NO COMMISSION BOOKING
          </div>
          <h1 style={{ fontSize: "clamp(26px,4.5vw,40px)", fontWeight: 800, color: text, margin: "0 0 20px", lineHeight: 1.2, letterSpacing: "-0.5px" }}>
            Salon Booking Software with No Commission: Why It Matters (2026)
          </h1>
          <p style={{ fontSize: 18, color: text2, lineHeight: 1.7, margin: "0 0 24px" }}>
            &ldquo;Free&rdquo; booking software is rarely free. Here&rsquo;s an honest look at how commission quietly eats salon profits &mdash; and why a no-commission, flat-rate model can be worth far more than it looks.
          </p>
          <div style={{ display: "flex", gap: 20, fontSize: 13, color: muted, flexWrap: "wrap" }}>
            <span>Feature Team</span>
            <span>&middot;</span>
            <span>1 June 2026</span>
            <span>&middot;</span>
            <span>4 min read</span>
          </div>
          <hr style={{ border: "none", borderTop: `1px solid ${border}`, margin: "28px 0 0" }} />
        </header>

        {/* Article body */}
        <article style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 64px" }}>

          {/* Section 1 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 16, letterSpacing: "-0.3px" }}>
              The hidden cost of &ldquo;free&rdquo;
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 16 }}>
              When a booking platform is free or cheap to start, the money has to come from somewhere. For the big marketplace platforms, it usually comes from <strong style={{ color: text }}>commission</strong> &mdash; a cut of certain bookings, taken before the money ever reaches you.
            </p>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8 }}>
              The numbers add up faster than owners expect. Booksy&rsquo;s marketplace &ldquo;Boost&rdquo; takes 30% of a new client&rsquo;s first appointment (minimum &pound;5). Fresha, on its paid plans, takes 20% on new clients who come through its marketplace (minimum around &pound;6). On the surface that sounds fair &mdash; you only pay when they bring you someone new. But the edges are sharp.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 24, letterSpacing: "-0.3px" }}>
              Where commission quietly hurts
            </h2>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 6 }}>A &ldquo;new&rdquo; client isn&rsquo;t always new</div>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                Owners regularly report that a regular who forgets their login and rebooks through a fresh account can get counted as a brand-new marketplace client &mdash; and you pay commission on someone who was already yours.
              </p>
            </div>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 14 }}>
              <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 6 }}>It scales with your success, not your costs</div>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                A flat subscription costs the same whether you&rsquo;re quiet or fully booked. Commission does the opposite: the busier you get, the more you hand over. Your best months become the platform&rsquo;s best months too.
              </p>
            </div>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "20px 24px", marginBottom: 24 }}>
              <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 6 }}>It&rsquo;s hard to predict</div>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                Between commission, subscription, per-staff fees and payment processing, many owners simply can&rsquo;t say what they&rsquo;ll pay in a given month.
              </p>
            </div>

            <p style={{ fontSize: 15, color: muted, lineHeight: 1.8 }}>
              To be fair: if the marketplace genuinely sends you new clients you wouldn&rsquo;t otherwise reach, the commission can be worth it. The honest question is whether <em>your</em> growth actually depends on it &mdash; or whether most of your clients come from word of mouth, your own Instagram, and walk-ins. If it&rsquo;s the latter, you may be paying a cut for introductions you&rsquo;d have made anyway.
            </p>
          </section>

          {/* Section 3 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 16, letterSpacing: "-0.3px" }}>
              What &ldquo;no commission&rdquo; actually changes
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 16 }}>
              A no-commission, flat-rate platform flips the model. You pay one predictable monthly price, and <strong style={{ color: text }}>every booking &mdash; and every penny from it &mdash; stays yours.</strong> A fully booked Saturday costs you exactly the same in software as a quiet Tuesday.
            </p>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 16 }}>
              For an established salon with a loyal client base, that predictability usually wins. You can plan your costs, your busy months reward you (not your software), and there&rsquo;s no nasty surprise when a regular gets miscounted as &ldquo;new&rdquo;.
            </p>
            <p style={{ fontSize: 15, color: muted, lineHeight: 1.8 }}>
              The trade-off is honest and worth stating: a no-commission platform isn&rsquo;t a consumer marketplace, so it won&rsquo;t put you in front of strangers the way Fresha or Booksy can. You bring your clients; in return, you keep everything and your cost never moves.
            </p>
          </section>

          {/* Section 4 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 20, letterSpacing: "-0.3px" }}>
              Where Feature fits
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 20 }}>
              Feature is built entirely on the no-commission model:
            </p>

            {[
              { label: "One flat £29/month for the whole business", detail: "No per-staff fees. No commission on any booking, ever." },
              { label: "WhatsApp & SMS reminders", detail: "Automated reminders built in to cut no-shows, on your own branded booking page." },
              { label: "Stripe payments that land in your account", detail: "Mainstream payment processing with full transparency — no middleman taking a percentage." },
              { label: "UK-built", detail: "For salons, barbers, gyms and clinics. GBP, GDPR-friendly, UK support." },
            ].map((item, i) => (
              <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 14 }}>
                <span style={{ color: gold, fontSize: 16, lineHeight: 1.5, marginTop: 2, flexShrink: 0 }}>&#10003;</span>
                <div>
                  <span style={{ fontSize: 15, color: text, fontWeight: 700 }}>{item.label}</span>
                  <span style={{ fontSize: 15, color: text2 }}> &mdash; {item.detail}</span>
                </div>
              </div>
            ))}

            <p style={{ fontSize: 15, color: muted, lineHeight: 1.8, marginTop: 20 }}>
              If marketplace discovery is your main growth engine, a marketplace platform may suit you better &mdash; and that&rsquo;s a fair answer. But if you&rsquo;d rather keep 100% of what your clients spend and always know your costs, no commission is the point.
            </p>
          </section>

          {/* Disclaimer */}
          <p style={{ fontSize: 13, color: "#6B6577", lineHeight: 1.6, fontStyle: "italic", marginBottom: 48 }}>
            Competitor pricing as reported in 2026 &mdash; always check each provider&rsquo;s current pricing page, as rates change.
          </p>

          {/* CTA box */}
          <div style={{ background: `linear-gradient(135deg, ${surface} 0%, #F5F3FF 100%)`, border: `1.5px solid ${gold}`, borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 56 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: text, margin: "0 0 10px" }}>
              Keep every penny your clients spend
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
              UK-built booking software for salons, barbers, gyms and clinics &mdash; one flat price, zero commission.
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
              <Link href="/blog/how-to-reduce-salon-no-shows" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                How to Reduce No-Shows in Your Salon (2026)
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
