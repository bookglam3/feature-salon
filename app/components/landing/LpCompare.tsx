import "./landing.css";

const freshaPoints = [
  "You pay a subscription for each person on your team, so the more staff you add, the more it costs each month.",
  "If a brand new client finds you through their marketplace, they take 20% of that first booking.",
  "Card processing fees come off every payment you take, on top of everything else.",
  "You get a small number of free text and WhatsApp reminders each month, then you pay for more.",
];

const featurePoints = [
  "One flat fee from £29 a month, and it doesn't change whether you're quiet or fully booked.",
  "No commission on any booking, whether it's a brand new client or someone who's been coming for years.",
  "WhatsApp and email reminders are just part of it, not something you get charged more for using.",
  "Payments go through Stripe and land straight in your own account.",
];

export default function LpCompare() {
  return (
    <section className="lp-section" id="compare">
      <div className="lp-section-inner">
        <p className="lp-eyebrow">Feature vs Fresha</p>
        <h2 className="lp-section-title">One flat fee, or a bill that grows with you</h2>
        <p className="lp-section-sub">Commission platforms cost more the busier you get. Feature charges the same whether you take ten bookings or a thousand.</p>
        <div className="lp-cmp-grid">
          <div className="lp-cmp-card lp-cmp-them">
            <div className="lp-cmp-tag">Fresha</div>
            <div className="lp-cmp-head">Pay more as you grow</div>
            <ul className="lp-cmp-list">
              {freshaPoints.map(point => (
                <li key={point} className="lp-cmp-li">
                  <span className="lp-cmp-mark">–</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
          <div className="lp-cmp-card lp-cmp-us">
            <div className="lp-cmp-tag">Feature</div>
            <div className="lp-cmp-head">One price, full stop</div>
            <ul className="lp-cmp-list">
              {featurePoints.map(point => (
                <li key={point} className="lp-cmp-li">
                  <span className="lp-cmp-mark">✓</span>
                  {point}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <p className="lp-cmp-note">Fresha&apos;s 20% fee applies only to brand-new clients who discover you through its own marketplace, not to returning clients or clients you bring in yourself. Fresha figures are its published UK rates and can change, so check fresha.com/pricing for the latest.</p>
      </div>
    </section>
  );
}
