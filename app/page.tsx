import type { Metadata } from "next";
import LpNav from "./components/landing/LpNav";
import LpHero from "./components/landing/LpHero";
import LpTrust from "./components/landing/LpTrust";
import LpFeatures from "./components/landing/LpFeatures";
import LpHowItWorks from "./components/landing/LpHowItWorks";
import LpCalendar from "./components/landing/LpCalendar";
import LpCompare from "./components/landing/LpCompare";
import LpPricing from "./components/landing/LpPricing";
import LpTestimonials from "./components/landing/LpTestimonials";
import LpFaq from "./components/landing/LpFaq";
import LpCta from "./components/landing/LpCta";
import LpFooter from "./components/landing/LpFooter";

export const metadata: Metadata = {
  title: "Feature | Health & Wellbeing Booking Software — Free Trial",
  description: "Feature is a booking & management platform for salons, gyms, spas, yoga studios, physiotherapy clinics and more. WhatsApp reminders, Stripe payments, staff scheduling & CRM. 14-day free trial. No commission fees.",
  alternates: { canonical: "https://featuresalon.co.uk" },
};

// ── Schema: FAQ ───────────────────────────────────────────────────
// Kept as a text-exact copy of the `faqs` array in LpFaq.tsx so this
// schema matches what's actually visible on the page. LpFaq.tsx is a
// "use client" component, and Next's server/client boundary turns every
// export of a client module (not just the default component) into an
// opaque reference when imported into a Server Component — so this data
// can't be imported directly and has to be kept in sync by hand. If you
// edit the questions/answers in LpFaq.tsx, update this list to match.
const faqItems = [
  { question: "How much does Feature cost?", answer: "There are three plans to choose from. Starter is £29 a month, Pro is £59, and Business is £99. Whichever one you pick, it's a flat monthly fee, so there's no commission and no charge per booking." },
  { question: "Does Feature charge commission on bookings?", answer: "No, never. You pay your monthly fee and that's it. Whatever your clients pay you, you keep. A lot of booking platforms take a cut of every appointment. We don't work that way." },
  { question: "Is Feature a good alternative to Fresha, Treatwell or Booksy?", answer: "It can be. Those platforms usually take commission or charge per booking, which adds up once you're busy. Feature gives you online booking, payments, reminders and client management for one flat fee instead, so you know exactly what you're paying each month." },
  { question: "What types of business is Feature for?", answer: "Salons and barbershops mostly, but also gyms, spas, yoga studios, and physio or wellness clinics. Really, if you take appointments and need a way for clients to book you in, it'll work for your business." },
  { question: "Can my clients book online 24/7?", answer: "Yes. You get a booking page and a QR code you can put on your door, your Instagram, wherever suits. Clients can book from their phone at any time of day, and there's nothing for them to download." },
  { question: "Does Feature send appointment reminders?", answer: "It does. WhatsApp and email reminders go out automatically before each appointment, so you're not chasing clients yourself, and you'll see fewer no-shows." },
  { question: "How do payments work?", answer: "Payments run through Stripe, so it's secure and the money lands straight in your own account. You can take deposits or full payment when someone books, and again, we don't take any commission from it." },
  { question: "Can I import my existing clients?", answer: "Yes, you can bring your existing client list over when you sign up, so you're not starting from scratch. Their details and history come with them." },
  { question: "Is there a free trial? Do I need a card to start?", answer: "There's a 14-day free trial and you don't need to put a card in to start it. If it's not for you, you can cancel any time, no hassle." },
  { question: "Can I manage multiple staff and services?", answer: "Yes. Every booking shows which staff member it's with, and you can see your whole team's day in one calendar. You can set up your services and packages so clients can book more than one thing at once. It's all managed from the same dashboard." },
];

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://featuresalon.co.uk/#faq",
  mainEntity: faqItems.map((item, i) => ({
    "@type": "Question",
    "@id": `https://featuresalon.co.uk/#faq-${i + 1}`,
    name: item.question,
    acceptedAnswer: { "@type": "Answer", text: item.answer },
  })),
};

// ── Schema: SoftwareApplication ──────────────────────────────────
const softwareSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "@id": "https://featuresalon.co.uk/#software",
  name: "Feature",
  url: "https://featuresalon.co.uk",
  applicationCategory: "BusinessApplication",
  applicationSubCategory: "Health & Wellbeing Booking Software",
  operatingSystem: "Web, iOS, Android",
  browserRequirements: "Requires JavaScript. Requires HTML5.",
  description: "Feature is a UK booking & management platform for Health & Wellbeing businesses. Manage online bookings, staff scheduling, WhatsApp & email reminders, Stripe payments, client CRM, revenue analytics, gift vouchers, and loyalty programs — all from one dashboard.",
  featureList: [
    "Online booking system with 24/7 client self-booking",
    "Automated WhatsApp appointment reminders",
    "Automated WhatsApp and email reminders",
    "Stripe payment processing with deposit collection",
    "Staff scheduling and management",
    "Class and group session scheduling",
    "Client CRM with visit history",
    "Revenue analytics and reports",
    "Multi-location management",
    "Gift vouchers (sold and redeemed in salon)",
    "Loyalty rewards program",
    "Waitlist management",
    "Mobile-first PWA design",
    "No booking commission fees",
    "Branded public booking page",
  ],
  screenshot: "https://featuresalon.co.uk/og-image.png",
  offers: [
    {
      "@type": "Offer",
      name: "Starter Plan",
      price: "29.00",
      priceCurrency: "GBP",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "29.00", priceCurrency: "GBP", billingDuration: "P1M" },
      description: "For solo practitioners. Unlimited bookings, 1 staff member, online booking, email + WhatsApp reminders.",
      url: "https://featuresalon.co.uk/signup",
    },
    {
      "@type": "Offer",
      name: "Pro Plan",
      price: "59.00",
      priceCurrency: "GBP",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "59.00", priceCurrency: "GBP", billingDuration: "P1M" },
      description: "For growing businesses. Unlimited bookings, up to 5 staff members, email + WhatsApp reminders, analytics.",
      url: "https://featuresalon.co.uk/signup",
    },
    {
      "@type": "Offer",
      name: "Business Plan",
      price: "99.00",
      priceCurrency: "GBP",
      priceSpecification: { "@type": "UnitPriceSpecification", price: "99.00", priceCurrency: "GBP", billingDuration: "P1M" },
      description: "For multi-location businesses. Unlimited bookings, up to 15 staff members, email + WhatsApp reminders, advanced reports, priority support.",
      url: "https://featuresalon.co.uk/signup",
    },
  ],
  publisher: {
    "@type": "Organization",
    name: "Feature",
    url: "https://featuresalon.co.uk",
    logo: { "@type": "ImageObject", url: "https://featuresalon.co.uk/brand/logo-light.svg" },
  },
};

// ── Schema: Organization ─────────────────────────────────────────
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": "https://featuresalon.co.uk/#organization",
  name: "Feature",
  url: "https://featuresalon.co.uk",
  logo: {
    "@type": "ImageObject",
    url: "https://featuresalon.co.uk/brand/logo-light.svg",
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
  "@id": "https://featuresalon.co.uk/#website",
  url: "https://featuresalon.co.uk",
  name: "Feature",
  description: "UK Health & Wellbeing Booking & Management Software",
  potentialAction: {
    "@type": "SearchAction",
    target: { "@type": "EntryPoint", urlTemplate: "https://featuresalon.co.uk/book/{search_term_string}" },
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
      <LpHowItWorks />
      <LpCalendar />
      <LpCompare />
      <LpPricing />
      <LpTestimonials />
      <LpFaq />
      <LpCta />
      <LpFooter />
    </main>
  );
}
