import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { POSTS, getPostBySlug } from "../posts";

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};
  return {
    title: post.metaTitle,
    description: post.metaDescription,
    keywords: [post.keyword, "salon software uk", "feature salon", "uk salon"],
    authors: [{ name: post.author }],
    alternates: { canonical: `https://www.featuresalon.co.uk/blog/${slug}` },
    openGraph: {
      title: post.metaTitle,
      description: post.metaDescription,
      url: `https://www.featuresalon.co.uk/blog/${slug}`,
      locale: "en_GB",
      type: "article",
      publishedTime: post.publishedDate,
      modifiedTime: post.updatedDate,
      authors: [post.author],
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) notFound();

  const BASE = "https://www.featuresalon.co.uk";
  const pageUrl = `${BASE}/blog/${slug}`;

  // Article Schema
  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "@id": `${pageUrl}#article`,
    headline: post.title,
    description: post.metaDescription,
    keywords: post.keyword,
    url: pageUrl,
    datePublished: post.publishedDate,
    dateModified: post.updatedDate,
    author: {
      "@type": "Organization",
      name: post.author,
      url: BASE,
    },
    publisher: {
      "@type": "Organization",
      name: "Feature Salon",
      url: BASE,
      logo: {
        "@type": "ImageObject",
        url: `${BASE}/og-image.png`,
        width: 1200,
        height: 630,
      },
    },
    mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
    image: { "@type": "ImageObject", url: `${BASE}/og-image.png`, width: 1200, height: 630 },
    inLanguage: "en-GB",
    articleSection: "Salon Software",
    wordCount: post.sections.reduce((acc, s) => {
      const bodyWords = s.body.split(" ").length;
      const h3Words = (s.h3Items || []).reduce((a, h) => a + h.body.split(" ").length, 0);
      return acc + bodyWords + h3Words;
    }, 0),
    timeRequired: `PT${post.readingTime}M`,
    about: [
      { "@type": "Thing", name: post.keyword },
      { "@type": "Thing", name: "Salon Software" },
      { "@type": "Thing", name: "UK Salons" },
    ],
  };

  // Breadcrumb Schema
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home",  item: BASE },
      { "@type": "ListItem", position: 2, name: "Blog",  item: `${BASE}/blog` },
      { "@type": "ListItem", position: 3, name: post.title, item: pageUrl },
    ],
  };

  const otherPosts = POSTS.filter((p) => p.slug !== slug).slice(0, 3);

  // Escape </script> sequences to prevent XSS via JSON-LD injection
  const safeJson = (obj: unknown) =>
    JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

  return (
    <main className="landing">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(breadcrumbSchema) }} />

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
      <div style={{ padding: "12px 24px", maxWidth: 800, margin: "0 auto", fontSize: 13, color: "#64748B" }}>
        <Link href="/" style={{ color: "#4F46E5", textDecoration: "none" }}>Home</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <Link href="/blog" style={{ color: "#4F46E5", textDecoration: "none" }}>Blog</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "#0F172A", fontWeight: 600 }}>{post.title}</span>
      </div>

      {/* Article */}
      <article style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px 64px" }}>

        {/* Header */}
        <header style={{ marginBottom: 40 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
            <span style={{
              background: "#EEF2FF", color: "#4338CA",
              fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 99,
            }}>
              {post.keyword}
            </span>
            <span style={{ fontSize: 13, color: "#64748B" }}>
              📅 {new Date(post.publishedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </span>
            <span style={{ fontSize: 13, color: "#64748B" }}>⏱ {post.readingTime} min read</span>
          </div>

          <h1 style={{
            fontSize: "clamp(26px,4vw,42px)", fontWeight: 900,
            color: "#0F172A", lineHeight: 1.2, marginBottom: 20,
          }}>
            {post.title}
          </h1>

          <p style={{ fontSize: 18, color: "#475569", lineHeight: 1.7, borderLeft: "4px solid #6366F1", paddingLeft: 20, margin: 0 }}>
            {post.excerpt}
          </p>
        </header>

        {/* Body */}
        <div style={{ fontSize: 16, lineHeight: 1.85, color: "#374151" }}>
          {post.sections.map((section, i) => (
            <section key={i} style={{ marginBottom: 40 }}>
              <h2 style={{
                fontSize: "clamp(20px,3vw,26px)", fontWeight: 800,
                color: "#0F172A", marginBottom: 16, paddingBottom: 10,
                borderBottom: "2px solid #EEF2FF",
              }}>
                {section.h2}
              </h2>
              {section.body && (
                <p style={{ marginBottom: section.h3Items?.length ? 20 : 0 }}>{section.body}</p>
              )}
              {section.h3Items?.map((item, j) => (
                <div key={j} style={{ marginBottom: 24 }}>
                  <h3 style={{
                    fontSize: 18, fontWeight: 700, color: "#1E293B",
                    marginBottom: 8,
                  }}>
                    {item.h3}
                  </h3>
                  <p style={{ margin: 0 }}>{item.body}</p>
                </div>
              ))}
            </section>
          ))}
        </div>

        {/* Mid-article CTA */}
        <div style={{
          background: "linear-gradient(135deg,#EEF2FF,#F5F3FF)",
          border: "1.5px solid #C7D2FE",
          borderRadius: 16, padding: "28px 32px",
          textAlign: "center", margin: "48px 0",
        }}>
          <div style={{ fontSize: 22, marginBottom: 8 }}>💇‍♀️</div>
          <h3 style={{ fontSize: 20, fontWeight: 800, color: "#0F172A", marginBottom: 8 }}>
            Ready to transform your salon?
          </h3>
          <p style={{ fontSize: 15, color: "#475569", marginBottom: 20 }}>
            Try <Link href="/" style={{ color: "#4F46E5", fontWeight: 600 }}>Feature Salon</Link> free for 14 days — automated bookings, reminders, and payments with no commission fees.
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/signup" className="btn-primary">Start free trial — no card needed</Link>
            <Link href="/pricing" style={{
              padding: "12px 24px", background: "#fff",
              color: "#4F46E5", border: "1.5px solid #4F46E5",
              borderRadius: 10, textDecoration: "none",
              fontSize: 14, fontWeight: 700,
            }}>
              View pricing →
            </Link>
          </div>
        </div>

        {/* Author / Updated */}
        <div style={{
          display: "flex", gap: 16, alignItems: "center",
          background: "#F8FAFC", borderRadius: 12, padding: "16px 20px",
          border: "1px solid #E2E8F0", marginBottom: 48,
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "linear-gradient(135deg,#6366F1,#4F46E5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, flexShrink: 0,
          }}>✍️</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A" }}>{post.author}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>
              Published {new Date(post.publishedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
              {" · "}Updated {new Date(post.updatedDate).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
      </article>

      {/* Related posts */}
      {otherPosts.length > 0 && (
        <section style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px 64px" }}>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: "#0F172A", marginBottom: 24 }}>Related posts</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 16 }}>
            {otherPosts.map((p) => (
              <Link key={p.slug} href={`/blog/${p.slug}`} style={{ textDecoration: "none" }}>
                <div style={{
                  background: "#fff", border: "1.5px solid #E2E8F0",
                  borderRadius: 12, padding: "18px 16px",
                }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#4F46E5", marginBottom: 8 }}>{p.readingTime} min read</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#0F172A", lineHeight: 1.4 }}>{p.title}</div>
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
