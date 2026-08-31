import LpNav from "../components/landing/LpNav";
import LpHero from "../components/landing/LpHero";
import LpTrust from "../components/landing/LpTrust";
import LpFeatures from "../components/landing/LpFeatures";
import LpHowItWorks from "../components/landing/LpHowItWorks";
import LpCalendar from "../components/landing/LpCalendar";
import LpCompare from "../components/landing/LpCompare";
import LpPricing from "../components/landing/LpPricing";
import LpTestimonials from "../components/landing/LpTestimonials";
import LpFaq from "../components/landing/LpFaq";
import LpCta from "../components/landing/LpCta";
import LpFooter from "../components/landing/LpFooter";

export const metadata = { title: "Preview — Feature", robots: { index: false, follow: false } };

export default function PreviewPage() {
  return (
    <div className="lp-root">
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
    </div>
  );
}
