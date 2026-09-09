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
  title: "How to Take Deposits in Your Salon (and Why You Should) — 2026 Guide | Feature",
  description: "Deposits are the single most effective way to stop no-shows — yet many UK salons still avoid them. Here's how to do it right, without losing bookings.",
  alternates: { canonical: "https://www.featuresalon.co.uk/blog/how-to-take-deposits-salon" },
  openGraph: {
    title: "How to Take Deposits in Your Salon (and Why You Should) — 2026 Guide | Feature",
    description: "Deposits are the single most effective way to stop no-shows. Here's how UK salons can do it right, without losing bookings.",
    url: "https://www.featuresalon.co.uk/blog/how-to-take-deposits-salon",
    locale: "en_GB",
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "How to Take Deposits in Your Salon (and Why You Should) — 2026 Guide",
      "datePublished": "2026-06-01",
      "dateModified": "2026-06-01",
      "author": { "@type": "Organization", "name": "Feature Team" },
      "publisher": { "@type": "Organization", "name": "Feature", "url": "https://www.featuresalon.co.uk" },
      "url": "https://www.featuresalon.co.uk/blog/how-to-take-deposits-salon",
      "description": "Deposits are the single most effective way to stop no-shows — yet many UK salons still avoid them. Here's how to do it right, without losing bookings.",
      "mainEntityOfPage": { "@type": "WebPage", "@id": "https://www.featuresalon.co.uk/blog/how-to-take-deposits-salon" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.featuresalon.co.uk" },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.featuresalon.co.uk/blog" },
        { "@type": "ListItem", "position": 3, "name": "How to Take Deposits in Your Salon", "item": "https://www.featuresalon.co.uk/blog/how-to-take-deposits-salon" },
      ],
    },
  ],
};

export default function SalonDepositsPage() {
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
          <span style={{ color: text2 }}>How to Take Deposits in Your Salon</span>
        </div>

        {/* Article header */}
        <header style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 32px" }}>
          <div style={{ display: "inline-block", background: "rgba(124,58,237,0.15)", color: gold, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 99, marginBottom: 20, letterSpacing: "2px", textTransform: "uppercase" }}>
            SALON DEPOSITS
          </div>
          <h1 style={{ fontSize: "clamp(26px,4.5vw,40px)", fontWeight: 800, color: text, margin: "0 0 20px", lineHeight: 1.2, letterSpacing: "-0.5px" }}>
            How to Take Deposits in Your Salon (and Why You Should) &mdash; 2026 Guide
          </h1>
          <p style={{ fontSize: 18, color: text2, lineHeight: 1.7, margin: "0 0 24px" }}>
            Deposits are the single most effective way to stop no-shows &mdash; yet many UK salons still avoid them, worried they&rsquo;ll put clients off. Here&rsquo;s how to do it right, without losing bookings.
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
              Why deposits work
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 16 }}>
              A no-show isn&rsquo;t just a missed appointment &mdash; it&rsquo;s an empty chair you can&rsquo;t sell twice, and across the UK industry it adds up to over &pound;1 billion in lost revenue a year, averaging around &pound;39 per missed appointment.
            </p>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8 }}>
              Deposits are the strongest fix. When a client has money committed to a booking, they&rsquo;re far more likely to turn up &mdash; salons that take deposits commonly see no-shows fall by around 29%, and often more for higher-value services. The psychology is simple: a booking with nothing at stake is easy to forget; a booking you&rsquo;ve paid towards isn&rsquo;t.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 16, letterSpacing: "-0.3px" }}>
              The fear &mdash; and why it&rsquo;s usually overblown
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 16 }}>
              The most common worry is: &ldquo;Won&rsquo;t deposits scare clients away?&rdquo; In practice, for most salons, they don&rsquo;t. Clients are well used to paying deposits for restaurants, events and other appointments. A small, clearly-explained deposit signals that your time has value &mdash; and the clients you might lose are often exactly the ones most likely to no-show anyway.
            </p>
            <p style={{ fontSize: 15, color: muted, lineHeight: 1.8 }}>
              The key is to be fair and clear, not heavy-handed.
            </p>
          </section>

          {/* Section 3 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 24, letterSpacing: "-0.3px" }}>
              How to take deposits the right way
            </h2>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>1</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>Start small</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>You don&rsquo;t need the full price up front. A deposit of around 10&ndash;20% of the service is usually enough to create commitment without feeling like a barrier.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>2</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>Apply them where they matter most</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>Many owners use deposits only for longer or higher-value treatments (colour, extensions, multi-hour services), for new clients, or for clients with a history of missing appointments &mdash; while keeping quick, low-value bookings deposit-free.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>3</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>Make the policy clear before booking</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>State it on your booking page and in confirmations: for example, &ldquo;A 20% deposit secures your appointment, refundable with 24 hours&rsquo; notice.&rdquo; No surprises means no resentment.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>4</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>Set a fair cancellation window</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>Refund or transfer the deposit if the client gives reasonable notice (commonly 24&ndash;48 hours). This keeps it fair while still protecting your time.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 0 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>5</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>Make paying effortless</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>The deposit should be taken at the moment of booking, through a smooth card payment. If paying is awkward, you&rsquo;ll lose bookings &mdash; so use proper, mainstream processing (e.g. Stripe).</div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 16, letterSpacing: "-0.3px" }}>
              A nice side effect
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8 }}>
              Deposits don&rsquo;t just cut no-shows &mdash; they often nudge spending up slightly, because the remaining balance feels smaller at checkout. And because the slot is far more likely to be honoured, your diary becomes something you can actually rely on.
            </p>
          </section>

          {/* Section 5 — Feature */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 16, letterSpacing: "-0.3px" }}>
              How Feature helps
            </h2>
            <div style={{ background: surface, border: `1.5px solid ${border}`, borderRadius: 12, padding: "24px 28px" }}>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.8, margin: "0 0 16px" }}>
                Feature lets you take <strong style={{ color: text }}>deposits and payments via Stripe</strong> right at the point of online booking, alongside <strong style={{ color: text }}>WhatsApp &amp; SMS reminders</strong> &mdash; the two most effective no-show defences working together.
              </p>
              {[
                "Stripe deposits taken at booking — no chasing payment after the fact",
                "Set the deposit amount per service or apply it across all bookings",
                "WhatsApp & SMS reminders automatically sent 24h and 2h before each appointment",
                "All on one flat £29/month — no commission on any booking",
              ].map((pt, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 10 }}>
                  <span style={{ color: gold, fontSize: 16, lineHeight: 1.5, marginTop: 1, flexShrink: 0 }}>&#10003;</span>
                  <span style={{ fontSize: 15, color: text2, lineHeight: 1.65 }}>{pt}</span>
                </div>
              ))}
            </div>
          </section>

          {/* CTA box */}
          <div style={{ background: `linear-gradient(135deg, ${surface} 0%, #F5F3FF 100%)`, border: `1.5px solid ${gold}`, borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 56 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: text, margin: "0 0 10px" }}>
              Protect your diary with deposits
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
              UK-built booking software for salons, barbers, gyms and clinics &mdash; online bookings, deposits, reminders and Stripe payments, one flat price.
            </p>
          </div>

          {/* Related posts */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: gold, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 20 }}>RELATED GUIDES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 16 }}>
              <Link href="/blog/how-to-reduce-salon-no-shows" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                How to Reduce No-Shows in Your Salon (2026)
              </Link>
              <Link href="/blog/salon-software-whatsapp-reminders" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                Salon Software with WhatsApp Reminders
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
