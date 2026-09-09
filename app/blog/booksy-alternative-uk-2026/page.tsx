import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "../posts";

export const metadata: Metadata = {
  title: "The Best Booksy Alternative for UK Salons & Barbers (2026) | Feature",
  description:
    "Thinking of leaving Booksy? An honest look at what Booksy costs in 2026 — subscription, per-staff fees and Boost commission — and what to consider if you want something simpler.",
  alternates: {
    canonical: "https://www.featuresalon.co.uk/blog/booksy-alternative-uk-2026",
  },
  openGraph: {
    title: "The Best Booksy Alternative for UK Salons & Barbers (2026) | Feature",
    description:
      "Thinking of leaving Booksy? An honest look at what Booksy costs in 2026 — subscription, per-staff fees and Boost commission — and what to consider if you want something simpler.",
    url: "https://www.featuresalon.co.uk/blog/booksy-alternative-uk-2026",
    locale: "en_GB",
    type: "article",
    publishedTime: "2026-06-01",
  },
};

const BASE = "https://www.featuresalon.co.uk";
const PAGE_URL = `${BASE}/blog/booksy-alternative-uk-2026`;

const jsonLdArticle = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${PAGE_URL}#article`,
  headline: "The Best Booksy Alternative for UK Salons & Barbers (2026)",
  description:
    "An honest look at what Booksy costs in 2026 and what to consider if you want a simpler, flat-rate alternative.",
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
  timeRequired: "PT4M",
  keywords: "booksy alternative uk, booksy alternative 2026, booksy vs feature, barbershop booking software uk",
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
      name: "The Best Booksy Alternative for UK Salons & Barbers (2026)",
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

interface TableRow {
  label: string;
  feat: string;
  booksy: string;
  featColor?: string;
  booksyColor?: string;
}

const TABLE: TableRow[] = [
  {
    label: "Monthly subscription",
    feat: "£29 flat (whole business)",
    booksy: "~£40 + ~£5 per staff member",
    featColor: "#047857",
  },
  {
    label: "Commission on bookings",
    feat: "None",
    booksy: '30% on new "Boost" clients (min £5)',
    featColor: "#047857",
    booksyColor: "#B91C1C",
  },
  {
    label: "Per-staff fees",
    feat: "No",
    booksy: "Yes",
    featColor: "#047857",
    booksyColor: "#B91C1C",
  },
  {
    label: "WhatsApp reminders",
    feat: "Yes",
    booksy: "No",
    featColor: "#047857",
    booksyColor: "#B91C1C",
  },
  {
    label: "Consumer marketplace",
    feat: "No",
    booksy: "Yes",
  },
  {
    label: "Card payments",
    feat: "Yes (Stripe)",
    booksy: "Yes",
    featColor: "#047857",
    booksyColor: "#047857",
  },
  {
    label: "UK-built",
    feat: "Yes",
    booksy: "Global",
    featColor: "#047857",
  },
];

const FEATURE_POINTS = [
  "One flat £29/month for the whole business — not per staff — with no commission on any booking, ever.",
  "WhatsApp & SMS reminders built in to cut no-shows.",
  "Online booking through your own branded page, plus card payments via Stripe that land in your account.",
  "UK-built, and flexible for salons, barbers, gyms and clinics alike.",
];

export default function BooksyAlternativePage() {
  const related = POSTS.filter((p) => p.slug !== "booksy-alternative-uk-2026").slice(0, 3);

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
        <span style={{ color: C.text2, fontWeight: 600 }}>The Best Booksy Alternative for UK Salons &amp; Barbers (2026)</span>
      </div>

      {/* Article */}
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 72px" }}>

        {/* Header */}
        <header style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(124,58,237,0.15)", color: C.gold, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(124,58,237,0.25)" }}>
              booksy alternative
            </span>
            <span style={{ fontSize: 13, color: C.muted }}>📅 1 Jun 2026</span>
            <span style={{ fontSize: 13, color: C.muted }}>⏱ 4 min read</span>
          </div>

          <h1 style={{ fontSize: "clamp(28px,4.5vw,46px)", fontWeight: 900, color: C.text, lineHeight: 1.15, marginBottom: 28, letterSpacing: "-0.5px" }}>
            The Best Booksy Alternative for UK Salons &amp; Barbers (2026)
          </h1>

          <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.85, borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, margin: 0, fontStyle: "italic" }}>
            Thinking of leaving Booksy &mdash; or weighing it up before you commit? Here&apos;s an honest look at what Booksy costs in 2026, where it shines, and what to consider if you want something simpler.
          </p>
        </header>

        {/* Prose */}
        <div style={{ fontSize: 16, lineHeight: 1.85, color: C.text2 }}>

          {/* Section 1 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Why owners look for a Booksy alternative</h2>
            <p>
              Booksy is a capable, popular platform, especially with barbershops. But a few things send owners searching for something else &mdash; and they&apos;re worth understanding before you decide.
            </p>
            <p>
              The first is <strong style={{ color: C.text }}>cost stacking</strong>. Booksy runs at around &pound;40/month, plus roughly &pound;5 per additional staff member, and several useful features (marketing, extra tools) can sit in higher tiers or add-ons. For a small shop, the all-in monthly figure can climb past what the headline suggests.
            </p>
            <p>
              The second is the <strong style={{ color: C.text }}>marketplace commission</strong>. Booksy&apos;s &ldquo;Boost&rdquo; feature promotes you in its consumer app to find new clients &mdash; and takes <strong style={{ color: "#B91C1C" }}>30% of a new client&apos;s first appointment (minimum &pound;5)</strong> in return. On a &pound;30 service, that&apos;s around &pound;9 handed over for one new booking. Boost is optional, but owners often report it being easy to leave on, and a regular who rebooks through a new account can occasionally get counted as &ldquo;new.&rdquo;
            </p>
            <p>
              The third is simply <strong style={{ color: C.text }}>predictability</strong>. Between subscription, per-staff fees, Boost commission, and payment processing, some owners find it hard to know what they&apos;ll actually pay in a given month.
            </p>
            <p>
              To be fair to Booksy: if a big chunk of your new clients genuinely come from its marketplace, that commission can pay for itself. The question is whether <em>your</em> growth depends on it.
            </p>
          </section>

          {/* Section 2 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>What to look for in an alternative</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
              {[
                {
                  title: "Work out the all-in cost.",
                  body: "Add subscription, per-staff fees, add-ons and any commission for your real situation — not just the headline price. A flat plan can work out cheaper once you add chairs and features.",
                },
                {
                  title: "Check where your clients come from.",
                  body: "If most arrive via word of mouth, your own Instagram, or walk-ins, you may be paying marketplace commission for introductions you would have made anyway. If you rely on discovery, a marketplace matters more.",
                },
                {
                  title: "Reminders that get read.",
                  body: "WhatsApp and SMS reminders cut no-shows far more effectively than email alone.",
                },
                {
                  title: "Your data and payments, clearly yours.",
                  body: "Exportable client list, mainstream card processing (e.g. Stripe), no lock-in.",
                },
                {
                  title: "A proper UK fit.",
                  body: "Pricing in pounds, UK workflows, and support that understands how a British shop runs.",
                },
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <span style={{ color: C.gold, fontWeight: 900, fontSize: 20, flexShrink: 0, lineHeight: 1.5 }}>·</span>
                  <p style={{ margin: 0 }}>
                    <strong style={{ color: C.text }}>{item.title}</strong>{" "}{item.body}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* Section 3 — Comparison table */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Booksy vs Feature &mdash; an honest comparison</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 460 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px 16px", textAlign: "left", background: "#FFFFFF", color: C.muted, fontWeight: 700, border: `1px solid ${C.border}`, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", width: "36%" }}></th>
                    <th style={{ padding: "12px 20px", textAlign: "center", background: "rgba(124,58,237,0.14)", color: C.gold, fontWeight: 800, border: "1px solid rgba(124,58,237,0.35)", fontSize: 14 }}>Feature</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", background: "#FFFFFF", color: C.text, fontWeight: 700, border: `1px solid ${C.border}`, fontSize: 14 }}>Booksy</th>
                  </tr>
                </thead>
                <tbody>
                  {TABLE.map((row, i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? C.surface : C.bg }}>
                      <td style={{ padding: "12px 16px", color: C.text, fontWeight: 600, border: `1px solid ${C.border}`, fontSize: 13 }}>
                        {row.label}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", color: row.featColor ?? C.text2, border: "1px solid rgba(124,58,237,0.2)", background: i % 2 === 0 ? "rgba(124,58,237,0.07)" : "rgba(124,58,237,0.04)", fontWeight: row.featColor ? 700 : 400, fontSize: 13 }}>
                        {row.feat}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center", color: row.booksyColor ?? C.text2, border: `1px solid ${C.border}`, fontWeight: row.booksyColor ? 700 : 400, fontSize: 13 }}>
                        {row.booksy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: 13, color: C.dim, marginTop: 12, fontStyle: "italic" }}>
              Competitor pricing as reported in 2026 &mdash; always check Booksy&apos;s current pricing page, as rates change.
            </p>
          </section>

          {/* Section 4 — Where Feature fits */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Where Feature fits</h2>
            <p>Feature is built on the flat model, for owners who&apos;d rather have certainty than a commission bill:</p>

            <div style={{ background: C.surface, border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 16, padding: "20px 24px", margin: "20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
              {FEATURE_POINTS.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "#047857", fontWeight: 900, flexShrink: 0, fontSize: 16, marginTop: 3 }}>&#10003;</span>
                  <span style={{ color: C.text2 }}>{item}</span>
                </div>
              ))}
            </div>

            <p>
              The honest trade-off: Feature isn&apos;t a consumer marketplace, so it won&apos;t put you in front of strangers the way Booksy&apos;s Boost can. You bring your clients; in return you keep 100% of every booking and your monthly cost never moves. For an established business with loyal regulars, that&apos;s usually the better deal. If marketplace discovery is your main growth engine, Booksy may suit you better &mdash; and that&apos;s a fair answer.
            </p>
          </section>

          {/* CTA */}
          <section style={sectionStyle}>
            <div style={{ background: "rgba(124,58,237,0.08)", border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 18, padding: "36px 32px", textAlign: "center" }}>
              <h3 style={{ fontSize: 17, fontWeight: 800, color: C.gold, marginBottom: 14, marginTop: 0 }}>
                See the difference for yourself
              </h3>
              <p style={{ fontSize: 16, color: C.text, fontWeight: 700, marginBottom: 24, lineHeight: 1.6 }}>
                Start a 14-day free trial &mdash; no card, no commission, no catch.
              </p>
              <Link href="/signup" className="btn-primary btn-lg btn-glow">
                Start free &rarr;
              </Link>
            </div>
            <p style={{ fontSize: 13, color: C.dim, fontStyle: "italic", textAlign: "center", marginTop: 20, marginBottom: 0 }}>
              Feature: UK-built booking software for salons, barbershops, gyms and clinics &mdash; online bookings, WhatsApp &amp; SMS reminders, and Stripe payments, one flat price, zero commission.
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
