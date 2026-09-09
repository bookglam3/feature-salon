import type { Metadata } from "next";
import Link from "next/link";
import Calculator from "./Calculator";

export const metadata: Metadata = {
  title: "Feature vs Fresha — Honest Cost Comparison (2026) | Feature",
  description:
    "Compare Feature, Fresha, and Booksy on real 2026 UK pricing. Use our free calculator to see what marketplace commission could cost your salon or clinic each month.",
  alternates: { canonical: "https://www.featuresalon.co.uk/vs-fresha" },
  openGraph: {
    title: "Feature vs Fresha — Honest Cost Comparison (2026) | Feature",
    description:
      "Compare Feature, Fresha, and Booksy on real 2026 UK pricing. Use our free calculator to see what marketplace commission could cost your salon or clinic each month.",
    url: "https://www.featuresalon.co.uk/vs-fresha",
    locale: "en_GB",
    type: "website",
  },
};

const BASE = "https://www.featuresalon.co.uk";

const jsonLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "WebPage",
  "@id": `${BASE}/vs-fresha`,
  name: "Feature vs Fresha — Honest Cost Comparison (2026)",
  description:
    "Compare Feature, Fresha, and Booksy on real 2026 UK pricing. Interactive cost calculator included.",
  url: `${BASE}/vs-fresha`,
  breadcrumb: {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE },
      { "@type": "ListItem", position: 2, name: "vs Fresha", item: `${BASE}/vs-fresha` },
    ],
  },
});

const C = {
  bg: "#FFFFFF",
  surface: "#FFFFFF",
  border: "#ECE9F1",
  text: "#12101A",
  text2: "#524D60",
  muted: "#6B6577",
  gold: "#7C3AED",
  dim: "#524D60",
  green: "#047857",
  red: "#DC2626",
};

interface TableRow {
  label: string;
  feat: string;
  fresha: string;
  booksy: string;
  featColor?: string;
  freshaColor?: string;
  booksyColor?: string;
}

const TABLE: TableRow[] = [
  {
    label: "Monthly subscription",
    feat: "£29 flat (whole business)",
    fresha: "~£14.95 solo / ~£9.95 per member",
    booksy: "~£40 + ~£5 per member",
    featColor: C.green,
  },
  {
    label: "Commission on bookings",
    feat: "None",
    fresha: "20% on new marketplace clients (min ~£6)",
    booksy: "30% on new Boost clients (min £5)",
    featColor: C.green,
    freshaColor: C.red,
    booksyColor: C.red,
  },
  {
    label: "Per-staff fees",
    feat: "No",
    fresha: "Yes",
    booksy: "Yes",
    featColor: C.green,
    freshaColor: C.red,
    booksyColor: C.red,
  },
  {
    label: "WhatsApp reminders",
    feat: "Yes",
    fresha: "No",
    booksy: "No",
    featColor: C.green,
    freshaColor: C.red,
    booksyColor: C.red,
  },
  {
    label: "Consumer marketplace",
    feat: "No",
    fresha: "Yes",
    booksy: "Yes",
  },
  {
    label: "Card payments",
    feat: "Yes (Stripe)",
    fresha: "Yes",
    booksy: "Yes",
    featColor: C.green,
    freshaColor: C.green,
    booksyColor: C.green,
  },
  {
    label: "UK-built",
    feat: "Yes",
    fresha: "Global",
    booksy: "Global",
    featColor: C.green,
  },
];

export default function VsFresha() {
  return (
    <main className="landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />

      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="nav-logo">feature</Link>
        <div className="nav-links">
          <Link href="/#features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/vs-fresha" style={{ color: C.gold, fontWeight: 700 }}>vs Fresha</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup" className="btn-primary">Start free trial</Link>
        </div>
        <Link href="/signup" className="btn-primary mobile-nav-cta">Start free trial</Link>
      </nav>

      {/* Hero */}
      <section style={{ background: "#F5F3FF", borderBottom: `1px solid ${C.border}`, padding: "64px 24px 56px", textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#6D28D9", fontSize: 12, fontWeight: 700, padding: "6px 16px", borderRadius: 99, marginBottom: 24, letterSpacing: "0.5px", textTransform: "uppercase" }}>
            Honest comparison · 2026 pricing
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 900, color: C.text, lineHeight: 1.1, marginBottom: 20, letterSpacing: "-0.5px" }}>
            Feature vs Fresha: an honest cost comparison
          </h1>
          <p style={{ fontSize: 18, color: C.muted, lineHeight: 1.7, maxWidth: 540, margin: "0 auto 32px" }}>
            See what a marketplace commission could cost you — and compare it to one flat monthly price.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="#calculator" style={{ background: C.gold, color: "#fff", fontSize: 14, fontWeight: 700, padding: "12px 24px", borderRadius: 10, textDecoration: "none", display: "inline-block" }}>
              Try the calculator ↓
            </a>
            <Link href="/signup" style={{ background: C.surface, color: C.text2, fontSize: 14, fontWeight: 600, padding: "12px 24px", borderRadius: 10, textDecoration: "none", border: `1px solid ${C.border}`, display: "inline-block" }}>
              Start free trial
            </Link>
          </div>
        </div>
      </section>

      {/* Comparison table */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "56px 24px 48px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#524D60", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>Side-by-side</div>
          <h2 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 800, color: "#12101A", letterSpacing: "-0.3px" }}>
            How the costs stack up
          </h2>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ padding: "12px 18px", textAlign: "left", background: "#F5F3FF", color: C.muted, fontWeight: 700, border: `1px solid ${C.border}`, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", width: "28%" }}></th>
                <th style={{ padding: "14px 18px", textAlign: "center", background: "rgba(124,58,237,0.12)", color: "#6D28D9", fontWeight: 900, border: "1px solid rgba(124,58,237,0.35)", fontSize: 15 }}>
                  Feature
                </th>
                <th style={{ padding: "14px 18px", textAlign: "center", background: "#F5F3FF", color: C.text, fontWeight: 700, border: `1px solid ${C.border}`, fontSize: 14 }}>
                  Fresha
                </th>
                <th style={{ padding: "14px 18px", textAlign: "center", background: "#F5F3FF", color: C.text, fontWeight: 700, border: `1px solid ${C.border}`, fontSize: 14 }}>
                  Booksy
                </th>
              </tr>
            </thead>
            <tbody>
              {TABLE.map((row, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? C.surface : C.bg }}>
                  <td style={{ padding: "13px 18px", color: C.text, fontWeight: 600, border: `1px solid ${C.border}`, fontSize: 13.5 }}>
                    {row.label}
                  </td>
                  <td style={{ padding: "13px 18px", textAlign: "center", color: row.featColor ?? C.text2, border: "1px solid rgba(124,58,237,0.2)", background: i % 2 === 0 ? "rgba(124,58,237,0.07)" : "rgba(124,58,237,0.04)", fontWeight: row.featColor ? 700 : 400, fontSize: 13.5 }}>
                    {row.feat}
                  </td>
                  <td style={{ padding: "13px 18px", textAlign: "center", color: row.freshaColor ?? C.text2, border: `1px solid ${C.border}`, fontWeight: row.freshaColor ? 700 : 400, fontSize: 13 }}>
                    {row.fresha}
                  </td>
                  <td style={{ padding: "13px 18px", textAlign: "center", color: row.booksyColor ?? C.text2, border: `1px solid ${C.border}`, fontWeight: row.booksyColor ? 700 : 400, fontSize: 13 }}>
                    {row.booksy}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p style={{ fontSize: 12, color: C.dim, marginTop: 12, fontStyle: "italic", textAlign: "right" }}>
          Competitor pricing as reported in 2026 — always check each provider&apos;s current pricing page.
        </p>

        {/* Honest trade-off paragraph */}
        <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "22px 26px", marginTop: 28 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>The honest trade-off</div>
          <p style={{ fontSize: 15, color: C.text2, lineHeight: 1.8, margin: 0 }}>
            Feature has no consumer marketplace, so it won&apos;t put your business in front of strangers the way Fresha or Booksy can. You bring your clients; in return you pay one flat price and keep 100% of every booking. <strong style={{ color: C.text }}>If marketplace discovery is your main source of new clients, a marketplace platform may suit you better</strong> — and that&apos;s a fair, honest answer.
          </p>
        </div>
      </section>

      {/* Calculator section */}
      <section id="calculator" style={{ background: "#F5F3FF", borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`, padding: "56px 24px 64px" }}>
        <div style={{ maxWidth: 860, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>Interactive</div>
            <h2 style={{ fontSize: "clamp(22px,3.5vw,32px)", fontWeight: 800, color: C.text, letterSpacing: "-0.3px", marginBottom: 12 }}>
              Calculate your monthly cost
            </h2>
            <p style={{ fontSize: 16, color: C.muted, lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
              Adjust the numbers to match your business. Figures update live.
            </p>
          </div>

          <Calculator />
        </div>
      </section>

      {/* Why flat rate section */}
      <section style={{ maxWidth: 820, margin: "0 auto", padding: "56px 24px 64px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(22px,3.5vw,30px)", fontWeight: 800, color: "#12101A", letterSpacing: "-0.3px" }}>
            Why owners choose a flat rate
          </h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
          {[
            {
              icon: "📊",
              title: "Predictable costs",
              body: "Your software bill is the same whether you have 10 clients or 200. No surprises, no end-of-month shock.",
            },
            {
              icon: "💬",
              title: "WhatsApp reminders",
              body: "Automated WhatsApp and SMS reminders are built in — cutting no-shows without any manual chasing.",
            },
            {
              icon: "💷",
              title: "Keep every penny",
              body: "No commission on any booking, ever. Every pound your clients spend goes to you — not to the platform.",
            },
            {
              icon: "🇬🇧",
              title: "Built for the UK",
              body: "Pricing in pounds, UK workflows, and support from people who understand how a British salon or clinic runs.",
            },
          ].map((item, i) => (
            <div key={i} style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 16, padding: "24px 22px" }}>
              <div style={{ fontSize: 28, marginBottom: 14 }}>{item.icon}</div>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 8 }}>{item.title}</div>
              <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.7 }}>{item.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="section final-cta">
        <h2 className="final-cta-title">Ready to try the flat-rate alternative?</h2>
        <p className="final-cta-sub">14-day free trial. No credit card. No commission on any booking — ever.</p>
        <Link href="/signup" className="btn-primary btn-lg btn-glow">
          Start Free 14-Day Trial →
        </Link>
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
          <Link href="/vs-fresha">vs Fresha</Link>
          <Link href="/blog">Blog</Link>
          <Link href="/signup">Sign up</Link>
        </nav>
        <span className="footer-copy">© 2025 Feature. Built for salons across the UK.</span>
      </footer>
    </main>
  );
}
