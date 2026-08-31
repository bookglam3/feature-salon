import type { Metadata } from "next";
import LpNav from "./components/landing/LpNav";
import LpHero from "./components/landing/LpHero";
import LpTrust from "./components/landing/LpTrust";
import LpFeatures from "./components/landing/LpFeatures";
import LpCalendar from "./components/landing/LpCalendar";
import LpPricing from "./components/landing/LpPricing";
import LpTestimonials from "./components/landing/LpTestimonials";
import LpCta from "./components/landing/LpCta";
import LpFooter from "./components/landing/LpFooter";

export const metadata: Metadata = {
  title: "Feature | Health & Wellbeing Booking Software — Free Trial",
  description: "Feature is a booking & management platform for salons, gyms, spas, yoga studios, physiotherapy clinics and more. WhatsApp reminders, Stripe payments, staff scheduling & CRM. 14-day free trial. No commission fees.",
  alternates: { canonical: "https://www.featuresalon.co.uk" },
};

const faqItems = [
  { question: "Is Feature free to start?",                          answer: "Yes — every plan includes a 14-day free trial with no credit card required. You get full access to all features from day one." },
  { question: "Does Feature work for my type of business?",         answer: "Absolutely. Feature is built for any Health & Wellbeing business — salons, barbershops, gyms, yoga studios, physiotherapy clinics, spas, massage therapists, personal trainers, dental & aesthetic clinics, and more. If you take appointments, Feature works for you." },
  { question: "How does Feature compare to Fresha?",                answer: "Unlike Fresha, Feature charges a flat monthly subscription with zero commission on bookings or payments. Feature also supports a much broader range of businesses — gyms, physio clinics, yoga studios — not just salons and spas. Our Pro plan at £59/month replaces Fresha's hidden fees which can exceed £150/month for a busy business." },
  { question: "How does Feature compare to Treatwell?",             answer: "Treatwell takes a commission on every booking made through their marketplace. Feature gives you your own branded booking page with no marketplace fees — you keep 100% of your revenue. Feature also supports businesses far beyond salons and spas." },
  { question: "Can clients book online 24/7?",                      answer: "Yes. Every business gets a public booking page where clients can browse services, choose a staff member, and book at any time — no phone calls needed." },
  { question: "What payment methods are supported?",                answer: "Feature uses Stripe for payments, supporting all major credit and debit cards. You can take deposits or full payments at booking time to reduce no-shows." },
  { question: "Is there a long-term contract?",                     answer: "No contracts at all. All plans are monthly and you can cancel at any time from your dashboard. We also offer a 30-day money-back guarantee." },
  { question: "Do you send automated appointment reminders?",       answer: "Yes — Feature sends automated SMS, WhatsApp, and email reminders to clients before their appointments." },
  { question: "How much does Feature cost?",                        answer: "Feature starts from £29/month for the Starter plan (up to 3 staff), £59/month for Pro (up to 10 staff), and £99/month for Business (unlimited staff). All plans include a 14-day free trial with no credit card required." },
  { question: "What features does Feature include?",                answer: "Feature includes: online booking system, staff management & scheduling, automated WhatsApp/SMS/email reminders, Stripe payment processing, client CRM, revenue analytics, gift cards, loyalty program, waitlist management, class scheduling, and multi-location support." },
];

// ── Schema: FAQ ───────────────────────────────────────────────────
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://www.featuresalon.co.uk/#faq",
  mainEntity: faqItems.map((item, i) => ({
    "@type": "Question",
    "@id": `https://www.featuresalon.co.uk/#faq-${i + 1}`,
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

// ── Schema: SoftwareApplication ──────────────────────────────────
const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://www.featuresalon.co.uk/#software",
  name: "Feature",
  url: "https://www.featuresalon.co.uk",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Health & Wellbeing Booking Software",
  operatingSystem: "Web, iOS, Android",
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  description: "Feature is a UK booking & management platform for Health & Wellbeing businesses. Manage online bookings, staff scheduling, WhatsApp & SMS reminders, Stripe payments, client CRM, revenue analytics, gift cards, and loyalty programs — all from one dashboard.",
  featureList: [
    "Online booking system with 24/7 client self-booking",
    "Automated WhatsApp appointment reminders",
    "Automated SMS and email reminders",
    "Stripe payment processing with deposit collection",
    "Staff scheduling and management",
    "Class and group session scheduling",
    "Client CRM with visit history",
    "Revenue analytics and reports",
    "Multi-location management",
    "Gift card system",
    "Loyalty rewards program",
    "Waitlist management",
    "Mobile-first PWA design",
    "No booking commission fees",
    "Branded public booking page",
  ],
  screenshot: "https://www.featuresalon.co.uk/og-image.png",
  offers: [
    {
      "@type": "Offer",
      name: "Starter Plan",
      price: "29.00",
      priceCurrency: "GBP",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "29.00", priceCurrency: "GBP", billingDuration: "P1M" },
      description: "For solo practitioners. Up to 3 staff, online booking, email reminders.",
      url: "https://www.featuresalon.co.uk/signup",
    },
    {
      "@type": "Offer",
      name: "Pro Plan",
      price: "59.00",
      priceCurrency: "GBP",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "59.00", priceCurrency: "GBP", billingDuration: "P1M" },
      description: "For growing businesses. Up to 10 staff, SMS & WhatsApp reminders, analytics.",
      url: "https://www.featuresalon.co.uk/signup",
    },
    {
      "@type": "Offer",
      name: "Business Plan",
      price: "99.00",
      priceCurrency: "GBP",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "99.00", priceCurrency: "GBP", billingDuration: "P1M" },
      description: "For multi-location businesses. Unlimited staff, advanced reports, priority support.",
      url: "https://www.featuresalon.co.uk/signup",
    },
  ],
  publisher: {
    "@type": "Organization",
    name: "Feature",
    url: "https://www.featuresalon.co.uk",
    logo: { "@type": "ImageObject", url: "https://www.featuresalon.co.uk/brand/logo-light.svg" },
  },
};

// ── Schema: Organization ─────────────────────────────────────────
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://www.featuresalon.co.uk/#organization",
  name: "Feature",
  url: "https://www.featuresalon.co.uk",
  logo: {
    "@type": "ImageObject",
    url: "https://www.featuresalon.co.uk/brand/logo-light.svg",
    width: 200,
    height: 60,
  },
  description: "Feature provides UK Health & Wellbeing businesses with an all-in-one management platform including online booking, payments, reminders, and CRM.",
  contactPoint: { "@type": "ContactPoint", contactType: "customer support", availableLanguage: "English", areaServed: "GB" },
  areaServed: { "@type": "Country", name: "United Kingdom" },
  sameAs: [
    "https://www.instagram.com/featuresalon",
    "https://www.facebook.com/featuresalon",
  ],
};

// ── Schema: WebSite ──────────────────────────────────────────────
const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": "https://www.featuresalon.co.uk/#website",
  url: "https://www.featuresalon.co.uk",
  name: "Feature",
  description: "UK Health & Wellbeing Booking & Management Software",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://www.featuresalon.co.uk/book/{search_term_string}" },
    "query-input": "required name=search_term_string",
  },
};

export default function Home() {
  return (
    <main className="lp-root">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />

      <LpNav />
      <LpHero />
      <LpTrust />
      <LpFeatures />
      <LpCalendar />
      <LpPricing />
      <LpTestimonials />
      <LpCta />
      <LpFooter />
    </main>
  );
}
