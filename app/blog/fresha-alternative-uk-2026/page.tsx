import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "../posts";

export const metadata: Metadata = {
  title: "Best Fresha Alternative for UK Salons & Clinics (2026) | Feature",
  description:
    "Looking for a Fresha alternative with no commission? Compare Fresha, Booksy and Feature on real 2026 UK pricing — flat £29/month, WhatsApp reminders, zero commission.",
  alternates: {
    canonical: "https://www.featuresalon.co.uk/blog/fresha-alternative-uk-2026",
  },
  openGraph: {
    title: "Best Fresha Alternative for UK Salons & Clinics (2026) | Feature",
    description:
      "Looking for a Fresha alternative with no commission? Compare Fresha, Booksy and Feature on real 2026 UK pricing — flat £29/month, WhatsApp reminders, zero commission.",
    url: "https://www.featuresalon.co.uk/blog/fresha-alternative-uk-2026",
    locale: "en_GB",
    type: "article",
    publishedTime: "2026-05-31",
  },
};

const BASE = "https://www.featuresalon.co.uk";
const PAGE_URL = `${BASE}/blog/fresha-alternative-uk-2026`;

const jsonLdArticle = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Article",
  "@id": `${PAGE_URL}#article`,
  headline: "The Best Fresha Alternative for UK Salons & Clinics in 2026",
  description:
    "An honest, up-to-date look at the real cost of the big booking platforms in 2026 — Fresha, Booksy, and Feature compared on subscription, commission, and features.",
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
  timeRequired: "PT9M",
  keywords: "fresha alternative uk, booksy alternative, salon booking software uk 2026",
  about: [
    { "@type": "Thing", name: "Fresha Alternative" },
    { "@type": "Thing", name: "Salon Software" },
    { "@type": "Thing", name: "UK Salons" },
  ],
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
      name: "Best Fresha Alternative for UK Salons & Clinics (2026)",
      item: PAGE_URL,
    },
  ],
});

const FAQ_ITEMS = [
  {
    q: "Is Feature really free to start?",
    a: "Yes — there's a 14-day free trial, and you don't need to enter a card to begin.",
  },
  {
    q: "Does Feature charge commission on bookings?",
    a: "No. It's a flat £29/month with no commission on any booking.",
  },
  {
    q: "Will my clients be charged to book?",
    a: "No. Clients book for free through your branded page.",
  },
  {
    q: "Does it send WhatsApp reminders?",
    a: "Yes — automatic WhatsApp and SMS reminders are built in to help reduce no-shows.",
  },
  {
    q: "Is it only for hair salons?",
    a: "No. Feature works for hair salons, barbershops, beauty and nail studios, spas, gyms, yoga and Pilates studios, massage therapists, and physio and aesthetic clinics — with wording that matches your business.",
  },
  {
    q: "What's the catch compared to Fresha or Booksy?",
    a: "Feature isn't a consumer marketplace, so it won't find you new clients the way they can. In exchange, you pay one flat price and keep every penny of every booking.",
  },
];

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
  },
  {
    label: "Commission on bookings",
    feat: "None",
    fresha: "20% on new marketplace clients",
    booksy: '30% on new "Boost" clients',
    featColor: "#047857",
    freshaColor: "#B91C1C",
    booksyColor: "#B91C1C",
  },
  {
    label: "Per-staff fees",
    feat: "No",
    fresha: "Yes",
    booksy: "Yes",
    featColor: "#047857",
    freshaColor: "#B91C1C",
    booksyColor: "#B91C1C",
  },
  {
    label: "WhatsApp reminders",
    feat: "Yes",
    fresha: "No",
    booksy: "No",
    featColor: "#047857",
    freshaColor: "#B91C1C",
    booksyColor: "#B91C1C",
  },
  {
    label: "SMS reminders",
    feat: "Yes",
    fresha: "Varies",
    booksy: "Yes",
    featColor: "#047857",
    booksyColor: "#047857",
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
    featColor: "#047857",
    freshaColor: "#047857",
    booksyColor: "#047857",
  },
  {
    label: "UK-built",
    feat: "Yes",
    fresha: "Global",
    booksy: "Global",
    featColor: "#047857",
  },
];

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

export default function FreshaAlternative2026Page() {
  const related = POSTS.filter((p) => p.slug !== "fresha-alternative-uk-2026").slice(0, 3);

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
        <span style={{ color: C.text2, fontWeight: 600 }}>Best Fresha Alternative for UK Salons &amp; Clinics (2026)</span>
      </div>

      {/* Article */}
      <article style={{ maxWidth: 760, margin: "0 auto", padding: "40px 24px 72px" }}>

        {/* Header */}
        <header style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
            <span style={{ background: "rgba(124,58,237,0.15)", color: C.gold, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, border: "1px solid rgba(124,58,237,0.25)" }}>
              fresha alternative 2026
            </span>
            <span style={{ fontSize: 13, color: C.muted }}>📅 31 May 2026</span>
            <span style={{ fontSize: 13, color: C.muted }}>⏱ 9 min read</span>
          </div>

          <h1 style={{ fontSize: "clamp(28px,4.5vw,46px)", fontWeight: 900, color: C.text, lineHeight: 1.15, marginBottom: 28, letterSpacing: "-0.5px" }}>
            The Best Fresha Alternative for UK Salons &amp; Clinics in 2026
          </h1>

          <p style={{ fontSize: 17, color: C.muted, lineHeight: 1.85, borderLeft: `3px solid ${C.gold}`, paddingLeft: 20, margin: 0, fontStyle: "italic" }}>
            If you&apos;ve ever stared at your monthly software bill and wondered where the money actually went, you&apos;re not the only one. Here&apos;s an honest, up-to-date look at the real cost of the big booking platforms in 2026 — and what to weigh up if you&apos;re thinking of switching.
          </p>
        </header>

        {/* Prose */}
        <div style={{ fontSize: 16, lineHeight: 1.85, color: C.text2 }}>

          {/* Section 1 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>&ldquo;Free&rdquo; rarely means free</h2>
            <p>
              For years, the pitch from the big booking platforms was simple: free software, no monthly fee, ever. It&apos;s a brilliant hook. The catch is that the money has to come from somewhere — and it usually comes out of your bookings.
            </p>
            <p>
              In early 2025, the best-known &ldquo;free&rdquo; platform, Fresha, dropped its free tier altogether and moved everyone onto paid subscriptions. What&apos;s left across the market in 2026 is a patchwork of three stacking costs that most owners don&apos;t fully add up until the first invoice lands: a monthly <strong style={{ color: C.text }}>subscription</strong>, a <strong style={{ color: C.text }}>marketplace commission</strong> on certain bookings, and <strong style={{ color: C.text }}>payment-processing fees</strong> on every card transaction.
            </p>
            <p>
              None of these platforms are bad. The software is often genuinely good. The question is whether the <em>model</em> works for a small, independent UK business — or quietly works against it.
            </p>
          </section>

          {/* Section 2 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>What the big platforms actually charge in 2026</h2>
            <p>
              Let&apos;s deal in real numbers rather than vibes. (Pricing changes often, so always check the provider&apos;s current page — these are the figures reported across the market in 2026.)
            </p>

            <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 16, marginTop: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>Fresha</div>
              <p style={{ margin: 0 }}>
                Now a paid subscription — roughly £14.95/month for a solo professional, or about £9.95 per team member on the team plan. On top of that sits the part that catches people out: a <strong style={{ color: "#B91C1C" }}>20% commission (minimum around £6) on new clients who find you through the Fresha marketplace.</strong> Then payment processing of roughly 1.2% + 20p per transaction in the UK. Reporting and loyalty features are often paid add-ons, and the card terminal is a separate cost.
              </p>
            </div>

            <div style={{ background: C.surface, border: `1.5px solid ${C.border}`, borderRadius: 14, padding: "20px 24px", marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: C.text, marginBottom: 10 }}>Booksy</div>
              <p style={{ margin: 0 }}>
                Around £40/month, plus about £5 per additional team member. Its marketplace commission, charged through the &ldquo;Boost&rdquo; feature, is <strong style={{ color: "#B91C1C" }}>30% of a new client&apos;s first appointment (minimum £5)</strong> — so a £25 haircut from a Boosted new client hands roughly £7.50 to Booksy. Processing fees apply on top.
              </p>
            </div>

            <p>
              It&apos;s worth being fair here: those marketplace commissions only apply to <strong style={{ color: C.text }}>genuinely new clients who discover you through the platform&apos;s own marketplace</strong> — not to your existing regulars, and not to clients who come from your own website, Google, or Instagram. The commission is the price of the platform acting as a discovery engine that sends you strangers.
            </p>
            <p>
              That trade can be worth it. But it has a sharp edge that owners mention again and again in reviews: a regular client who forgets their password and rebooks through a fresh account can get counted as &ldquo;new&rdquo; — and you pay the commission on someone who was already yours. As one former user put it on a review site, owners simply want a fixed price without surprises.
            </p>
          </section>

          {/* Section 3 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>The real question: marketplace model vs flat model</h2>
            <p>Strip away the detail and there are really two philosophies.</p>
            <p>
              The <strong style={{ color: C.text }}>marketplace model</strong> (Fresha, Booksy) bundles your booking software with a consumer app where clients can discover you — and charges a cut of the new business it sends your way. If you rely on that discovery, it can pay for itself. If most of your clients already come from word of mouth, your own social media, or walk-ins, you may be paying a commission for introductions you&apos;d have made anyway.
            </p>
            <p>
              The <strong style={{ color: C.text }}>flat model</strong> charges one predictable monthly price and takes nothing from your bookings. There&apos;s no marketplace sending you strangers — you bring your own clients — but every booking, and every penny from it, stays yours. For an established salon or clinic with a loyal client base, that predictability is often worth more than a discovery engine.
            </p>
            <p>Neither is &ldquo;right.&rdquo; It depends entirely on where your clients come from.</p>
          </section>

          {/* Section 4 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>What to look for in a Fresha alternative</h2>
            <p>If you&apos;ve decided the marketplace cut isn&apos;t for you, here&apos;s what actually matters when comparing flat-rate alternatives:</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 20 }}>
              {[
                { title: "Predictable, all-in pricing.", body: "Look past the headline number to the total: subscription + per-staff fees + add-ons + commission. A plan that’s “cheap” at £14.95 can overtake a £29 flat plan once you add team members, reporting, loyalty and a couple of marketplace commissions." },
                { title: "Reminders clients actually see.", body: "No-shows are pure lost revenue — an empty chair you can’t sell twice. Email reminders are standard, but plenty of clients never open email. Reminders over WhatsApp and SMS get read, and that’s the difference between a confirmed booking and a no-show." },
                { title: "Clear ownership of clients and payments.", body: "Your client list and your takings should obviously be yours, with no cut skimmed off bookings." },
                { title: "A genuine UK fit.", body: "Pricing in pounds, UK workflows, and support from people who understand how a British salon or clinic actually runs." },
                { title: "Flexibility across business types.", body: "Whether you run a hair salon, barbershop, nail or beauty studio, spa, gym, yoga studio, or physio clinic, the software should speak your language — clients or patients, stylists or practitioners." },
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

          {/* Section 5 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Where Feature fits in</h2>
            <p>Feature is a UK-built booking platform designed around the flat model, for owners who&apos;d rather have certainty than a commission bill.</p>

            <div style={{ background: C.surface, border: "1.5px solid rgba(124,58,237,0.3)", borderRadius: 16, padding: "20px 24px", margin: "20px 0", display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                "One flat price of £29/month for your whole business — no per-staff fees, no paid add-ons for the core tools, and no commission on any booking, ever.",
                "WhatsApp and SMS reminders built in, to cut the no-shows that quietly cost you the most.",
                "Online booking through your own branded page, 24/7, plus card payments via Stripe that land in your account.",
                "Built for the UK, and flexible enough to run a salon, barber, gym, or clinic in its own words.",
              ].map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <span style={{ color: "#047857", fontWeight: 900, flexShrink: 0, fontSize: 16, marginTop: 3 }}>✓</span>
                  <span style={{ color: C.text2 }}>{item}</span>
                </div>
              ))}
            </div>

            <p>
              We&apos;ll be straight about the trade-off: Feature isn&apos;t a consumer marketplace, so it won&apos;t put your business in front of strangers the way Fresha or Booksy can. You bring your clients; in return, you keep 100% of what they spend, and your monthly cost never moves. For an established business, that&apos;s usually the better deal. If your growth depends entirely on a marketplace finding you new faces, a marketplace platform may suit you better — and that&apos;s a fair, honest answer.
            </p>
          </section>

          {/* Section 6 — Comparison table */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>An honest side-by-side</h2>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14, minWidth: 540 }}>
                <thead>
                  <tr>
                    <th style={{ padding: "12px 16px", textAlign: "left", background: "#FFFFFF", color: C.muted, fontWeight: 700, border: `1px solid ${C.border}`, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px" }}></th>
                    <th style={{ padding: "12px 20px", textAlign: "center", background: "rgba(124,58,237,0.14)", color: C.gold, fontWeight: 800, border: "1px solid rgba(124,58,237,0.35)", fontSize: 14 }}>Feature</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", background: "#FFFFFF", color: C.text, fontWeight: 700, border: `1px solid ${C.border}`, fontSize: 14 }}>Fresha</th>
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
                      <td style={{ padding: "12px 16px", textAlign: "center", color: row.freshaColor ?? C.text2, border: `1px solid ${C.border}`, fontWeight: row.freshaColor ? 700 : 400, fontSize: 13 }}>
                        {row.fresha}
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
              Competitor pricing as reported in 2026; always check each provider&apos;s current pricing page, as rates change.
            </p>
          </section>

          {/* Section 7 */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>&ldquo;But switching sounds like a hassle&rdquo;</h2>
            <p>
              This is the most common — and most reasonable — worry. If your services, staff and clients are already set up somewhere, the thought of re-entering everything is enough to make most people stay put, even when they&apos;re unhappy.
            </p>
            <p>
              A good alternative should remove that effort, not add to it. With Feature, you don&apos;t have to do the setup alone — we&apos;ll help get your services, staff and booking page in place so you can see it working with very little lifting. And during a free trial there&apos;s nothing stopping you running both systems side by side until you&apos;re sure.
            </p>
          </section>

          {/* Section 8 — FAQ */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Frequently asked questions</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {FAQ_ITEMS.map((item, i) => (
                <div key={i} style={{ background: C.surface, borderRadius: 12, padding: "18px 22px", border: `1px solid ${C.border}` }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: C.gold, marginBottom: 8 }}>{item.q}</div>
                  <div style={{ fontSize: 15, color: C.text2, lineHeight: 1.75 }}>{item.a}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Section 9 — CTA */}
          <section style={sectionStyle}>
            <h2 style={h2Style}>Ready to try a Fresha alternative built for you?</h2>
            <p>
              If you&apos;ve ever felt like your booking software was on someone else&apos;s side, it&apos;s worth seeing how a flat-rate, commission-free platform feels.
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
              Feature is a UK-built booking platform for salons, barbers, gyms, and clinics: online bookings, WhatsApp &amp; SMS reminders, and Stripe payments — one flat price, zero commission.
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
