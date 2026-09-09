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
  title: "Booking Software for UK Physio & Wellness Clinics (2026) | Feature",
  description: "An honest guide to booking software for UK physio and wellness clinics: when you need full practice management, when you don't, and what to look for either way.",
  alternates: { canonical: "https://www.featuresalon.co.uk/blog/booking-software-uk-physio-wellness-clinics" },
  openGraph: {
    title: "Booking Software for UK Physio & Wellness Clinics (2026) | Feature",
    description: "An honest guide to booking software for UK physio and wellness clinics — when full practice management is worth it, and when simpler booking software is the better fit.",
    url: "https://www.featuresalon.co.uk/blog/booking-software-uk-physio-wellness-clinics",
    locale: "en_GB",
    type: "article",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Article",
      "headline": "Booking Software for UK Physio & Wellness Clinics (2026): An Honest Guide",
      "datePublished": "2026-06-01",
      "dateModified": "2026-06-01",
      "author": { "@type": "Organization", "name": "Feature Team" },
      "publisher": { "@type": "Organization", "name": "Feature", "url": "https://www.featuresalon.co.uk" },
      "url": "https://www.featuresalon.co.uk/blog/booking-software-uk-physio-wellness-clinics",
      "description": "An honest guide to booking software for UK physio and wellness clinics: when you need full practice management, when you don't, and what to look for either way.",
      "mainEntityOfPage": { "@type": "WebPage", "@id": "https://www.featuresalon.co.uk/blog/booking-software-uk-physio-wellness-clinics" },
    },
    {
      "@type": "BreadcrumbList",
      "itemListElement": [
        { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.featuresalon.co.uk" },
        { "@type": "ListItem", "position": 2, "name": "Blog", "item": "https://www.featuresalon.co.uk/blog" },
        { "@type": "ListItem", "position": 3, "name": "Booking Software for UK Physio & Wellness Clinics", "item": "https://www.featuresalon.co.uk/blog/booking-software-uk-physio-wellness-clinics" },
      ],
    },
  ],
};

export default function PhysioClinicBookingPage() {
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
          <span style={{ color: text2 }}>Physio &amp; Wellness Clinic Booking Software</span>
        </div>

        {/* Article header */}
        <header style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px 32px" }}>
          <div style={{ display: "inline-block", background: "rgba(124,58,237,0.15)", color: gold, fontSize: 11, fontWeight: 700, padding: "5px 14px", borderRadius: 99, marginBottom: 20, letterSpacing: "2px", textTransform: "uppercase" }}>
            CLINIC BOOKING SOFTWARE
          </div>
          <h1 style={{ fontSize: "clamp(26px,4.5vw,40px)", fontWeight: 800, color: text, margin: "0 0 20px", lineHeight: 1.2, letterSpacing: "-0.5px" }}>
            Booking Software for UK Physio &amp; Wellness Clinics (2026): An Honest Guide
          </h1>
          <p style={{ fontSize: 18, color: text2, lineHeight: 1.7, margin: "0 0 24px" }}>
            Not every clinic needs heavyweight practice-management software. Here&rsquo;s an honest look at what physio and wellness clinics actually need from booking software in the UK &mdash; and when a simpler tool is the better fit.
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
              First, be honest about what your clinic needs
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 24 }}>
              Physiotherapy and wellness clinics don&rsquo;t all need the same thing, and buying the wrong tier wastes money and time.
            </p>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "22px 26px", marginBottom: 16 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: gold, marginBottom: 10, marginTop: 0 }}>
                Full practice-management software
              </h3>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                Platforms like Cliniko, Jane, TM3 or WriteUpp are built for clinics that need clinical depth: SOAP treatment notes, exercise prescription with video libraries, insurance billing, outcome tracking and compliance records. If your clinic relies on detailed clinical documentation and insurance claims, you genuinely need one of these &mdash; typically &pound;15&ndash;&pound;40+ per practitioner per month.
              </p>
            </div>

            <div style={{ background: surface, border: `1px solid ${border}`, borderRadius: 12, padding: "22px 26px", marginBottom: 20 }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: gold, marginBottom: 10, marginTop: 0 }}>
                Booking-focused software
              </h3>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                This is for the other, very common case: clinics, sole practitioners and wellness businesses (massage, sports therapy, aesthetics, multi-discipline studios) whose main pain isn&rsquo;t clinical notes &mdash; it&rsquo;s the admin. Phone-tag for appointments, no-shows, chasing payment, and a diary scattered across paper and texts.
              </p>
            </div>

            <p style={{ fontSize: 15, color: muted, lineHeight: 1.8 }}>
              If that second description is you, a full clinical system is overkill &mdash; you&rsquo;ll pay for SOAP-note and insurance features you never touch. What you actually need is clean booking, reliable reminders, and easy payments.
            </p>
          </section>

          {/* Section 2 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 24, letterSpacing: "-0.3px" }}>
              What booking-focused clinics should look for
            </h2>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>1</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>Online booking straight into your diary</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>Patients book themselves, choosing the right appointment type and practitioner, without the back-and-forth phone calls &mdash; and the system respects each practitioner&rsquo;s availability and your cancellation policy.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>2</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>Reminders that cut no-shows</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>Missed appointments are lost revenue and a wasted slot another patient could have used. Automated WhatsApp and SMS reminders are far more effective than email, which patients often miss.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>3</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>Simple payments and deposits</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>Taking payment or a deposit at booking (via mainstream processing like Stripe) protects your time and reduces no-shows.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 20 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>4</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>The right language and a UK fit</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>Software that says &ldquo;patients&rdquo;, &ldquo;practitioners&rdquo; and &ldquo;appointments&rdquo; &mdash; not salon terms &mdash; and that handles GBP, UK workflows and GDPR properly.</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 16, alignItems: "flex-start", marginBottom: 0 }}>
              <div style={{ width: 32, height: 32, minWidth: 32, borderRadius: "50%", background: "rgba(124,58,237,0.15)", border: `1.5px solid ${gold}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: gold, fontWeight: 700, marginTop: 2 }}>5</div>
              <div>
                <div style={{ fontWeight: 700, color: text, fontSize: 15, marginBottom: 5 }}>No paying for what you won&rsquo;t use</div>
                <div style={{ fontSize: 14, color: text2, lineHeight: 1.75 }}>If you don&rsquo;t need SOAP notes or insurance modules, don&rsquo;t pay for a platform built around them.</div>
              </div>
            </div>
          </section>

          {/* Section 3 */}
          <section style={{ marginBottom: 52 }}>
            <h2 style={{ fontSize: "clamp(20px,3vw,26px)", fontWeight: 700, color: text, marginBottom: 16, letterSpacing: "-0.3px" }}>
              Where Feature fits &mdash; and where it doesn&rsquo;t
            </h2>
            <p style={{ fontSize: 16, color: text2, lineHeight: 1.8, marginBottom: 24 }}>
              Let&rsquo;s be straight, because honesty matters more than a sale.
            </p>

            <div style={{ background: "#F5F3FF", border: "1px solid #F5F3FF", borderRadius: 12, padding: "22px 26px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#6D28D9", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>NOT FOR EVERY CLINIC</div>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, margin: 0 }}>
                <strong style={{ color: text }}>Feature is a booking platform, not a clinical practice-management system.</strong> It does not currently offer SOAP clinical notes, exercise-prescription video libraries, or insurance billing. If your clinic depends on detailed clinical documentation and insurance claims, a dedicated physio platform like Cliniko or Jane will serve you better &mdash; and we&rsquo;d genuinely point you there.
              </p>
            </div>

            <div style={{ background: surface, border: `1.5px solid ${border}`, borderRadius: 12, padding: "22px 26px" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: gold, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 16 }}>WHAT FEATURE DOES WELL</div>
              <p style={{ fontSize: 15, color: text2, lineHeight: 1.75, marginBottom: 18 }}>
                For clinics and practitioners who just need the admin handled:
              </p>

              {[
                "Online booking with per-practitioner scheduling and clinic-appropriate wording (patients, practitioners, appointments)",
                "WhatsApp & SMS reminders built in to cut no-shows",
                "Payments and deposits via Stripe, landing in your account",
                "One flat £29/month for the whole clinic — not per practitioner — with no commission, ever",
                "GDPR-friendly UK setup with GBP throughout",
              ].map((pt, i) => (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                  <span style={{ color: gold, fontSize: 16, lineHeight: 1.5, marginTop: 1, flexShrink: 0 }}>&#10003;</span>
                  <span style={{ fontSize: 15, color: text2, lineHeight: 1.65 }}>{pt}</span>
                </div>
              ))}

              <p style={{ fontSize: 14, color: muted, lineHeight: 1.75, marginTop: 18, marginBottom: 0 }}>
                For a sole practitioner, a massage or sports-therapy clinic, an aesthetics clinic, or any wellness business whose real problem is bookings and no-shows rather than clinical paperwork &mdash; that&rsquo;s often exactly the right amount of software, at a fraction of the cost of a full clinical suite.
              </p>
            </div>
          </section>

          {/* Disclaimer */}
          <p style={{ fontSize: 13, color: "#6B6577", lineHeight: 1.6, fontStyle: "italic", marginBottom: 48 }}>
            Competitor details as reported in 2026 &mdash; always check each provider&rsquo;s current features and pricing, as they change.
          </p>

          {/* CTA box */}
          <div style={{ background: `linear-gradient(135deg, ${surface} 0%, #F5F3FF 100%)`, border: `1.5px solid ${gold}`, borderRadius: 16, padding: "36px 32px", textAlign: "center", marginBottom: 56 }}>
            <h3 style={{ fontSize: 22, fontWeight: 800, color: text, margin: "0 0 10px" }}>
              See if it fits your clinic
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
              UK-built booking software for clinics, salons, gyms &amp; studios &mdash; online bookings, WhatsApp &amp; SMS reminders, and Stripe payments, one flat price.
            </p>
          </div>

          {/* Related posts */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: gold, letterSpacing: "2px", textTransform: "uppercase", marginBottom: 20 }}>RELATED GUIDES</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px,1fr))", gap: 16 }}>
              <Link href="/blog/gym-personal-trainer-booking-software-uk" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                Gym &amp; PT Booking Software (2026)
              </Link>
              <Link href="/blog/how-to-reduce-salon-no-shows" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                How to Reduce No-Shows (2026)
              </Link>
              <Link href="/blog/salon-software-whatsapp-reminders" style={{ display: "block", background: surface, border: `1px solid ${border}`, borderRadius: 10, padding: "16px 18px", textDecoration: "none", color: text2, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>
                Salon Software with WhatsApp Reminders
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
