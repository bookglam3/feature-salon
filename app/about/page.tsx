import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Our Story | Feature — UK Health & Wellbeing Booking Software",
  description: "Feature started behind the front desk of a family salon. Discover the story behind why we built a booking platform that works for you, not against you.",
  alternates: { canonical: "https://www.featuresalon.co.uk/about" },
};

const prose: React.CSSProperties = {
  fontSize: 17,
  color: "#524D60",
  lineHeight: 1.85,
  marginBottom: 28,
};

const beliefs: { bold: string; rest: string }[] = [
  {
    bold: "Your clients are yours. Your money is yours.",
    rest: " Feature charges one flat monthly price — no commission on bookings, no cut of your payments, no surprises. When your salon has a good month, that’s your good month. Not ours.",
  },
  {
    bold: "Clients read WhatsApp.",
    rest: " They don’t always read email. So we built WhatsApp reminders in from day one — because a client who remembers their appointment is a chair that doesn’t sit empty.",
  },
  {
    bold: "Built in the UK, for the UK.",
    rest: " Fresha is global. Booksy is American. We’re built around how UK businesses actually work — your prices, your clients, your way. And when you need us, you’re talking to people who understand your world.",
  },
  {
    bold: "Not just salons.",
    rest: " What works for a salon works for a barbershop, a physio clinic, a gym, a yoga studio. So we made Feature flexible enough to run any health & wellbeing business — without losing the personal feel of a tool made for you.",
  },
];

export default function AboutPage() {
  return (
    <main className="landing">

      {/* ── Navbar ── */}
      <nav className="nav">
        <Link href="/" className="nav-logo">feature</Link>
        <div className="nav-links">
          <Link href="/#who">Who it&apos;s for</Link>
          <Link href="/#features">Features</Link>
          <Link href="/#pricing">Pricing</Link>
          <Link href="/about" style={{ color: "#12101A", fontWeight: 700 }}>About</Link>
          <Link href="/partner" style={{ color: "#7C3AED", fontWeight: 600 }}>Become a Partner</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup" className="btn-primary">Start free trial</Link>
        </div>
        <Link href="/signup" className="btn-primary mobile-nav-cta">Start free trial</Link>
      </nav>

      {/* ── Hero ── */}
      <section className="hero" style={{ paddingTop: 80, paddingBottom: 80 }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div className="section-label" style={{ marginBottom: 28 }}>OUR STORY</div>
          <h1 style={{
            fontFamily: "var(--font-playfair, Georgia, serif)",
            fontSize: "clamp(30px, 4.5vw, 50px)",
            fontWeight: 400,
            color: "#12101A",
            lineHeight: 1.22,
            letterSpacing: "-1.2px",
            margin: 0,
          }}>
            We didn&apos;t build Feature in an office. We built it behind the front desk of a salon.
          </h1>
        </div>
      </section>

      {/* ── Origin story ── */}
      <section className="section">
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <p style={prose}>
            Feature didn&apos;t start as a tech company. It started with a family salon &mdash; and the quiet chaos most salon owners know too well.
          </p>
          <p style={prose}>
            We watched it up close. Bookings scattered across a phone, a notebook, and a flood of DMs. Clients who forgot they&apos;d booked. Empty chairs that should have been full. Evenings spent chasing payments and confirming tomorrow&apos;s appointments one message at a time.
          </p>
          <p style={prose}>
            And then there were the tools that were supposed to help. They didn&apos;t feel like they were on our side. The &ldquo;free&rdquo; platforms quietly took a cut of every booking. The fees crept up. The bigger they got, the less they seemed to care about the small business that made them money in the first place.
          </p>
          <p style={prose}>
            So we asked a simple question: why does software built for salons so often work against them?
          </p>
          <p style={{
            ...prose,
            marginBottom: 0,
            fontStyle: "italic",
            color: "#12101A",
            fontSize: 19,
            borderLeft: "3px solid #7C3AED",
            paddingLeft: 22,
            lineHeight: 1.7,
          }}>
            We couldn&apos;t find a good answer. So we built our own.
          </p>
        </div>
      </section>

      {/* ── What we believe ── */}
      <section className="section section-white">
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <div className="section-label" style={{ textAlign: "left", marginBottom: 10 }}>WHAT WE BELIEVE</div>
          <h2 className="section-title" style={{ textAlign: "left", marginBottom: 48 }}>What we believe</h2>

          {beliefs.map((b, i) => (
            <div
              key={i}
              style={{
                padding: "28px 0",
                borderBottom: i < beliefs.length - 1 ? "0.5px solid #ECE9F1" : "none",
              }}
            >
              <p style={{ ...prose, marginBottom: 0 }}>
                <strong style={{ color: "#12101A", fontWeight: 700 }}>{b.bold}</strong>
                {b.rest}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Who we are ── */}
      <section className="section">
        <div style={{ maxWidth: 680, margin: "0 auto" }}>
          <div className="section-label" style={{ textAlign: "left", marginBottom: 10 }}>WHO WE ARE</div>
          <h2 className="section-title" style={{ textAlign: "left", marginBottom: 36 }}>Who we are</h2>
          <p style={prose}>
            We&apos;re a small UK team who got tired of watching good businesses get squeezed by tools that were supposed to help them.
          </p>
          <p style={{ ...prose, marginBottom: 0 }}>
            We&apos;re not a faceless platform. We answer our own messages. We help our own customers set up. And every feature we build, we build by asking one question first: does this actually help the person behind the front desk? If it doesn&apos;t, we don&apos;t build it.
          </p>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="section final-cta">
        <h2 className="final-cta-title">
          Feature is the booking platform that works for you &mdash; not against you.
        </h2>
        <p className="final-cta-sub">
          If you&apos;ve ever felt like your software was on someone else&apos;s side, come and try ours. 14 days free. No card. No commission. No catch.
        </p>
        <Link href="/signup" className="btn-primary btn-lg btn-glow">
          Start free &rarr;
        </Link>
        <div className="final-cta-trust">
          <span>No credit card required</span>
          <span>·</span>
          <span>Cancel anytime</span>
          <span>·</span>
          <span>UK support</span>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="footer">
        <span className="nav-logo footer-logo">feature</span>
        <nav className="footer-links" aria-label="Footer navigation">
          <Link href="/pricing">Pricing</Link>
          <Link href="/about">About</Link>
          <Link href="/partner">Become a Partner</Link>
          <Link href="/salons/london">London</Link>
          <Link href="/salons/manchester">Manchester</Link>
          <Link href="/salons/birmingham">Birmingham</Link>
          <Link href="/login">Login</Link>
          <Link href="/signup">Sign up</Link>
        </nav>
        <span className="footer-copy">© 2025 Feature. Built for Health &amp; Wellbeing businesses across the UK &amp; Europe.</span>
      </footer>

      {/* ── Mobile sticky CTA ── */}
      <div className="mobile-sticky-cta">
        <Link href="/signup" className="mobile-sticky-btn">Start Free Trial — No Card Needed</Link>
      </div>

    </main>
  );
}
