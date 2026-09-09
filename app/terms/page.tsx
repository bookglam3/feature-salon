import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Feature",
  description: "Terms and conditions for using the Feature booking and business management platform.",
  alternates: { canonical: "https://www.featuresalon.co.uk/terms" },
};

export default function TermsOfServicePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#FFFFFF", fontFamily: "Inter, system-ui, sans-serif" }}>

      {/* Header */}
      <header style={{ background: "#fff", borderBottom: "1px solid #ECE9F1", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ fontSize: 18, fontWeight: 800, color: "#12101A", textDecoration: "none", letterSpacing: "-0.5px" }}>
          feature
        </Link>
        <Link href="/signup" style={{ background: "linear-gradient(135deg,#7C3AED,#6D28D9)", color: "#fff", padding: "9px 20px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, textDecoration: "none" }}>
          Start Free Trial
        </Link>
      </header>

      {/* Hero */}
      <div style={{ background: "linear-gradient(135deg,#EEF2FF 0%,#F5F3FF 100%)", borderBottom: "1px solid #ECE9F1", padding: "52px 24px 44px", textAlign: "center" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#7C3AED", letterSpacing: "2px", textTransform: "uppercase", marginBottom: 12 }}>Legal</div>
        <h1 style={{ fontSize: 38, fontWeight: 900, color: "#12101A", letterSpacing: "-1px", margin: "0 0 14px" }}>Terms of Service</h1>
        <p style={{ fontSize: 15, color: "#524D60", maxWidth: 520, margin: "0 auto 16px" }}>
          Please read these terms carefully before using Feature. By creating an account, you agree to be bound by them.
        </p>
        <p style={{ fontSize: 13, color: "#524D60" }}>Last updated: 27 May 2026 · Effective: 27 May 2026</p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "52px 24px 80px" }}>

        {/* Legal disclaimer banner */}
        <div style={{ background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 12, padding: "16px 20px", marginBottom: 40, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 13.5, color: "#92400E", lineHeight: 1.6 }}>
            <strong>Template notice:</strong> These terms of service have not been reviewed by a legal professional. Before relying on them, you should have them reviewed by a solicitor.
          </p>
        </div>

        <Section title="1. About Feature">
          <p>Feature is a booking and business management platform available at <strong>featuresalon.co.uk</strong>, operated by <strong>Adil Albert, trading as Feature</strong> (&ldquo;Feature&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, &ldquo;our&rdquo;).</p>
          <p>The platform is designed for appointment-based businesses including salons, gyms, physiotherapy practices, dental clinics, and similar (&ldquo;Subscribers&rdquo;).</p>
          <p>By creating an account or using any part of Feature, you agree to these Terms of Service (&ldquo;Terms&rdquo;). If you do not agree, do not use the platform.</p>
        </Section>

        <Section title="2. Eligibility">
          <ul>
            <li>You must be at least 18 years old to create a Feature account.</li>
            <li>Feature is for legitimate business use only — it is not a consumer service.</li>
            <li>You must ensure all information you provide during sign-up is accurate and kept up to date.</li>
            <li>If you are signing up on behalf of a company or organisation, you confirm you have authority to bind that entity to these Terms.</li>
          </ul>
        </Section>

        <Section title="3. Your Account">
          <ul>
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>Notify us immediately at <a href="mailto:adilgill2008@gmail.com" style={{ color: "#7C3AED" }}>adilgill2008@gmail.com</a> if you suspect unauthorised access.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You may not share login credentials with third parties or create accounts on behalf of others without their consent.</li>
          </ul>
        </Section>

        <Section title="4. Subscription and Pricing">
          <SubHeading>4.1 Free trial</SubHeading>
          <p>Feature offers a <strong>14-day free trial</strong>. You can use the platform in full during the trial period. At the end of the trial, you must subscribe to a paid plan to continue using Feature.</p>

          <SubHeading>4.2 Paid plans</SubHeading>
          <p>The current subscription price is <strong>£29 per month</strong> (prices inclusive of any applicable VAT). Subscriptions are billed monthly in advance.</p>

          <SubHeading>4.3 No commission</SubHeading>
          <p>Feature charges a flat monthly subscription fee. We do <strong>not</strong> charge commission or a percentage on bookings made through the platform.</p>

          <SubHeading>4.4 Payment processing</SubHeading>
          <p>Payments are processed securely by Stripe. We do not store your card details. By providing payment information, you authorise us to charge the applicable fees to your chosen payment method on each billing date.</p>

          <SubHeading>4.5 Failed payments</SubHeading>
          <p>If a payment fails, we will notify you by email. Access to the platform may be suspended if payment is not received within a reasonable period following the due date.</p>

          <SubHeading>4.6 Refunds</SubHeading>
          <p>Subscription fees are non-refundable except where required by law or where we have materially failed to deliver the service. If you cancel, you will retain access until the end of your current billing period.</p>

          <SubHeading>4.7 Price changes</SubHeading>
          <p>We may change our subscription price. We will give you at least <strong>30 days&apos; notice</strong> of any price increase by email, and the change will take effect at your next renewal date. Continued use after the effective date constitutes acceptance of the new price.</p>
        </Section>

        <Section title="5. Cancellation">
          <p>You may cancel your subscription at any time by emailing <a href="mailto:adilgill2008@gmail.com" style={{ color: "#7C3AED" }}>adilgill2008@gmail.com</a>. Cancellation takes effect at the end of your current billing period, and you will not be charged again after that date.</p>
          <p>Following cancellation, your data will be retained for up to 90 days, during which you may contact us to request a copy. After that period, your account data will be deleted. See our <Link href="/privacy" style={{ color: "#7C3AED" }}>Privacy Policy</Link> for details.</p>
        </Section>

        <Section title="6. Acceptable Use">
          <p>You agree not to use Feature to:</p>
          <ul>
            <li>Violate any applicable law or regulation (including UK data protection law)</li>
            <li>Upload or transmit malware, viruses, or any harmful code</li>
            <li>Attempt to gain unauthorised access to any part of the platform or its infrastructure</li>
            <li>Scrape, crawl, or harvest data from the platform without our written consent</li>
            <li>Send unsolicited marketing communications (spam) via Feature&apos;s messaging tools</li>
            <li>Impersonate any person or entity</li>
            <li>Engage in any activity that disrupts or interferes with the platform or other subscribers</li>
          </ul>
          <p>We may suspend or terminate your account if we have reasonable grounds to believe you have violated these rules.</p>
        </Section>

        <Section title="7. Health Data and Clinical Use">
          <p>If you use Feature to store <strong>health or clinical information</strong> about your clients or patients (for example, physiotherapy treatment notes, clinical assessments, or medical history), you acknowledge and agree that:</p>
          <ul>
            <li>You are the <strong>data controller</strong> for that health data under the UK GDPR and Data Protection Act 2018</li>
            <li>Health data is <strong>special category data</strong> under Article 9 UK GDPR and requires a specific lawful basis — typically explicit patient consent or a health-treatment exception</li>
            <li>You are responsible for obtaining and documenting that lawful basis before recording health data in Feature</li>
            <li>You must comply with any applicable professional, regulatory, and statutory obligations relating to clinical records in your sector</li>
            <li>Feature provides the infrastructure and access controls (row-level security restricting access to authorised staff) but is not responsible for your compliance with health data regulations</li>
          </ul>
        </Section>

        <Section title="8. Your Data">
          <p>You retain ownership of all data you upload to Feature — your business information, client records, service details, and so on. By using Feature, you grant us a limited licence to store and process that data solely to provide the service to you.</p>
          <p>You are responsible for ensuring that any client or patient data you upload to Feature has been collected lawfully, and that your clients are informed of how their data is used (for example, via your own privacy notice). See our <Link href="/privacy" style={{ color: "#7C3AED" }}>Privacy Policy</Link> for how we handle this data as your data processor.</p>
        </Section>

        <Section title="9. Intellectual Property">
          <p>All intellectual property rights in the Feature platform — including its design, code, trademarks, and content (excluding your uploaded data) — are owned by Adil Albert, trading as Feature, or our licensors. Nothing in these Terms grants you any right to copy, reproduce, or use our intellectual property beyond what is necessary to use the platform as intended.</p>
        </Section>

        <Section title="10. Third-Party Services">
          <p>Feature integrates with third-party services including Stripe (payments), Twilio (SMS reminders), Resend (transactional email), and Supabase (database and authentication). Your use of these integrations is subject to the relevant third-party terms. We are not responsible for the availability, performance, or actions of third-party services.</p>
        </Section>

        <Section title="11. Service Availability">
          <p>Feature is provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis. We do not guarantee uninterrupted or error-free access to the platform. We may carry out scheduled or emergency maintenance that temporarily affects availability and will endeavour to give advance notice where possible.</p>
          <p>To the fullest extent permitted by law, we disclaim all warranties, express or implied, including any implied warranty of merchantability, fitness for a particular purpose, or non-infringement.</p>
        </Section>

        <Section title="12. Limitation of Liability">
          <p>To the fullest extent permitted by applicable law, Adil Albert, trading as Feature, shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits, loss of data, loss of clients, or business interruption, arising from your use of or inability to use the platform.</p>
          <p>Our total aggregate liability for all claims arising under or in connection with these Terms shall not exceed the total subscription fees you paid to us in the <strong>12 months immediately preceding the claim</strong>.</p>
          <p>Nothing in these Terms excludes or limits our liability for: death or personal injury caused by our negligence; fraud or fraudulent misrepresentation; or any other liability that cannot be excluded or limited under English law.</p>
        </Section>

        <Section title="13. Termination">
          <SubHeading>13.1 By you</SubHeading>
          <p>You may cancel at any time (see Section 5). If you close your account, you lose access to the platform immediately or at the end of your billing period, depending on how you cancel.</p>
          <SubHeading>13.2 By us</SubHeading>
          <p>We may suspend or terminate your access immediately if you breach these Terms, fail to pay subscription fees, or if we are required to do so by law. We will notify you by email where reasonably possible.</p>
          <SubHeading>13.3 Effect of termination</SubHeading>
          <p>On termination, your access to the platform will cease. Your data will be retained for up to 90 days, after which it will be deleted in accordance with our <Link href="/privacy" style={{ color: "#7C3AED" }}>Privacy Policy</Link>.</p>
        </Section>

        <Section title="14. Changes to These Terms">
          <p>We may update these Terms from time to time. When we make material changes, we will notify you by email at least <strong>14 days before</strong> the changes take effect. Continued use of Feature after the effective date constitutes acceptance of the updated Terms. The &ldquo;Last updated&rdquo; date at the top of this page always reflects the current version.</p>
        </Section>

        <Section title="15. Governing Law and Disputes">
          <p>These Terms are governed by the law of <strong>England and Wales</strong>. Any dispute arising from or in connection with these Terms shall be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          <p>We encourage you to contact us first at <a href="mailto:adilgill2008@gmail.com" style={{ color: "#7C3AED" }}>adilgill2008@gmail.com</a> — most issues can be resolved without legal proceedings.</p>
        </Section>

        <Section title="16. Contact">
          <p>For questions about these Terms:</p>
          <ul>
            <li>Email: <a href="mailto:adilgill2008@gmail.com" style={{ color: "#7C3AED" }}>adilgill2008@gmail.com</a></li>
            <li>Website: <a href="https://www.featuresalon.co.uk" style={{ color: "#7C3AED" }}>featuresalon.co.uk</a></li>
          </ul>
        </Section>

        {/* Footer nav */}
        <div style={{ marginTop: 56, paddingTop: 32, borderTop: "1px solid #ECE9F1", display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Link href="/privacy" style={{ color: "#7C3AED", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Privacy Policy →</Link>
          <Link href="/" style={{ color: "#524D60", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Back to Home</Link>
          <Link href="/signup" style={{ color: "#524D60", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Start Free Trial</Link>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 40 }}>
      <h2 style={{ fontSize: 19, fontWeight: 800, color: "#12101A", letterSpacing: "-0.4px", marginBottom: 14, paddingBottom: 10, borderBottom: "2px solid #EEF2FF" }}>
        {title}
      </h2>
      <div style={{ fontSize: 15, lineHeight: 1.75, color: "#524D60" }}>
        {children}
      </div>
    </section>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontWeight: 700, color: "#12101A", marginTop: 18, marginBottom: 6, fontSize: 14 }}>
      {children}
    </p>
  );
}
