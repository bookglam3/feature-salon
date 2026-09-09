import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";

// ─────────────────────────────────────────────────────────────────
// City Data
// ─────────────────────────────────────────────────────────────────
const CITY_DATA: Record<string, {
  name: string;
  region: string;
  emoji: string;
  tagline: string;
  desc: string;
  neighborhoods: string[];
  localNote: string;
}> = {
  london: {
    name: "London",
    region: "Greater London",
    emoji: "🏙️",
    tagline: "Built for the pace of London",
    desc: "London hair salons, beauty salons, and barbershops can use Feature to manage bookings, staff, and payments — without Fresha's hidden commission fees.",
    neighborhoods: ["Shoreditch", "Brixton", "Canary Wharf", "Chelsea", "Notting Hill"],
    localNote: "Feature is available to salons across London — from Shoreditch to Chelsea — with automated reminders, Stripe payments, and zero commission.",
  },
  manchester: {
    name: "Manchester",
    region: "Greater Manchester",
    emoji: "🌆",
    tagline: "Built for Manchester salons",
    desc: "Manchester hair salons, beauty studios, and barbers can use Feature to automate bookings, reminders, and payments — all from one dashboard.",
    neighborhoods: ["Northern Quarter", "Didsbury", "Deansgate", "Chorlton", "Salford"],
    localNote: "From the Northern Quarter to Didsbury, Feature gives Manchester salons the tools to fill their chairs and reduce no-shows.",
  },
  birmingham: {
    name: "Birmingham",
    region: "West Midlands",
    emoji: "🏘️",
    tagline: "Built for Birmingham hair & beauty salons",
    desc: "Birmingham salons can use Feature instead of Treatwell and Fresha — keeping 100% of their revenue with zero marketplace commission.",
    neighborhoods: ["Jewellery Quarter", "Moseley", "Edgbaston", "Digbeth", "Harborne"],
    localNote: "Birmingham's independent salons can switch from Fresha and Treatwell to Feature — with a flat monthly fee and no per-booking commission.",
  },
  leeds: {
    name: "Leeds",
    region: "West Yorkshire",
    emoji: "🏛️",
    tagline: "Salon software for Leeds salons",
    desc: "Leeds salons can choose Feature for its flat-rate pricing, zero commission, and powerful automated reminders that keep clients coming back.",
    neighborhoods: ["Chapel Allerton", "Headingley", "Roundhay", "Leeds City Centre", "Horsforth"],
    localNote: "Leeds salons from Headingley to the city centre can automate their bookings with Feature.",
  },
  edinburgh: {
    name: "Edinburgh",
    region: "Scotland",
    emoji: "🏰",
    tagline: "Salon software for Edinburgh salons",
    desc: "Edinburgh salons can use Feature to manage bookings year-round — from festival season spikes to quiet January weeks — with smart scheduling and automated reminders.",
    neighborhoods: ["New Town", "Old Town", "Leith", "Morningside", "Stockbridge"],
    localNote: "From the Royal Mile to Morningside, Edinburgh salons can use Feature to handle their busiest days automatically.",
  },
  glasgow: {
    name: "Glasgow",
    region: "Scotland",
    emoji: "🌉",
    tagline: "Salon software for Glasgow salons",
    desc: "Glasgow's salon scene can use Feature to automate bookings, reduce no-shows with WhatsApp reminders, and take Stripe payments — all with no marketplace fees.",
    neighborhoods: ["West End", "Merchant City", "Southside", "Finnieston", "Shawlands"],
    localNote: "Glasgow's independent salons and barbershops can grow faster with Feature's zero-commission booking system.",
  },
  bristol: {
    name: "Bristol",
    region: "South West England",
    emoji: "🌉",
    tagline: "Salon software for Bristol salons",
    desc: "Bristol salons, beauty studios, and barbershops can use Feature to book clients online, send automatic reminders, and grow revenue — without Fresha's fees.",
    neighborhoods: ["Clifton", "Stokes Croft", "Bedminster", "Bishopston", "Redland"],
    localNote: "From Clifton to Stokes Croft, Bristol's creative salon community can use Feature for modern booking management.",
  },
  sheffield: {
    name: "Sheffield",
    region: "South Yorkshire",
    emoji: "⚙️",
    tagline: "Salon software for Sheffield salons",
    desc: "Sheffield salons can use Feature to replace their paper diary, automate reminders, and take online payments — at a fraction of the cost of Fresha or Treatwell.",
    neighborhoods: ["Ecclesall Road", "Broomhill", "Kelham Island", "Hillsborough", "Abbeydale"],
    localNote: "Sheffield's independent salons on Ecclesall Road and across the city can modernise with Feature.",
  },
  liverpool: {
    name: "Liverpool",
    region: "Merseyside",
    emoji: "🎵",
    tagline: "Salon software built for Liverpool",
    desc: "Liverpool salons can use Feature for online booking, automated WhatsApp reminders, and Stripe payments — with no commissions and no hidden fees.",
    neighborhoods: ["Bold Street", "Allerton", "Woolton", "Aigburth", "Crosby"],
    localNote: "From Bold Street to Allerton, Liverpool salons can automate their operations with Feature.",
  },
  nottingham: {
    name: "Nottingham",
    region: "East Midlands",
    emoji: "🏹",
    tagline: "Salon software for Nottingham salons",
    desc: "Nottingham salons and beauty studios can use Feature to manage bookings online, send automated reminders, and grow their client base — all for a flat monthly fee.",
    neighborhoods: ["Hockley", "West Bridgford", "Beeston", "Arnold", "Mapperley"],
    localNote: "Nottingham's growing salon community from Hockley to West Bridgford can choose Feature over outdated alternatives.",
  },
};

const ALL_CITIES = Object.keys(CITY_DATA);

// ─────────────────────────────────────────────────────────────────
// generateStaticParams — pre-render all 10 city pages
// ─────────────────────────────────────────────────────────────────
export function generateStaticParams() {
  return ALL_CITIES.map((city) => ({ city }));
}

// ─────────────────────────────────────────────────────────────────
// generateMetadata — unique title + description per city
// ─────────────────────────────────────────────────────────────────
export async function generateMetadata({
  params,
}: {
  params: Promise<{ city: string }>;
}): Promise<Metadata> {
  const { city } = await params;
  const data = CITY_DATA[city];
  if (!data) return {};

  return {
    title: `Best Salon Software in ${data.name} | Feature Salon`,
    description: `Feature Salon is the best salon management software for ${data.name} salons. Online bookings, WhatsApp reminders, Stripe payments. No commission fees. Free 14-day trial.`,
    keywords: [
      `salon software ${data.name.toLowerCase()}`,
      `${data.name.toLowerCase()} salon booking system`,
      `fresha alternative ${data.name.toLowerCase()}`,
      `salon management ${data.name.toLowerCase()}`,
      `beauty salon software ${data.name.toLowerCase()}`,
    ],
    alternates: {
      canonical: `https://www.featuresalon.co.uk/salons/${city}`,
    },
    openGraph: {
      title: `Best Salon Software in ${data.name} | Feature Salon`,
      description: `The best salon software for ${data.name} salons. Online bookings, automated reminders, Stripe payments — with zero commission fees.`,
      url: `https://www.featuresalon.co.uk/salons/${city}`,
      locale: "en_GB",
      type: "website",
    },
  };
}

// ─────────────────────────────────────────────────────────────────
// Page Component
// ─────────────────────────────────────────────────────────────────
export default async function CityPage({
  params,
}: {
  params: Promise<{ city: string }>;
}) {
  const { city } = await params;
  const data = CITY_DATA[city];
  if (!data) notFound();

  const BASE = "https://www.featuresalon.co.uk";
  const pageUrl = `${BASE}/salons/${city}`;

  // ── LocalBusiness Schema ────────────────────────────────────
  const localBusinessSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${pageUrl}#software`,
    name: "Feature Salon",
    description: `Feature Salon is a UK salon management platform for ${data.name} salons. Online bookings, automated WhatsApp & SMS reminders, Stripe payments — with zero commission fees.`,
    url: BASE,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, iOS, Android",
    offers: {
      "@type": "Offer",
      price: "29",
      priceCurrency: "GBP",
    },
    areaServed: {
      "@type": "City",
      name: data.name,
      "@id": `https://www.wikidata.org/wiki/${data.name}`,
    },
  };

  // ── BreadcrumbList Schema ───────────────────────────────────
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        name: "Home",
        item: BASE,
      },
      {
        "@type": "ListItem",
        position: 2,
        name: "UK Salon Locations",
        item: `${BASE}/salons`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `${data.name} Salons`,
        item: pageUrl,
      },
    ],
  };

  // Other cities for internal linking (exclude current)
  const otherCities = ALL_CITIES.filter((c) => c !== city).slice(0, 6);

  return (
    <main className="landing">
      {/* Schemas */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      {/* ── Nav ── */}
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

      {/* ── Breadcrumb ── */}
      <div style={{ padding: "12px 24px", maxWidth: 1100, margin: "0 auto", fontSize: 13, color: "#64748B" }}>
        <Link href="/" style={{ color: "#4F46E5", textDecoration: "none" }}>Home</Link>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "#64748B" }}>UK Cities</span>
        <span style={{ margin: "0 8px" }}>›</span>
        <span style={{ color: "#0F172A", fontWeight: 600 }}>{data.name}</span>
      </div>

      {/* ── Hero ── */}
      <section className="hero hero-v2">
        <div className="hero-inner">
          <div className="hero-content">
            <div className="hero-badge">{data.emoji} {data.name.toUpperCase()} SALONS</div>
            <h1 className="hero-title">Salon Software for {data.name} Salons</h1>
            <p className="hero-sub">{data.desc}</p>
            <div className="hero-btns">
              <Link href="/signup" className="btn-primary btn-lg">Start Free 14-Day Trial</Link>
              <Link href="/pricing" className="btn-secondary btn-lg">View pricing</Link>
            </div>
            <div className="hero-trust">
              {["No commission fees", "Free 14-day trial", "Cancel anytime", "UK-based support"].map((t) => (
                <span key={t} className="hero-trust-item">
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="8" fill="#ECFDF5"/>
                    <path d="M5 8l2 2 4-4" stroke="#059669" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust bar ── */}
      <section className="trust-bar">
        {["No commission fees", "Free 14-day trial", "Cancel anytime", "UK-based support"].map((item) => (
          <div key={item} className="trust-item"><div className="trust-dot" />{item}</div>
        ))}
      </section>

      {/* ── Local note ── */}
      <section className="section section-white">
        <div className="section-label">WHY {data.name.toUpperCase()} SALONS CHOOSE FEATURE</div>
        <h2 className="section-title">{data.tagline}</h2>
        <p style={{ maxWidth: 640, margin: "0 auto 32px", fontSize: 16, color: "#64748B", lineHeight: 1.7, textAlign: "center" }}>
          {data.localNote}
        </p>

        <div className="features-grid features-grid-v2">
          {[
            { icon: "📲", title: "Online Booking 24/7", desc: `${data.name} clients expect to book at any time. Feature gives every salon a beautiful, mobile-first booking page.` },
            { icon: "💬", title: "WhatsApp & SMS Reminders", desc: `Reduce no-shows with automated reminders via WhatsApp, SMS, and email — personalised for every ${data.name} salon.` },
            { icon: "💷", title: "No Commission Fees", desc: "Feature charges a flat monthly fee. No per-booking commissions, no payment processing markups — ever." },
            { icon: "👥", title: "Multi-Staff Scheduling", desc: `Manage your entire ${data.name} salon team's calendars, breaks, and holidays from one clean dashboard.` },
            { icon: "💳", title: "Stripe Online Payments", desc: "Take deposits or full payments online via Stripe. Reduce no-shows and get paid before clients arrive." },
            { icon: "📊", title: "Revenue Analytics", desc: `Track your busiest days, top services, and best staff members — specific to your ${data.name} salon.` },
          ].map((f) => (
            <div key={f.title} className="feature-card feature-card-v2">
              <div className="feature-icon-v2">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Neighbourhoods ── */}
      <section className="section">
        <div className="section-label">AREAS WE SERVE</div>
        <h2 className="section-title">Feature Salon across {data.name}</h2>
        <p style={{ textAlign: "center", color: "#64748B", marginBottom: 32 }}>
          Feature is used by salons across {data.region}, including:
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "center", maxWidth: 700, margin: "0 auto 40px" }}>
          {data.neighborhoods.map((n) => (
            <span key={n} style={{
              padding: "10px 20px", background: "#EEF2FF", color: "#4338CA",
              borderRadius: 999, fontSize: 14, fontWeight: 600,
            }}>
              📍 {n}
            </span>
          ))}
        </div>
        <div style={{ textAlign: "center" }}>
          <Link href="/signup" className="btn-primary btn-lg">Start your free trial →</Link>
        </div>
      </section>

      {/* ── Early adopter CTA ── */}
      <section className="section section-white" style={{ textAlign: "center" }}>
        <h2 className="section-title">Be one of the first {data.name} salons on Feature</h2>
        <p className="hero-sub">No commission, no contracts, no marketplace fees — just straightforward software at a flat monthly price.</p>
        <div className="hero-btns" style={{ justifyContent: "center", marginTop: 24 }}>
          <Link href="/signup" className="btn-primary btn-lg">Start free 14-day trial →</Link>
        </div>
      </section>

      {/* ── Pricing CTA ── */}
      <section className="section">
        <div style={{ maxWidth: 680, margin: "0 auto", textAlign: "center" }}>
          <div className="section-label">PRICING</div>
          <h2 className="section-title">Simple pricing for {data.name} salons</h2>
          <p style={{ color: "#64748B", marginBottom: 32, fontSize: 16 }}>
            From £29/month — no contracts, no hidden fees, no commission on bookings.
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
            {[
              { plan: "Starter", price: "£29", features: ["3 staff", "Online booking", "Email reminders"] },
              { plan: "Pro", price: "£59", features: ["10 staff", "SMS + WhatsApp", "Revenue reports"], featured: true },
              { plan: "Business", price: "£99", features: ["Unlimited staff", "Priority support", "Multi-location"] },
            ].map((p) => (
              <div key={p.plan} style={{
                padding: "24px 20px", borderRadius: 16,
                border: p.featured ? "2px solid #6366F1" : "1.5px solid #E2E8F0",
                background: p.featured ? "#EEF2FF" : "#fff",
                minWidth: 160, textAlign: "center",
              }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#4F46E5", marginBottom: 8, textTransform: "uppercase" }}>{p.plan}</div>
                <div style={{ fontSize: 28, fontWeight: 800, color: "#0F172A", marginBottom: 12 }}>{p.price}<span style={{ fontSize: 13, fontWeight: 400, color: "#64748B" }}>/mo</span></div>
                {p.features.map((f) => (
                  <div key={f} style={{ fontSize: 13, color: "#475569", marginBottom: 4 }}>✓ {f}</div>
                ))}
              </div>
            ))}
          </div>
          <Link href="/signup" className="btn-primary btn-lg">Start free 14-day trial →</Link>
          <p style={{ fontSize: 13, color: "#64748B", marginTop: 12 }}>No credit card required · Cancel anytime</p>
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="section final-cta">
        <h2 className="final-cta-title">Ready to grow your {data.name} salon?</h2>
        <p className="final-cta-sub">
          Automate bookings, send reminders, and manage your team — all from one dashboard, with no commission fees.
        </p>
        <Link href="/signup" className="btn-primary btn-lg btn-glow">Start Free 14-Day Trial →</Link>
        <div className="final-cta-trust">
          <span>No credit card required</span><span>·</span>
          <span>Cancel anytime</span><span>·</span>
          <span>UK support</span>
        </div>
      </section>

      {/* ── Other city pages ── */}
      <section className="section section-white">
        <div className="section-label">OTHER UK CITIES</div>
        <h2 className="section-title" style={{ marginBottom: 24 }}>Salon software across the UK</h2>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          {otherCities.map((c) => (
            <Link key={c} href={`/salons/${c}`} style={{
              padding: "10px 20px", background: "#F1F5F9", color: "#475569",
              borderRadius: 10, textDecoration: "none", fontSize: 14, fontWeight: 600,
              border: "1.5px solid #E2E8F0", transition: "all 0.15s",
            }}>
              {CITY_DATA[c].emoji} {CITY_DATA[c].name}
            </Link>
          ))}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <Link href="/" className="nav-logo footer-logo">feature</Link>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/">Home</Link>
          <Link href="/pricing">Pricing</Link>
          <Link href="/signup">Sign up</Link>
          {otherCities.slice(0, 4).map((c) => (
            <Link key={c} href={`/salons/${c}`}>{CITY_DATA[c].name}</Link>
          ))}
        </nav>
        <span className="footer-copy">© 2025 Feature. Built for salons across the UK.</span>
      </footer>
    </main>
  );
}
