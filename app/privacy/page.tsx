import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Feature",
  description: "How Feature collects, uses, and protects your personal data. UK GDPR and DPA 2018 compliant.",
  alternates: { canonical: "https://www.featuresalon.co.uk/privacy" },
};

export default function PrivacyPolicyPage() {
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
        <h1 style={{ fontSize: 38, fontWeight: 900, color: "#12101A", letterSpacing: "-1px", margin: "0 0 14px" }}>Privacy Policy</h1>
        <p style={{ fontSize: 15, color: "#6B6577", maxWidth: 520, margin: "0 auto 16px" }}>
          We take your privacy seriously. This policy explains what data we collect, how we use it, and your rights under UK GDPR and the Data Protection Act 2018.
        </p>
        <p style={{ fontSize: 13, color: "#6B6577" }}>Last updated: 27 May 2026 · Effective: 27 May 2026</p>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "52px 24px 80px" }}>

        {/* Legal disclaimer banner */}
        <div style={{ background: "#FFFBEB", border: "1.5px solid #FCD34D", borderRadius: 12, padding: "16px 20px", marginBottom: 40, display: "flex", gap: 12, alignItems: "flex-start" }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
          <p style={{ margin: 0, fontSize: 13.5, color: "#92400E", lineHeight: 1.6 }}>
            <strong>Template notice:</strong> This privacy policy has not been reviewed by a legal professional. Before relying on it, you should have it reviewed by a solicitor experienced in UK data protection law.
          </p>
        </div>

        <Section title="1. Who We Are">
          <p>Feature is a booking and business management platform available at <strong>featuresalon.co.uk</strong>, operated by <strong>Adil Albert, trading as Feature</strong>.</p>
          <p>For questions about this policy, contact us at: <a href="mailto:adilgill2008@gmail.com" style={{ color: "#7C3AED" }}>adilgill2008@gmail.com</a></p>
          <SubHeading>Our role under UK GDPR</SubHeading>
          <p>Feature acts as <strong>data controller</strong> for the personal data of our business subscribers (salon owners, clinic operators, gym managers, and similar). Where subscribers use Feature to manage their own clients&apos; or patients&apos; data, <strong>the subscriber is the data controller</strong> for those end-client records, and Feature acts only as a <strong>data processor</strong> — processing that data solely on the subscriber&apos;s instruction. This distinction matters for your rights: if you are the client of a business that uses Feature, you should direct data subject requests to that business.</p>
        </Section>

        <Section title="2. Data We Collect">
          <SubHeading>2.1 Business subscribers (account holders)</SubHeading>
          <ul>
            <li>Name and business name</li>
            <li>Email address and password (passwords are hashed by our authentication provider — we never store plaintext passwords)</li>
            <li>Business type, slug, and subscription plan</li>
            <li>Billing information (processed by Stripe — we do not store card numbers)</li>
          </ul>

          <SubHeading>2.2 Staff members added by the account holder</SubHeading>
          <ul>
            <li>Name, email address, role, and working hours</li>
            <li>Services they are assigned to perform</li>
          </ul>

          <SubHeading>2.3 End clients / patients (customers who book via a public booking page)</SubHeading>
          <ul>
            <li>Name, email address, and phone number (provided at booking)</li>
            <li>Appointment history and service preferences</li>
            <li>Payment status (we do not store payment card data — processed by Stripe)</li>
          </ul>

          <SubHeading>2.4 Treatment and clinical notes (special category data)</SubHeading>
          <p>For health-related businesses (physiotherapists, dental clinics, sports therapists, and similar), appointment notes may contain <strong>health data</strong> — a special category of personal data under Article 9 of the UK GDPR. This data is:</p>
          <ul>
            <li>Stored within your account and accessible only to authorised staff members of that business</li>
            <li>Protected by row-level security (RLS) — other Feature subscribers cannot access it</li>
            <li>Never displayed publicly or shared with third parties beyond those listed in Section 5</li>
          </ul>
          <p>The business subscriber (data controller) is responsible for ensuring they hold the appropriate lawful basis — typically explicit consent or a health-treatment exemption — before recording health data in Feature.</p>

          <SubHeading>2.5 Usage and technical data</SubHeading>
          <ul>
            <li>Pages visited, features used, and session duration</li>
            <li>IP address, browser type, and device type</li>
            <li>Error logs used to diagnose technical issues</li>
          </ul>
        </Section>

        <Section title="3. How We Use Your Data">
          <p>We use the data we collect to:</p>
          <ul>
            <li>Provide and maintain the Feature platform</li>
            <li>Process bookings and send confirmation and reminder messages (email and SMS)</li>
            <li>Process subscription payments via Stripe</li>
            <li>Send product updates and important account notices (you can opt out of marketing emails at any time)</li>
            <li>Detect and prevent fraud, abuse, and security incidents</li>
            <li>Improve our platform through aggregated, anonymised usage analytics</li>
            <li>Comply with legal obligations</li>
          </ul>
          <p>We do <strong>not</strong> sell your personal data to third parties. We do not use it for advertising purposes.</p>
        </Section>

        <Section title="4. Legal Basis for Processing (UK GDPR)">
          <ul>
            <li><strong>Contract performance</strong> — processing necessary to deliver the Feature service you have signed up for</li>
            <li><strong>Legitimate interests</strong> — fraud prevention, platform security, and service improvement (where our interests are not overridden by your rights)</li>
            <li><strong>Consent</strong> — marketing communications (you may withdraw consent at any time); and, where applicable, processing of special category health data</li>
            <li><strong>Legal obligation</strong> — where we are required by law to process or retain data</li>
          </ul>
          <p>For <strong>special category health data</strong> (treatment notes), processing by Feature as a data processor is on the instruction of the subscriber (data controller), who must have their own lawful basis under Article 9 UK GDPR (typically explicit patient consent or a health-treatment exception).</p>
        </Section>

        <Section title="5. Third-Party Processors">
          <p>Feature uses the following trusted sub-processors. We have data processing agreements in place with each, and they are permitted to process data only on our instruction:</p>
          <ul>
            <li><strong>Supabase</strong> — cloud database and authentication (EU/UK data storage)</li>
            <li><strong>Stripe</strong> — payment processing (PCI-DSS compliant; we do not store card details)</li>
            <li><strong>Twilio</strong> — appointment reminder SMS messages</li>
            <li><strong>Resend</strong> — transactional email delivery</li>
            <li><strong>Vercel</strong> — application hosting</li>
          </ul>
        </Section>

        <Section title="6. Data Retention">
          <ul>
            <li><strong>Active accounts:</strong> data is retained for as long as your account remains active</li>
            <li><strong>Cancelled accounts:</strong> account data is deleted within 90 days of cancellation, unless we are legally required to retain it longer</li>
            <li><strong>Booking and financial records:</strong> may be retained for up to 7 years for financial and legal compliance purposes</li>
            <li><strong>Health / treatment notes:</strong> subscribers operating clinical businesses should set their own retention schedules in line with applicable healthcare regulations (e.g. NHS guidance recommends 8 years for adult records). Feature will retain this data for as long as the subscriber&apos;s account is active, and delete it within 90 days of account cancellation</li>
            <li><strong>Anonymised analytics:</strong> retained indefinitely in aggregate form only</li>
          </ul>
        </Section>

        <Section title="7. Your Rights Under UK GDPR">
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong>Rectification</strong> — ask us to correct inaccurate or incomplete data</li>
            <li><strong>Erasure</strong> — request deletion of your personal data (&ldquo;right to be forgotten&rdquo;), subject to our legal retention obligations</li>
            <li><strong>Restriction</strong> — ask us to restrict processing of your data in certain circumstances</li>
            <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
            <li><strong>Object</strong> — object to processing based on legitimate interests or for direct marketing</li>
            <li><strong>Withdraw consent</strong> — where processing is based on consent, withdraw it at any time without affecting prior processing</li>
          </ul>
          <p><strong>Note on data portability:</strong> Feature does not currently provide a self-service data export tool. To request a copy of your data, please contact us by email and we will fulfil the request within 30 days.</p>
          <p>To exercise any of these rights, email <a href="mailto:adilgill2008@gmail.com" style={{ color: "#7C3AED" }}>adilgill2008@gmail.com</a>. We will respond within 30 days. You also have the right to lodge a complaint with the <strong>Information Commissioner&apos;s Office (ICO)</strong> at <a href="https://ico.org.uk" target="_blank" rel="noopener noreferrer" style={{ color: "#7C3AED" }}>ico.org.uk</a>.</p>
          <p><strong>If you are a client of a business that uses Feature</strong> (not a Feature subscriber yourself), please direct your data subject rights request to that business — they are the data controller for your records.</p>
        </Section>

        <Section title="8. Cookies">
          <p>Feature uses the following types of cookies:</p>
          <ul>
            <li><strong>Essential cookies</strong> — required for authentication and session management. These cannot be disabled without breaking the service.</li>
            <li><strong>Preference cookies</strong> — remember your settings (e.g. active account, display preferences). You can clear these in your browser settings.</li>
            <li><strong>Analytics cookies</strong> — anonymised usage data to help us understand how the platform is used and improve it. You may opt out by adjusting your browser settings.</li>
          </ul>
          <p>We do not use advertising or cross-site tracking cookies.</p>
        </Section>

        <Section title="9. Security">
          <p>We implement the following security measures:</p>
          <ul>
            <li>TLS encryption for all data in transit</li>
            <li>Encrypted storage at rest via Supabase</li>
            <li>Row-level security (RLS) so each subscriber account can only access its own data</li>
            <li>Additional RLS rules restricting health / treatment note access to authorised staff only</li>
            <li>Password hashing managed by Supabase Auth (plaintext passwords are never stored by Feature)</li>
            <li>Regular dependency updates and security reviews</li>
          </ul>
          <p>Feature is <strong>not</strong> currently certified to ISO 27001, SOC 2, or any other formal security framework.</p>
          <p>In the event of a personal data breach that is likely to result in a risk to individuals&apos; rights and freedoms, we will notify the ICO within 72 hours as required by UK GDPR, and will notify affected individuals without undue delay where required.</p>
        </Section>

        <Section title="10. International Data Transfers">
          <p>Feature stores data primarily within the UK and European Economic Area via Supabase. Where data is processed outside the UK/EEA (for example, by Vercel or Stripe infrastructure), we ensure appropriate safeguards are in place, such as Standard Contractual Clauses or mechanisms recognised under UK adequacy regulations.</p>
        </Section>

        <Section title="11. Children">
          <p>Feature is intended for use by businesses and is not directed at individuals under the age of 18. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us at <a href="mailto:adilgill2008@gmail.com" style={{ color: "#7C3AED" }}>adilgill2008@gmail.com</a> and we will delete it promptly.</p>
        </Section>

        <Section title="12. Changes to This Policy">
          <p>We may update this Privacy Policy from time to time. When we make material changes, we will notify account holders by email at least 14 days before the changes take effect. Continued use of Feature after the effective date constitutes acceptance of the updated policy. The &ldquo;Last updated&rdquo; date at the top of this page always reflects the current version.</p>
        </Section>

        <Section title="13. Contact">
          <p>For any privacy-related questions or requests:</p>
          <ul>
            <li>Email: <a href="mailto:adilgill2008@gmail.com" style={{ color: "#7C3AED" }}>adilgill2008@gmail.com</a></li>
            <li>Website: <a href="https://www.featuresalon.co.uk" style={{ color: "#7C3AED" }}>featuresalon.co.uk</a></li>
          </ul>
        </Section>

        {/* Footer nav */}
        <div style={{ marginTop: 56, paddingTop: 32, borderTop: "1px solid #ECE9F1", display: "flex", gap: 24, flexWrap: "wrap" }}>
          <Link href="/terms" style={{ color: "#7C3AED", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Terms of Service →</Link>
          <Link href="/" style={{ color: "#6B6577", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Back to Home</Link>
          <Link href="/signup" style={{ color: "#6B6577", fontSize: 14, fontWeight: 600, textDecoration: "none" }}>Start Free Trial</Link>
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
      <div style={{ fontSize: 15, lineHeight: 1.75, color: "#6B6577" }}>
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
