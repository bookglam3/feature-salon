import Link from "next/link";
import "./landing.css";

type Plan = {
  name: string;
  forText: string;
  price: string;
  popular?: boolean;
  features: string[];
};

const plans: Plan[] = [
  {
    name: "Starter",
    forText: "Perfect for small businesses",
    price: "£29",
    features: [
      "Online booking page + QR code",
      "Unlimited bookings",
      "Client management",
      "Email reminders",
      "Basic reports",
    ],
  },
  {
    name: "Pro",
    forText: "For growing businesses",
    price: "£59",
    popular: true,
    features: [
      "Everything in Starter",
      "WhatsApp + email reminders",
      "Online payments with Stripe",
      "Multiple staff calendars",
      "Multi-service bookings",
      "Advanced reports",
    ],
  },
  {
    name: "Business",
    forText: "For multi-location businesses",
    price: "£99",
    features: [
      "Everything in Pro",
      "Priority support",
      "Advanced analytics",
      "Custom branding",
    ],
  },
];

function CheckIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function PlanBody({ plan }: { plan: Plan }) {
  return (
    <>
      <div className="lp-plan-name">{plan.name}</div>
      <div className="lp-plan-for">{plan.forText}</div>
      <div className="lp-plan-price"><span className="amt">{plan.price}</span> <span className="per">/month</span></div>
      <Link href="/signup" className={`lp-plan-btn ${plan.popular ? "solid" : "line"}`}>Start Free Trial</Link>
      <ul className="lp-plan-feats">
        {plan.features.map(feat => (
          <li key={feat}>
            <span className="fic"><CheckIcon /></span>
            {feat}
          </li>
        ))}
      </ul>
    </>
  );
}

export default function LpPricing() {
  return (
    <section className="lp-section" id="pricing">
      <div className="lp-section-inner">
        <p className="lp-eyebrow">Pricing</p>
        <h2 className="lp-section-title">Simple, transparent pricing</h2>
        <p className="lp-section-sub">One flat monthly fee. No commission, no per-booking charges, no hidden fees.</p>
        <div className="lp-plans">
          {plans.map(plan =>
            plan.popular ? (
              <div key={plan.name} className="lp-plan pop">
                <div className="lp-plan-ribbon">MOST POPULAR</div>
                <div className="lp-plan-body">
                  <PlanBody plan={plan} />
                </div>
              </div>
            ) : (
              <div key={plan.name} className="lp-plan">
                <PlanBody plan={plan} />
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}
