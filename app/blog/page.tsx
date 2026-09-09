import type { Metadata } from "next";
import Link from "next/link";
import { POSTS } from "./posts";

export const metadata: Metadata = {
  title: "Salon Software Blog — Tips, Guides & Comparisons | Feature Salon",
  description: "The Feature Salon blog. Expert guides on reducing no-shows, growing salon bookings, and comparing salon software — written for UK salon owners.",
  alternates: { canonical: "https://www.featuresalon.co.uk/blog" },
  openGraph: {
    title: "Salon Software Blog | Feature Salon",
    description: "Expert guides for UK salon owners — no-shows, online bookings, Fresha alternatives, and more.",
    url: "https://www.featuresalon.co.uk/blog",
    locale: "en_GB",
    type: "website",
  },
};

const CATEGORY_COLORS: Record<string, string> = {
  "salon no-show reduction": "#047857",
  "salon no-shows": "#047857",
  "barbershop booking": "#6D28D9",
  "whatsapp reminders": "#166534",
  "booksy alternative": "#92400E",
  "best salon booking software": "#4F46E5",
  "salon deposits": "#1D4ED8",
  "no commission booking software": "#9A3412",
  "clinic booking software": "#0F766E",
  "gym booking software": "#B91C1C",
  "fresha alternative": "#4F46E5",
  "fresha alternative 2026": "#4F46E5",
  "best salon software uk": "#92400E",
  "online salon booking": "#1D4ED8",
  "treatwell alternative": "#B91C1C",
};

export default function BlogIndexPage() {
  const featured = POSTS[0];
  const rest = POSTS.slice(1);

  return (
    <main className="landing">
      {/* Nav */}
      <nav className="nav">
        <Link href="/" className="nav-logo">feature</Link>
        <div className="nav-links">
          <Link href="/#features">Features</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup" className="btn-primary">Start free trial</Link>
        </div>
        <Link href="/signup" className="btn-primary mobile-nav-cta">Start free trial</Link>
      </nav>

      {/* Breadcrumb */}
      <div style={{ padding: "12px 24px", maxWidth: 1100, margin: "0 auto", fontSize: 13, color: "#64748B" }}>
        <Link href="/" style={{ color: "#4F46E5", textDecoration: "none" }}>Home</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "#0F172A", fontWeight: 600 }}>Blog</span>
      </div>

      {/* Hero */}
      <section style={{ background: "linear-gradient(135deg,#0F0B2D 0%,#3730A3 60%,#6366F1 100%)", padding: "64px 24px 80px", textAlign: "center" }}>
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div style={{ display: "inline-block", background: "rgba(255,255,255,0.95)", color: "#3730A3", fontSize: 12, fontWeight: 700, padding: "6px 16px", borderRadius: 99, marginBottom: 20, letterSpacing: "1px", textTransform: "uppercase" }}>
            FEATURE SALON BLOG
          </div>
          <h1 style={{ fontSize: "clamp(28px,5vw,48px)", fontWeight: 900, color: "#fff", marginBottom: 16, lineHeight: 1.15 }}>
            Guides for UK Salon Owners
          </h1>
          <p style={{ fontSize: 18, color: "rgba(255,255,255,0.7)", lineHeight: 1.7 }}>
            Expert advice on reducing no-shows, growing online bookings, and choosing the right salon software for your business.
          </p>
        </div>
      </section>

      {/* Featured post */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 0" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 20 }}>
          FEATURED POST
        </div>
        <Link href={`/blog/${featured.slug}`} style={{ textDecoration: "none", display: "block" }}>
          <div style={{
            background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)",
            border: "1.5px solid #C7D2FE",
            borderRadius: 20,
            padding: "36px 40px",
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: 32,
            alignItems: "center",
            transition: "box-shadow 0.2s",
          }}>
            <div>
              <span style={{
                display: "inline-block",
                background: CATEGORY_COLORS[featured.keyword] + "22",
                color: CATEGORY_COLORS[featured.keyword],
                fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99, marginBottom: 16,
              }}>
                {featured.keyword}
              </span>
              <h2 style={{ fontSize: "clamp(20px,3vw,28px)", fontWeight: 800, color: "#0F172A", marginBottom: 12, lineHeight: 1.3 }}>
                {featured.title}
              </h2>
              <p style={{ fontSize: 16, color: "#475569", lineHeight: 1.7, marginBottom: 20 }}>
                {featured.excerpt}
              </p>
              <div style={{ display: "flex", gap: 20, fontSize: 13, color: "#64748B" }}>
                <span>📅 {new Date(featured.publishedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</span>
                <span>⏱ {featured.readingTime} min read</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 60, height: 60, background: "#6366F1", borderRadius: "50%", flexShrink: 0, color: "#fff", fontSize: 24 }}>
              →
            </div>
          </div>
        </Link>
      </section>

      {/* Post grid */}
      <section style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 64px" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", letterSpacing: "1px", textTransform: "uppercase", marginBottom: 28 }}>
          ALL POSTS
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))", gap: 24 }}>
          {rest.map((post) => (
            <Link key={post.slug} href={`/blog/${post.slug}`} style={{ textDecoration: "none" }}>
              <article style={{
                background: "#fff",
                border: "1.5px solid #E2E8F0",
                borderRadius: 16,
                padding: "28px 24px",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                transition: "border-color 0.2s, box-shadow 0.2s",
              }}>
                <span style={{
                  display: "inline-block",
                  background: CATEGORY_COLORS[post.keyword] + "18",
                  color: CATEGORY_COLORS[post.keyword],
                  fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 99, marginBottom: 14,
                }}>
                  {post.keyword}
                </span>
                <h2 style={{ fontSize: 17, fontWeight: 800, color: "#0F172A", marginBottom: 10, lineHeight: 1.35, flex: 1 }}>
                  {post.title}
                </h2>
                <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.6, marginBottom: 20 }}>
                  {post.excerpt}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12, color: "#64748B", borderTop: "1px solid #F1F5F9", paddingTop: 14, marginTop: "auto" }}>
                  <span>📅 {new Date(post.publishedDate).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                  <span>⏱ {post.readingTime} min read</span>
                </div>
              </article>
            </Link>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="section final-cta">
        <h2 className="final-cta-title">Ready to transform your salon?</h2>
        <p className="final-cta-sub">Try Feature free for 14 days — automated bookings, reminders, and payments with no commission fees.</p>
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
