import "./landing.css";

const testimonials = [
  {
    quote: "Before Feature, managing bookings was a real hassle — and Fresha kept taking commission on top. Now it costs me far less, and the automatic WhatsApp reminders are brilliant. I'd absolutely recommend it to any other salon.",
    initial: "J",
    name: "John",
    business: "Style by John",
  },
];

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

export default function LpTestimonials() {
  return (
    <section className="lp-section">
      <div className="lp-section-inner">
        <p className="lp-eyebrow">What our customers say</p>
        <h2 className="lp-section-title">Loved by real UK businesses</h2>
        <div className="lp-tst-grid" style={{ marginTop: 48 }}>
          {testimonials.map(t => (
            <div key={t.name} className="lp-tst">
              <div className="lp-tst-stars">
                {Array.from({ length: 5 }).map((_, i) => <StarIcon key={i} />)}
              </div>
              <p className="lp-tst-quote">&quot;{t.quote}&quot;</p>
              <div className="lp-tst-person">
                <div className="lp-tst-av">{t.initial}</div>
                <div>
                  <div className="lp-tst-name">{t.name}</div>
                  <div className="lp-tst-biz">{t.business}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
