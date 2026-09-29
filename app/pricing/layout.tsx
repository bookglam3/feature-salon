import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing | Salon Management Software — Feature Salon",
  description:
    "Simple, transparent pricing for UK salons. Feature Salon plans from £29/month with a 14-day free trial. No contracts, no hidden fees. Cancel anytime.",
  keywords: [
    "salon software pricing uk",
    "fresha alternative pricing",
    "salon booking system cost",
    "cheap salon management software uk",
  ],
  alternates: {
    canonical: "https://featuresalon.co.uk/pricing",
  },
  openGraph: {
    title: "Pricing | Salon Management Software — Feature Salon",
    description:
      "Plans from £29/month. 14-day free trial. No contracts. The affordable Fresha alternative for UK salons.",
    url: "https://featuresalon.co.uk/pricing",
    locale: "en_GB",
  },
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
