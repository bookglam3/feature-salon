/**
 * Global Schema Markup — 3 JSON-LD schemas (SEO audit compliant)
 * 1. SoftwareApplication — triggers star ratings in Google SERPs
 * 2. Organization        — brand authority + sameAs social profiles
 * 3. WebSite             — sitelinks search box eligibility
 */
export default function SchemaMarkup() {
  // ── 1. SoftwareApplication ───────────────────────────────────
  const softwareAppSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Feature Salon",
    alternateName: ["Feature", "Feature Salon UK"],
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Salon Management Software",
    operatingSystem: "Web, iOS, Android",
    url: "https://featuresalon.co.uk",
    description:
      "Free salon booking software for UK salons. Online bookings, automated WhatsApp & email reminders, Stripe payments, staff management, and revenue analytics. Better than Fresha — no commission fees.",
    inLanguage: "en-GB",
    screenshot: "https://featuresalon.co.uk/og-image.png",
    softwareVersion: "2.0",
    datePublished: "2024-01-01",
    offers: {
      "@type": "Offer",
      price: "29",
      priceCurrency: "GBP",
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: "29",
        priceCurrency: "GBP",
        unitCode: "MON",
        referenceQuantity: { "@type": "QuantitativeValue", value: "1", unitCode: "MON" },
      },
    },
    featureList: [
      "24/7 online booking system",
      "Staff management and scheduling",
      "Client CRM and profiles",
      "Automated WhatsApp and email appointment reminders",
      "Automated WhatsApp reminders",
      "Email booking confirmations",
      "Stripe online payments and deposits",
      "Revenue reports and analytics",
      "Multi-location support",
      "14-day free trial — no credit card required",
      "Zero booking commission",
      "UK-based customer support",
    ],
    keywords: "salon software uk, salon booking system, fresha alternative, treatwell alternative, salon management software, uk salon app",
    provider: {
      "@type": "Organization",
      name: "Feature Salon",
      url: "https://featuresalon.co.uk",
    },
  };

  // ── 2. Organization ──────────────────────────────────────────
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": "https://featuresalon.co.uk/#organization",
    name: "Feature Salon",
    legalName: "Feature Salon Ltd",
    url: "https://featuresalon.co.uk",
    logo: {
      "@type": "ImageObject",
      url: "https://featuresalon.co.uk/og-image.png",
      width: 1200,
      height: 630,
    },
    description:
      "Feature Salon is a UK salon management platform helping independent salons and chains manage online bookings, staff, payments, and client communications with zero commission fees.",
    foundingDate: "2024",
    areaServed: [
      { "@type": "Country", name: "United Kingdom" },
      { "@type": "Country", name: "Ireland" },
    ],
    address: {
      "@type": "PostalAddress",
      addressCountry: "GB",
    },
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        areaServed: "GB",
        availableLanguage: "English",
        url: "https://featuresalon.co.uk/signup",
      },
    ],
    sameAs: [
      "https://twitter.com/featuresalon",
      "https://www.instagram.com/featuresalon",
    ],
  };

  // ── 3. WebSite (Sitelinks Search Box) ───────────────────────
  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": "https://featuresalon.co.uk/#website",
    name: "Feature Salon",
    url: "https://featuresalon.co.uk",
    description: "Free salon booking software for UK salons — online bookings, payments, and automated reminders",
    inLanguage: "en-GB",
    publisher: { "@id": "https://featuresalon.co.uk/#organization" },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: "https://featuresalon.co.uk/book/{search_term_string}",
      },
      "query-input": "required name=search_term_string",
    },
  };

  const safeJson = (obj: unknown) =>
    JSON.stringify(obj).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026");

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(softwareAppSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(organizationSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJson(websiteSchema) }} />
    </>
  );
}
